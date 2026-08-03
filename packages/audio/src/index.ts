import type { AbilityResolvedEvent, BlastEvent, ProjectileImpactEvent, ProjectileSpawnedEvent, SimulationEvent, WeaponAttackStartedEvent, WeaponHitEvent } from '@kinetic/protocol';

export interface AudioDiagnostics {
  eventsConsidered: number;
  eventsSelected: number;
  activeVoices: number;
  voiceLimit: number;
}

export class BattleAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;
  private voices = 0;
  private voiceLimit = 22;
  private diagnostics: AudioDiagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: 22 };
  private lastHitmarkerAt = -Infinity;
  private lastAiHitmarkerAt = -Infinity;
  private lastDamageCueAt = -Infinity;
  private lastWallImpactAt = -Infinity;
  private lastFocusedRifleAt = -Infinity;
  private missileQuietUntilTick = -Infinity;
  private readonly focusedIds = new Set<number>();
  private readonly aiIds = new Set<number>();

  async enable(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.enabled = true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, volume));
  }

  async setPaused(paused: boolean): Promise<void> {
    if (!this.context) return;
    try {
      if (paused && this.context.state === 'running') await this.context.suspend();
      else if (!paused && this.enabled && this.context.state === 'suspended') await this.context.resume();
    } catch {
      // Browser lifecycle/autoplay policies can reject a resume. The existing
      // first-gesture audio unlock path retries without interrupting gameplay.
    }
  }

  consume(
    events: readonly SimulationEvent[],
    entityCount = 2,
    focusEntityIds: readonly number[] = [],
    aiEntityIds: readonly number[] = []
  ): AudioDiagnostics {
    const eventLimit = entityCount > 36 ? 5 : entityCount > 12 ? 7 : 10;
    this.voiceLimit = entityCount > 36 ? 14 : entityCount > 12 ? 18 : 22;

    const focused = this.focusedIds;
    focused.clear();
    for (const id of focusEntityIds) focused.add(id);
    const aiIds = this.aiIds;
    aiIds.clear();
    for (const id of aiEntityIds) aiIds.add(id);

    // Avoid priority sorting, filtering and temporary arrays while audio is
    // unavailable or disabled. Browser autoplay unlock can enable the same
    // engine later without affecting simulation or replay determinism.
    if (!this.enabled || !this.context || !this.master) {
      this.diagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: this.voices, voiceLimit: this.voiceLimit };
      return this.getDiagnostics();
    }

    let strongestPlayerHit = 0;
    let strongestPlayerDamage = 0;
    let strongestAiHit = 0;
    let currentTick = 0;
    let missileEvent = false;

    for (const event of events) {
      currentTick = Math.max(currentTick, event.tick);
      if (event.type === 'projectileSpawned') {
        const missile = event.weaponId.includes('rocket') || event.weaponId.includes('missile');
        missileEvent ||= missile;
        if (event.weaponId === 'automatic-rifle' && focused.has(event.sourceId)) {
          const now = performance.now();
          if (now - this.lastFocusedRifleAt >= 20) {
            this.lastFocusedRifleAt = now;
            this.playAutomaticRifleCrack(true);
          }
        }
      } else if (event.type === 'projectileImpact' || event.type === 'weaponHit') {
        missileEvent ||= event.weaponId.includes('rocket') || event.weaponId.includes('missile');
      } else if (event.type === 'blast') {
        const abilityId = event.abilityId ?? '';
        missileEvent ||= abilityId.includes('rocket') || abilityId.includes('missile');
      } else if (event.type === 'abilityResolved' || event.type === 'abilityActivated') {
        missileEvent ||= event.abilityId.includes('rocket')
          || event.abilityId.includes('missile')
          || event.abilityId === 'starburst-convergence'
          || event.abilityId === 'siege-marker';
      }

      if (event.type !== 'damage' || event.amount <= 0 || event.sourceId === undefined || event.sourceId === event.targetId) continue;
      if (focused.size > 0 && focused.has(event.sourceId) && !focused.has(event.targetId)) {
        strongestPlayerHit = Math.max(strongestPlayerHit, event.amount);
      } else if (focused.size > 0 && focused.has(event.targetId)) {
        strongestPlayerDamage = Math.max(strongestPlayerDamage, event.amount);
      } else if (focused.size === 0 || aiIds.has(event.sourceId)) {
        // AI-vs-AI has no focused player entity. Explicit AI IDs also allow
        // AI-on-AI confirmation to remain audible in mixed controller modes.
        strongestAiHit = Math.max(strongestAiHit, event.amount);
      }
    }

    const now = performance.now();
    if (strongestPlayerHit > 0 && now - this.lastHitmarkerAt >= 24) {
      this.lastHitmarkerAt = now;
      this.playHitmarker(strongestPlayerHit);
    }
    if (strongestPlayerDamage > 0 && now - this.lastDamageCueAt >= 62) {
      this.lastDamageCueAt = now;
      this.playDamageReceived(strongestPlayerDamage);
    }
    const aiHitmarkerInterval = entityCount > 48 ? 86 : entityCount > 20 ? 58 : 34;
    if (strongestAiHit > 0 && now - this.lastAiHitmarkerAt >= aiHitmarkerInterval) {
      this.lastAiHitmarkerAt = now;
      this.playAiHitmarker(strongestAiHit);
    }

    if (missileEvent) this.missileQuietUntilTick = Math.max(this.missileQuietUntilTick, currentTick + 72);
    const missileCascadeActive = currentTick > 0 && currentTick <= this.missileQuietUntilTick;
    const audioEvents = missileCascadeActive
      ? events.filter((event) => event.type !== 'impact' && event.type !== 'wallImpact' && event.type !== 'obstacleImpact' && event.type !== 'death')
      : events;
    const selection = this.selectPriorityEvents(audioEvents, eventLimit);
    const prioritized = selection.events;
    this.diagnostics = { eventsConsidered: selection.considered, eventsSelected: prioritized.length, activeVoices: this.voices, voiceLimit: this.voiceLimit };
    let microMissileBlasts = 0;
    let missileBarrageBlasts = 0;
    let missileLaunches = 0;
    for (const event of prioritized) {
      if (event.type === 'blast') {
        if (event.abilityId === 'micro-missile') {
          if (microMissileBlasts >= 1) continue;
          microMissileBlasts += 1;
        } else if (event.abilityId === 'rocket-salvo-missile' || event.abilityId === 'siege-missile') {
          if (missileBarrageBlasts >= 1) continue;
          missileBarrageBlasts += 1;
        }
      }
      if (event.type === 'impact' && event.magnitude > 2.5) this.playImpact(event.magnitude);
      else if (event.type === 'wallImpact' && event.magnitude > 4.5) this.playWallImpact(event.magnitude);
      else if (event.type === 'obstacleImpact' && event.magnitude > 2) this.playImpact(event.magnitude * 0.72);
      else if (event.type === 'obstacleDestroyed') { this.playTone(125, 42, 0.32, 'square', 0.075); this.playPulseSequence(280, 0.18, 'triangle'); }
      else if (event.type === 'hazardTriggered') this.playHazard(event.kind, event.damage);
      else if (event.type === 'blast') this.playBlast(event);
      else if (event.type === 'abilityActivated') this.playAbilityCharge(event.abilityId, event.slot === 'ultimate', event.castTicks);
      else if (event.type === 'abilityResolved') this.playAbilityResolve(event);
      else if (event.type === 'weaponAttackStarted') this.playWeaponAttack(event);
      else if (event.type === 'weaponHit') this.playWeaponHit(event);
      else if (event.type === 'projectileSpawned') {
        const missile = event.weaponId.includes('rocket') || event.weaponId.includes('missile');
        if (missile && missileLaunches >= 3) continue;
        if (missile) missileLaunches += 1;
        if (!(event.weaponId === 'automatic-rifle' && focused.has(event.sourceId))) this.playProjectileSpawn(event);
      }
      else if (event.type === 'projectileImpact') this.playProjectileImpact(event);
      else if (event.type === 'death') this.playDeath();
    }
    this.diagnostics = { ...this.diagnostics, activeVoices: this.voices };
    return this.getDiagnostics();
  }

  getDiagnostics(): AudioDiagnostics {
    return { ...this.diagnostics, activeVoices: this.voices, voiceLimit: this.voiceLimit };
  }

  private selectPriorityEvents(events: readonly SimulationEvent[], limit: number): { events: SimulationEvent[]; considered: number } {
    const selected: Array<{ event: SimulationEvent; score: number }> = [];
    let considered = 0;
    for (const event of events) {
      const score = this.priority(event);
      if (score <= 0) continue;
      considered += 1;
      let insertAt = selected.length;
      while (insertAt > 0 && score > (selected[insertAt - 1]?.score ?? Number.NEGATIVE_INFINITY)) insertAt -= 1;
      if (insertAt >= limit) continue;
      selected.splice(insertAt, 0, { event, score });
      if (selected.length > limit) selected.pop();
    }
    return { events: selected.map((item) => item.event), considered };
  }

  private priority(event: SimulationEvent): number {
    if (event.type === 'death') return 100;
    if (event.type === 'blast') return Math.min(98, 65 + event.radius * 0.08 + event.force);
    if (event.type === 'obstacleDestroyed') return 88;
    if (event.type === 'hazardTriggered') return 48 + event.damage;
    if (event.type === 'obstacleImpact') return Math.min(72, event.magnitude * 3);
    if (event.type === 'wallImpact') return event.magnitude > 4.5 ? Math.min(78, 30 + event.magnitude * 3.4) : 0;
    if (event.type === 'abilityResolved') return event.slot === 'ultimate' ? 94 : 55;
    if (event.type === 'abilityActivated') return event.slot === 'ultimate' ? 90 : 48;
    if (event.type === 'weaponHit') return 70 + Math.min(18, event.damage * 0.6);
    if (event.type === 'projectileImpact') return event.weaponId.includes('rocket') || event.weaponId.includes('missile') ? 0 : 68;
    if (event.type === 'weaponAttackStarted') return event.category === 'throwable' ? 58 : event.category === 'ranged' || event.category === 'automatic' || event.category === 'beam' ? 54 : 46;
    if (event.type === 'projectileSpawned') return 52;
    if (event.type === 'impact') return Math.min(80, event.magnitude * 4);
    return 0;
  }


  private playWeaponAttack(event: WeaponAttackStartedEvent): void {
    if (event.weaponId === 'automatic-rifle') {
      this.playTone(170, 88, 0.055, 'triangle', 0.026);
      this.playTone(74, 52, 0.07, 'square', 0.018);
    } else if (event.category === 'ranged' || event.category === 'automatic' || event.category === 'beam') {
      this.playTone(520, 180, 0.075, 'square', 0.032);
    } else if (event.category === 'throwable') {
      this.playTone(190, 310, 0.12, 'triangle', 0.03);
    } else if (event.category === 'continuous' || event.category === 'spin' || event.category === 'orbit') {
      this.playMeleeWhoosh(0.82, true);
    } else {
      const sharp = event.weaponId.includes('sword') || event.weaponId.includes('spear') || event.weaponId.includes('halberd') || event.weaponId.includes('scythe') || event.weaponId.includes('claw');
      this.playMeleeWhoosh(sharp ? 1 : 0.72, false);
    }
  }

  private playWeaponHit(event: WeaponHitEvent): void {
    if (event.presentation === 'continuous') return;
    const heavy = event.weaponId === 'hydraulic-gauntlet' || event.weaponId === 'war-hammer';
    const sharp = event.weaponId === 'flame-fists' || event.weaponId === 'frost-halberd' || event.weaponId === 'void-scythe' || event.weaponId === 'duelist-sword' || event.weaponId === 'lancer-spear';
    if (heavy) {
      this.playTone(125, 38, 0.2, 'square', 0.085);
      this.playTone(310, 92, 0.1, 'triangle', 0.035);
    } else if (sharp) {
      this.playTone(760, 145, 0.085, 'sawtooth', 0.062);
      this.playTone(190, 72, 0.075, 'triangle', 0.035);
      this.playMetallicTick(0.85);
    } else {
      this.playTone(260, 72, 0.12, 'triangle', 0.042);
    }
  }

  private playProjectileSpawn(event: ProjectileSpawnedEvent): void {
    if (event.weaponId === 'demolition-bomb') this.playTone(150, 250, 0.13, 'triangle', 0.028);
    else if (event.weaponId === 'automatic-rifle') this.playAutomaticRifleCrack(false);
    else if (event.weaponId === 'arc-emitter') this.playTone(820, 210, 0.085, 'square', 0.05);
    else if (event.weaponId.includes('rocket') || event.weaponId.includes('missile')) {
      this.playTone(125, 310, 0.14, 'sawtooth', 0.055);
      this.playTone(72, 42, 0.17, 'triangle', 0.035);
    }
    else this.playTone(430, 170, 0.1, 'triangle', 0.035);
  }

  private playProjectileImpact(event: ProjectileImpactEvent): void {
    if (event.weaponId === 'demolition-bomb') this.playTone(115, 48, 0.16, 'square', 0.05);
    else if (event.weaponId === 'arc-emitter') this.playTone(630, 105, 0.09, 'square', 0.045);
    else if (event.weaponId.includes('rocket') || event.weaponId.includes('missile')) {
      this.playTone(108, 34, 0.22, 'square', 0.08);
      this.playTone(310, 74, 0.11, 'sawtooth', 0.035);
    }
    else this.playTone(470, 125, 0.11, 'triangle', 0.04);
  }

  private playHitmarker(amount: number): void {
    const strength = Math.max(0, Math.min(1, amount / 24));
    // Bright, crisp Call-of-Duty-style confirmation: a high metallic "tink"
    // layered on the noise click, with a fast attack and quick decay.
    this.playHitmarkerClick(strength * 1.05);
    this.playFocusTone(2550 + strength * 520, 1600, 0.03, 'square', 0.08 + strength * 0.03);
    this.playFocusTone(3550 + strength * 450, 2300, 0.022, 'triangle', 0.055 + strength * 0.02);
    this.playFocusTone(1250, 760, 0.04, 'triangle', 0.04 + strength * 0.018);
  }

  private playAiHitmarker(amount: number): void {
    // A lower, softer two-part confirmation than the player's bright tink, so
    // AI-vs-AI stays clearly distinct and readable without becoming audio spam.
    const strength = Math.max(0.16, Math.min(0.82, amount / 28));
    this.playHitmarkerClick(strength * 0.7);
    this.playFocusTone(1480 + strength * 240, 900, 0.032, 'square', 0.05 + strength * 0.02);
    this.playFocusTone(760, 430, 0.05, 'triangle', 0.03 + strength * 0.015);
  }

  private playHitmarkerClick(strength: number): void {
    if (!this.canPlayCritical()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = 0.018;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const progress = index / sampleCount;
      const envelope = Math.pow(1 - progress, 5.2);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = ctx.createBufferSource();
    const highpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    highpass.type = 'highpass';
    highpass.frequency.value = 1500;
    gain.gain.setValueAtTime(0.11 + strength * 0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration);
    this.trackVoice(source);
  }

  private playDamageReceived(amount: number): void {
    const strength = Math.max(0, Math.min(1, amount / 30));
    this.playFocusTone(168 - strength * 52, 46, 0.15 + strength * 0.06, 'sawtooth', 0.075 + strength * 0.04);
    this.playFocusTone(72, 38, 0.11, 'square', 0.04 + strength * 0.022);
  }

  private playWallImpact(magnitude: number): void {
    const now = performance.now();
    if (now - this.lastWallImpactAt < 55) return;
    this.lastWallImpactAt = now;
    const strength = Math.max(0, Math.min(1, (magnitude - 4) / 14));
    this.playTone(145 - strength * 65, 36, 0.13 + strength * 0.1, 'square', 0.045 + strength * 0.055);
    this.playTone(360, 92, 0.07, 'triangle', 0.022 + strength * 0.018);
  }

  private playImpact(magnitude: number): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = magnitude > 9 ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(Math.max(55, 160 - magnitude * 7), now);
    oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    gain.gain.setValueAtTime(Math.min(0.16, 0.025 + magnitude * 0.005), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
    this.trackVoice(oscillator);
  }

  private playBlast(event: BlastEvent): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = event.kind === 'explosion' ? Math.min(0.48, 0.18 + event.radius / 900) : 0.28;

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = event.kind === 'explosion' ? 'sawtooth' : 'sine';
    const baseFrequency = event.kind === 'explosion' ? Math.max(36, 78 - event.radius * 0.08) : 95;
    low.frequency.setValueAtTime(baseFrequency, now);
    low.frequency.exponentialRampToValueAtTime(event.kind === 'explosion' ? 28 : 48, now + duration);
    lowGain.gain.setValueAtTime(event.kind === 'explosion' ? 0.16 : 0.095, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    low.connect(lowGain);
    lowGain.connect(master);
    low.start(now);
    low.stop(now + duration + 0.02);
    this.trackVoice(low);

    if (this.voices >= this.voiceLimit) return;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      const envelope = Math.pow(1 - i / sampleCount, event.kind === 'explosion' ? 2.2 : 1.4);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = event.kind === 'explosion' ? 'lowpass' : 'bandpass';
    filter.frequency.value = event.kind === 'explosion' ? 950 : 1450;
    filter.Q.value = event.kind === 'explosion' ? 0.7 : 1.2;
    gain.gain.setValueAtTime(event.kind === 'explosion' ? 0.13 : 0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise);
  }

  private playAbilityCharge(abilityId: string, ultimate: boolean, castTicks: number): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = abilityId === 'solar-laser' ? Math.max(0.9, Math.min(1.8, castTicks / 60)) : Math.max(0.12, Math.min(0.75, castTicks / 60));
    const water = ['surge-dash', 'pressure-wave', 'undertow', 'tidal-cataclysm'].includes(abilityId);
    const bomber = ['blast-dash', 'concussion-bomb', 'shrapnel-burst', 'mega-bomb'].includes(abilityId);
    const fire = ['magma-dash', 'flame-ring', 'molten-guard', 'inferno-collapse'].includes(abilityId);
    const mech = ['kinetic-pulse', 'magnet-drag', 'fortify', 'reactor-overdrive'].includes(abilityId);
    const ice = ['glacier-charge', 'frost-nova', 'ice-anchor', 'absolute-zero'].includes(abilityId);
    const electric = ['lightning-dash', 'arc-burst', 'polarity-pull', 'thunder-dome'].includes(abilityId);
    const nature = ['bramble-charge', 'seed-burst', 'regenerate', 'overgrowth'].includes(abilityId);
    const voidSkill = ['phase-lunge', 'gravity-well', 'void-burst', 'singularity'].includes(abilityId);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = abilityId === 'mega-bomb' ? 'sawtooth' : bomber ? 'square' : fire ? 'sawtooth' : electric ? 'square' : voidSkill ? 'sine' : mech || ice || nature ? 'triangle' : water ? 'sine' : 'triangle';
    const startFrequency = abilityId === 'mega-bomb' ? 58 : abilityId === 'tidal-cataclysm' ? 120 : abilityId === 'reactor-overdrive' ? 92 : ice ? 410 : electric ? 520 : nature ? 135 : voidSkill ? 96 : fire ? 135 : mech ? 115 : bomber ? 105 : water ? 180 : 150;
    const endFrequency = abilityId === 'undertow' || abilityId === 'gravity-well' || abilityId === 'singularity' ? 48 : abilityId === 'mega-bomb' ? 42 : abilityId === 'inferno-collapse' ? 52 : startFrequency * (water ? 1.65 : electric ? 1.8 : ice ? 0.62 : nature ? 0.74 : mech ? 1.45 : 1.25);
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(ultimate ? 0.075 : 0.038, now + Math.min(0.15, duration * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator);

    if (['mega-bomb', 'tidal-cataclysm', 'inferno-collapse', 'reactor-overdrive', 'absolute-zero', 'thunder-dome', 'overgrowth', 'singularity', 'solar-laser'].includes(abilityId)) {
      const pulseFrequency = abilityId === 'mega-bomb' ? 82 : abilityId === 'tidal-cataclysm' ? 210 : abilityId === 'inferno-collapse' ? 120 : abilityId === 'absolute-zero' ? 480 : abilityId === 'thunder-dome' ? 620 : abilityId === 'overgrowth' ? 140 : abilityId === 'singularity' ? 68 : abilityId === 'solar-laser' ? 910 : 165;
      this.playPulseSequence(pulseFrequency, duration, abilityId === 'mega-bomb' ? 'square' : abilityId === 'inferno-collapse' ? 'sawtooth' : 'sine');
    }
  }

  private playAbilityResolve(event: AbilityResolvedEvent): void {
    if (!this.canPlay()) return;
    const id = event.abilityId;
    if (id === 'riptide-contact') this.playTone(330, 180, 0.09, 'sine', 0.035);
    else if (id === 'surge-dash') this.playTone(210, 520, 0.14, 'sine', 0.055);
    else if (id === 'pressure-wave') this.playTone(165, 82, 0.24, 'sine', 0.065);
    else if (id === 'undertow') this.playTone(120, 48, 0.32, 'triangle', 0.07);
    else if (id === 'tidal-cataclysm') {
      this.playTone(145, 48, 0.48, 'sine', 0.095);
      this.playTone(420, 95, 0.34, 'triangle', 0.045);
    } else if (id === 'blast-contact') this.playTone(150, 48, 0.11, 'square', 0.055);
    else if (id === 'blast-dash') this.playTone(95, 280, 0.15, 'sawtooth', 0.06);
    else if (id === 'concussion-bomb') this.playTone(105, 38, 0.25, 'square', 0.075);
    else if (id === 'shrapnel-burst') {
      this.playTone(250, 72, 0.18, 'sawtooth', 0.06);
      this.playPulseSequence(390, 0.18, 'square');
    } else if (id === 'mega-bomb') {
      this.playTone(74, 24, 0.62, 'sawtooth', 0.13);
      this.playTone(190, 42, 0.42, 'square', 0.055);
    } else if (id === 'ember-impact') this.playTone(175, 62, 0.11, 'sawtooth', 0.045);
    else if (id === 'flame-ring') { this.playTone(155, 42, 0.28, 'sawtooth', 0.075); this.playPulseSequence(270, 0.2, 'triangle'); }
    else if (id === 'molten-guard') this.playTone(120, 280, 0.36, 'triangle', 0.06);
    else if (id === 'steel-impact') this.playTone(230, 52, 0.13, 'triangle', 0.05);
    else if (id === 'magnet-drag') this.playTone(270, 48, 0.31, 'sine', 0.07);
    else if (id === 'fortify') { this.playTone(110, 240, 0.38, 'triangle', 0.065); this.playTone(420, 125, 0.22, 'sine', 0.03); }
    else if (id === 'magma-dash') {
      this.playTone(145, 420, 0.2, 'sawtooth', 0.065);
      this.playTone(72, 46, 0.18, 'triangle', 0.04);
    } else if (id === 'inferno-collapse') {
      this.playTone(118, 30, 0.5, 'sawtooth', 0.11);
      this.playTone(330, 72, 0.34, 'triangle', 0.05);
    } else if (id === 'kinetic-pulse') {
      this.playTone(210, 58, 0.28, 'triangle', 0.07);
      this.playTone(510, 120, 0.16, 'sine', 0.035);
    } else if (id === 'reactor-overdrive') {
      this.playTone(95, 360, 0.44, 'triangle', 0.08);
      this.playPulseSequence(185, 0.42, 'sine');
    } else if (id === 'frost-impact') this.playTone(620, 310, 0.11, 'triangle', 0.04);
    else if (id === 'glacier-charge') this.playTone(520, 150, 0.2, 'triangle', 0.06);
    else if (id === 'frost-nova') { this.playTone(680, 180, 0.3, 'sine', 0.065); this.playPulseSequence(760, 0.2, 'triangle'); }
    else if (id === 'ice-anchor') this.playTone(360, 120, 0.34, 'triangle', 0.065);
    else if (id === 'absolute-zero') { this.playTone(720, 55, 0.58, 'sine', 0.095); this.playTone(980, 190, 0.32, 'triangle', 0.04); }
    else if (id === 'static-strike') this.playTone(720, 260, 0.08, 'square', 0.035);
    else if (id === 'lightning-dash') this.playTone(420, 960, 0.13, 'square', 0.05);
    else if (id === 'arc-burst') { this.playTone(640, 120, 0.22, 'square', 0.065); this.playPulseSequence(820, 0.16, 'sine'); }
    else if (id === 'polarity-pull') this.playTone(480, 70, 0.3, 'sine', 0.065);
    else if (id === 'thunder-dome') { this.playTone(780, 52, 0.55, 'square', 0.1); this.playPulseSequence(960, 0.42, 'square'); }
    else if (id === 'thorn-impact') this.playTone(180, 82, 0.12, 'triangle', 0.04);
    else if (id === 'bramble-charge') this.playTone(145, 62, 0.24, 'sawtooth', 0.06);
    else if (id === 'seed-burst') { this.playTone(260, 95, 0.22, 'triangle', 0.055); this.playPulseSequence(350, 0.18, 'triangle'); }
    else if (id === 'regenerate') this.playTone(160, 360, 0.4, 'sine', 0.06);
    else if (id === 'overgrowth') { this.playTone(105, 42, 0.62, 'triangle', 0.1); this.playTone(260, 105, 0.42, 'sine', 0.045); }
    else if (id === 'phase-cut') this.playTone(310, 88, 0.1, 'sine', 0.04);
    else if (id === 'phase-lunge') this.playTone(180, 520, 0.14, 'sine', 0.05);
    else if (id === 'gravity-well') this.playTone(140, 34, 0.34, 'sine', 0.075);
    else if (id === 'void-burst') this.playTone(230, 48, 0.28, 'triangle', 0.075);
    else if (id === 'singularity') { this.playTone(96, 22, 0.68, 'sine', 0.115); this.playPulseSequence(72, 0.5, 'triangle'); }
    else if (id === 'solar-laser') { this.playTone(980, 120, 0.5, 'square', 0.18); this.playTone(1680, 220, 0.3, 'sawtooth', 0.12); this.playPulseSequence(1120, 0.55, 'square'); }
    else this.playTone(180, 320, 0.16, 'triangle', 0.045);
  }

  private playHazard(kind: 'ice' | 'water' | 'lava' | 'electric' | 'wind', damage: number): void {
    if (kind === 'lava') this.playTone(105, 38, 0.18, 'sawtooth', damage > 0 ? 0.05 : 0.025);
    else if (kind === 'electric') { this.playTone(420, 110, 0.11, 'square', 0.04); this.playTone(760, 260, 0.07, 'sine', 0.02); }
    else if (kind === 'water') this.playTone(245, 135, 0.13, 'sine', 0.025);
    else if (kind === 'ice') this.playTone(560, 290, 0.1, 'triangle', 0.025);
    else this.playTone(190, 310, 0.1, 'sine', 0.018);
  }

  private playAutomaticRifleCrack(focused = false): void {
    if (!(focused ? this.canPlayCritical() : this.canPlay())) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = 0.045;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = Math.pow(1 - index / sampleCount, 5.4);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = ctx.createBufferSource();
    const highpass = ctx.createBiquadFilter();
    const presence = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    highpass.type = 'highpass';
    highpass.frequency.value = 1250;
    presence.type = 'peaking';
    presence.frequency.value = 3300;
    presence.Q.value = 1.1;
    presence.gain.value = 5;
    gain.gain.setValueAtTime(focused ? 0.115 : 0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(highpass);
    highpass.connect(presence);
    presence.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise);
    if (focused) {
      this.playFocusTone(1180, 190, 0.042, 'square', 0.038);
      this.playFocusTone(135, 68, 0.06, 'triangle', 0.025);
    } else {
      this.playTone(980, 210, 0.038, 'square', 0.022);
    }
  }

  private playMeleeWhoosh(strength: number, spinning: boolean): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = spinning ? 0.16 : 0.105;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const progress = index / sampleCount;
      const envelope = Math.sin(Math.PI * progress) * Math.pow(1 - progress, spinning ? 0.65 : 1.15);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(spinning ? 780 : 1150, now);
    filter.frequency.exponentialRampToValueAtTime(spinning ? 260 : 430, now + duration);
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045 + strength * 0.045, now + duration * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise);
    this.playTone(spinning ? 310 : 520, spinning ? 92 : 150, duration * 0.75, 'triangle', 0.018 + strength * 0.012);
  }

  private playMetallicTick(strength: number): void {
    this.playTone(2100, 620, 0.045, 'square', 0.025 + strength * 0.018);
    this.playTone(980, 330, 0.06, 'triangle', 0.018 + strength * 0.012);
  }

  private playFocusTone(start: number, end: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.canPlayCritical()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator);
  }

  private playTone(start: number, end: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator);
  }

  private playPulseSequence(frequency: number, duration: number, type: OscillatorType): void {
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, now);
    const pulses = 4;
    for (let i = 0; i < pulses; i += 1) {
      const t = now + (i / pulses) * duration;
      gain.gain.linearRampToValueAtTime(0.025 + i * 0.008, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.04, duration / pulses * 0.72));
    }
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    this.trackVoice(oscillator);
  }

  private playDeath(): void {
    if (!this.canPlay()) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(90, now);
    oscillator.frequency.exponentialRampToValueAtTime(32, now + 0.3);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
    this.trackVoice(oscillator);
  }

  private canPlay(): boolean {
    return this.voices < this.voiceLimit;
  }

  private canPlayCritical(): boolean {
    return this.voices < this.voiceLimit + 6;
  }

  private trackVoice(node: AudioScheduledSourceNode): void {
    this.voices += 1;
    node.addEventListener('ended', () => { this.voices = Math.max(0, this.voices - 1); }, { once: true });
  }
}
