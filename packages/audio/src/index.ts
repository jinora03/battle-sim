import type { AbilityActivatedEvent, AbilityResolvedEvent, BlastEvent, ProjectileImpactEvent, ProjectileSpawnedEvent, SimulationEvent, WeaponAttackStartedEvent, WeaponHitEvent } from '@kinetic/protocol';
import {
  getAbilityCombatAudioProfile,
  resolveCombatAudioContact,
  resolveCombatAudioContactWindowTicks,
  resolveCombatAudioLayer,
  type ResolvedCombatAudioContact,
  type ResolvedCombatAudioLayer
} from './combatAudioProfiles';

export * from './combatAudioProfiles';

const RAPID_RIFLE_ROUNDS = new Set(['automatic-rifle', 'tactical-round', 'suppressive-round', 'kill-zone-round']);

interface CombatAudioPaletteTuning {
  low: number;
  mid: number;
  high: number;
  wave: OscillatorType;
  pulse: OscillatorType;
}

const COMBAT_AUDIO_PALETTE_TUNING: Readonly<Record<ResolvedCombatAudioLayer['palette'], CombatAudioPaletteTuning>> = {
  kinetic: { low: 82, mid: 260, high: 760, wave: 'triangle', pulse: 'square' },
  explosive: { low: 42, mid: 165, high: 1280, wave: 'sawtooth', pulse: 'square' },
  fire: { low: 58, mid: 180, high: 520, wave: 'sawtooth', pulse: 'triangle' },
  electric: { low: 52, mid: 620, high: 1180, wave: 'square', pulse: 'square' },
  gravity: { low: 34, mid: 96, high: 260, wave: 'sine', pulse: 'triangle' },
  mechanical: { low: 64, mid: 210, high: 920, wave: 'sawtooth', pulse: 'square' },
  water: { low: 78, mid: 245, high: 620, wave: 'sine', pulse: 'triangle' },
  ice: { low: 120, mid: 520, high: 1080, wave: 'triangle', pulse: 'sine' },
  nature: { low: 72, mid: 180, high: 460, wave: 'triangle', pulse: 'sine' },
  void: { low: 28, mid: 84, high: 310, wave: 'sine', pulse: 'triangle' },
  solar: { low: 110, mid: 720, high: 1680, wave: 'sawtooth', pulse: 'square' }
};

export function isGunnerRifleRound(weaponId: string): boolean {
  return RAPID_RIFLE_ROUNDS.has(weaponId) || weaponId === 'pinning-round-projectile';
}

export interface AudioDiagnostics {
  eventsConsidered: number;
  eventsSelected: number;
  activeVoices: number;
  voiceLimit: number;
}


export interface BattleAudioMix {
  eventLimit: number;
  voiceLimit: number;
  ambientGainScale: number;
  aiAbilityGainScale: number;
  criticalVoiceReserve: number;
  contactIntervalScale: number;
}

export function resolveBattleAudioMix(entityCount: number): BattleAudioMix {
  if (entityCount > 36) {
    return { eventLimit: 5, voiceLimit: 14, ambientGainScale: 0.62, aiAbilityGainScale: 0.52, criticalVoiceReserve: 6, contactIntervalScale: 2.25 };
  }
  if (entityCount > 12) {
    return { eventLimit: 7, voiceLimit: 18, ambientGainScale: 0.78, aiAbilityGainScale: 0.68, criticalVoiceReserve: 6, contactIntervalScale: 1.5 };
  }
  return { eventLimit: 10, voiceLimit: 22, ambientGainScale: 1, aiAbilityGainScale: 0.86, criticalVoiceReserve: 6, contactIntervalScale: 1 };
}

interface AudioVoiceReservation {
  startsAt: number;
  endsAt: number;
  critical: boolean;
}

interface ActiveContactAbility {
  abilityId: string;
  expiresAtTick: number;
}

export class BattleAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;
  private voiceLimit = 22;
  private criticalVoiceReserve = 6;
  private ambientGainScale = 1;
  private aiAbilityGainScale = 0.86;
  private contactIntervalScale = 1;
  private schedulingGainScale = 1;
  private schedulingGroupKey: string | undefined;
  private readonly voiceReservations: AudioVoiceReservation[] = [];
  private readonly sourceReservations = new WeakMap<AudioScheduledSourceNode, AudioVoiceReservation>();
  private readonly activeSources = new Set<AudioScheduledSourceNode>();
  private readonly abilitySources = new Map<string, Set<AudioScheduledSourceNode>>();
  private diagnostics: AudioDiagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: 22 };
  private lastHitmarkerAt = -Infinity;
  private lastAiHitmarkerAt = -Infinity;
  private lastDamageCueAt = -Infinity;
  private lastWallImpactAt = -Infinity;
  private lastFocusedRifleAt = -Infinity;
  private lastFocusedGatlingAt = -Infinity;
  private missileQuietUntilTick = -Infinity;
  private readonly focusedIds = new Set<number>();
  private readonly aiIds = new Set<number>();
  private readonly activeContactAbilities = new Map<number, ActiveContactAbility>();
  private readonly lastContactCueAt = new Map<number, number>();

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
    if (!enabled) this.reset();
  }

  reset(): void {
    this.cancelAllSources();
    this.voiceReservations.length = 0;
    this.activeContactAbilities.clear();
    this.lastContactCueAt.clear();
    this.missileQuietUntilTick = -Infinity;
    this.diagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: this.voiceLimit };
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
    const mix = resolveBattleAudioMix(entityCount);
    const eventLimit = mix.eventLimit;
    this.voiceLimit = mix.voiceLimit;
    this.criticalVoiceReserve = mix.criticalVoiceReserve;
    this.ambientGainScale = mix.ambientGainScale;
    this.aiAbilityGainScale = mix.aiAbilityGainScale;
    this.contactIntervalScale = mix.contactIntervalScale;

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
      this.diagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: this.getActiveVoiceCount(), voiceLimit: this.voiceLimit };
      return this.getDiagnostics();
    }

    let strongestPlayerHit = 0;
    let strongestPlayerDamage = 0;
    let strongestAiHit = 0;
    let currentTick = 0;
    let missileEvent = false;
    const contactDamageBySource = new Map<number, { abilityId: string; amount: number }>();

    for (const event of events) {
      currentTick = Math.max(currentTick, event.tick);
      if (event.type === 'abilityActivated') {
        const profile = getAbilityCombatAudioProfile(event.abilityId);
        const previousContact = this.activeContactAbilities.get(event.entityId);
        if (previousContact && previousContact.abilityId !== event.abilityId) {
          this.cancelAbilitySourceGroup(this.abilityGroupKey(event.entityId, previousContact.abilityId));
        }
        if (profile?.contact) {
          this.activeContactAbilities.set(event.entityId, {
            abilityId: event.abilityId,
            expiresAtTick: event.tick + resolveCombatAudioContactWindowTicks(profile, event.castTicks)
          });
        } else {
          this.activeContactAbilities.delete(event.entityId);
        }
      } else if (event.type === 'abilityResolved') {
        const profile = getAbilityCombatAudioProfile(event.abilityId);
        const activeContact = this.activeContactAbilities.get(event.entityId);
        if (activeContact?.abilityId === event.abilityId) this.activeContactAbilities.delete(event.entityId);
        if (profile?.cancelActivatedLayersOnResolve) {
          this.cancelAbilitySourceGroup(this.abilityGroupKey(event.entityId, event.abilityId));
        }
      } else if (event.type === 'death') {
        this.activeContactAbilities.delete(event.entityId);
        this.lastContactCueAt.delete(event.entityId);
        this.cancelAbilitySourcesForEntity(event.entityId);
      }

      if (event.type === 'projectileSpawned') {
        const missile = event.weaponId.includes('rocket') || event.weaponId.includes('missile');
        missileEvent ||= missile;
        if (RAPID_RIFLE_ROUNDS.has(event.weaponId) && focused.has(event.sourceId)) {
          const now = performance.now();
          if (event.weaponId === 'kill-zone-round') {
            if (now - this.lastFocusedGatlingAt >= 16) {
              this.lastFocusedGatlingAt = now;
              this.playGatlingRound(true);
            }
          } else if (now - this.lastFocusedRifleAt >= 20) {
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
      const activeContact = this.activeContactAbilities.get(event.sourceId);
      if (activeContact && event.tick > activeContact.expiresAtTick) {
        this.activeContactAbilities.delete(event.sourceId);
        this.cancelAbilitySourceGroup(this.abilityGroupKey(event.sourceId, activeContact.abilityId));
      } else if (activeContact) {
        const existing = contactDamageBySource.get(event.sourceId);
        if (!existing || event.amount > existing.amount) {
          contactDamageBySource.set(event.sourceId, { abilityId: activeContact.abilityId, amount: event.amount });
        }
      }
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

    if (currentTick > 0) {
      for (const [entityId, activeContact] of this.activeContactAbilities) {
        if (currentTick <= activeContact.expiresAtTick) continue;
        this.activeContactAbilities.delete(entityId);
        this.cancelAbilitySourceGroup(this.abilityGroupKey(entityId, activeContact.abilityId));
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
    for (const [sourceId, contactDamage] of contactDamageBySource) {
      const profile = getAbilityCombatAudioProfile(contactDamage.abilityId);
      const contact = profile ? resolveCombatAudioContact(profile) : undefined;
      if (!contact) continue;
      const lastAt = this.lastContactCueAt.get(sourceId) ?? -Infinity;
      if (now - lastAt < contact.intervalMs * this.contactIntervalScale) continue;
      this.lastContactCueAt.set(sourceId, now);
      this.playCombatAudioContact(contact, focused.has(sourceId), contactDamage.amount);
    }

    if (missileEvent) this.missileQuietUntilTick = Math.max(this.missileQuietUntilTick, currentTick + 72);
    const missileCascadeActive = currentTick > 0 && currentTick <= this.missileQuietUntilTick;
    const audioEvents = missileCascadeActive
      ? events.filter((event) => event.type !== 'impact' && event.type !== 'wallImpact' && event.type !== 'obstacleImpact' && event.type !== 'death')
      : events;
    const selection = this.selectPriorityEvents(audioEvents, eventLimit);
    const prioritized = selection.events;
    this.diagnostics = { eventsConsidered: selection.considered, eventsSelected: prioritized.length, activeVoices: this.getActiveVoiceCount(), voiceLimit: this.voiceLimit };
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
      const previousGainScale = this.schedulingGainScale;
      this.schedulingGainScale = this.resolveEventGainScale(event);
      try {
        if (event.type === 'impact' && event.magnitude > 2.5) this.playImpact(event.magnitude);
        else if (event.type === 'wallImpact' && event.magnitude > 4.5) this.playWallImpact(event.magnitude);
        else if (event.type === 'obstacleImpact' && event.magnitude > 2) this.playImpact(event.magnitude * 0.72);
        else if (event.type === 'obstacleDestroyed') { this.playTone(125, 42, 0.32, 'square', 0.075); this.playPulseSequence(280, 0.18, 'triangle'); }
        else if (event.type === 'hazardTriggered') this.playHazard(event.kind, event.damage);
        else if (event.type === 'blast') this.playBlast(event);
        else if (event.type === 'abilityActivated') this.playAbilityCharge(event);
        else if (event.type === 'abilityResolved') this.playAbilityResolve(event);
        else if (event.type === 'weaponAttackStarted') this.playWeaponAttack(event);
        else if (event.type === 'weaponHit') this.playWeaponHit(event);
        else if (event.type === 'projectileSpawned') {
          const missile = event.weaponId.includes('rocket') || event.weaponId.includes('missile');
          if (missile && missileLaunches >= 3) continue;
          if (missile) missileLaunches += 1;
          if (!(RAPID_RIFLE_ROUNDS.has(event.weaponId) && focused.has(event.sourceId))) this.playProjectileSpawn(event);
        }
        else if (event.type === 'projectileImpact') this.playProjectileImpact(event);
        else if (event.type === 'death') this.playDeath();
      } finally {
        this.schedulingGainScale = previousGainScale;
      }
    }
    this.diagnostics = { ...this.diagnostics, activeVoices: this.getActiveVoiceCount() };
    return this.getDiagnostics();
  }

  getDiagnostics(): AudioDiagnostics {
    return { ...this.diagnostics, activeVoices: this.getActiveVoiceCount(), voiceLimit: this.voiceLimit };
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
    let score = 0;
    if (event.type === 'death') score = 100;
    else if (event.type === 'blast') score = Math.min(98, 65 + event.radius * 0.08 + event.force);
    else if (event.type === 'obstacleDestroyed') score = 88;
    else if (event.type === 'hazardTriggered') score = 48 + event.damage;
    else if (event.type === 'obstacleImpact') score = Math.min(72, event.magnitude * 3);
    else if (event.type === 'wallImpact') score = event.magnitude > 4.5 ? Math.min(78, 30 + event.magnitude * 3.4) : 0;
    else if (event.type === 'abilityResolved') score = event.slot === 'ultimate' ? 112 : 55;
    else if (event.type === 'abilityActivated') score = event.slot === 'ultimate' ? 110 : 48;
    else if (event.type === 'weaponHit') score = 70 + Math.min(18, event.damage * 0.6);
    else if (event.type === 'projectileImpact') score = event.weaponId.includes('rocket') || event.weaponId.includes('missile') ? 0 : 68;
    else if (event.type === 'weaponAttackStarted') score = event.category === 'throwable' ? 58 : event.category === 'ranged' || event.category === 'automatic' || event.category === 'beam' ? 54 : 46;
    else if (event.type === 'projectileSpawned') score = 52;
    else if (event.type === 'impact') score = Math.min(80, event.magnitude * 4);

    const actorId = this.eventActorId(event);
    if (actorId !== undefined && this.focusedIds.has(actorId)) score += 14;
    return score;
  }

  private eventActorId(event: SimulationEvent): number | undefined {
    if (event.type === 'abilityActivated' || event.type === 'abilityResolved' || event.type === 'weaponAttackStarted' || event.type === 'death' || event.type === 'hazardTriggered') return event.entityId;
    if (event.type === 'blast' || event.type === 'weaponHit' || event.type === 'projectileSpawned' || event.type === 'projectileImpact') return event.sourceId;
    if (event.type === 'damage' || event.type === 'statusApplied') return event.sourceId;
    return undefined;
  }

  private resolveEventGainScale(event: SimulationEvent): number {
    const actorId = this.eventActorId(event);
    if (actorId !== undefined && this.focusedIds.has(actorId)) return 1.06;
    if (this.focusedIds.size === 0) return this.ambientGainScale;
    if ((event.type === 'abilityActivated' || event.type === 'abilityResolved') && event.slot === 'ultimate') {
      return Math.max(0.82, this.aiAbilityGainScale);
    }
    return this.aiAbilityGainScale;
  }



  private playWeaponAttack(event: WeaponAttackStartedEvent): void {
    if (event.weaponId === 'skip-stone') {
      this.playTone(132, 520, 0.12, 'sine', 0.04);
      this.playTone(760, 310, 0.065, 'triangle', 0.028);
    } else if (event.weaponId === 'automatic-rifle') {
      // A quiet mechanical commit leaves the four projectile cracks to define
      // the actual burst cadence instead of creating a fifth gunshot sound.
      this.playTone(760, 240, 0.035, 'square', 0.018);
      this.playMetallicTick(0.26);
    } else if (event.weaponId === 'demolition-bomb') {
      // Launcher arm plus fuse primer, kept lighter than the eventual blast.
      this.playTone(86, 210, 0.09, 'square', 0.03);
      this.playTone(980, 1540, 0.045, 'triangle', 0.018, 0.025);
      this.playMetallicTick(0.24);
    } else if (event.weaponId === 'hydraulic-gauntlet') {
      // Servo preload reads before the low piston impact on contact.
      this.playTone(115, 460, 0.13, 'sawtooth', 0.042);
      this.playTone(720, 210, 0.08, 'triangle', 0.022, 0.035);
    } else if (event.weaponId === 'solar-punch') {
      this.playTone(420, 1180, 0.09, 'sawtooth', 0.034);
      this.playTone(1480, 620, 0.045, 'triangle', 0.018);
    } else if (event.weaponId === 'arc-emitter') {
      // The capacitor commit stays below the launch transient so the basic
      // attack reads as charge -> discharge rather than two equal beeps.
      this.playTone(420, 980, 0.045, 'sine', 0.016);
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
    if (event.weaponId === 'solar-punch') {
      this.playTone(1320, 210, 0.1, 'sawtooth', 0.055);
      this.playTone(190, 58, 0.12, 'triangle', 0.04);
      return;
    }
    if (event.weaponId === 'hydraulic-gauntlet') {
      this.playTone(148, 34, 0.24, 'square', 0.092);
      this.playTone(420, 74, 0.13, 'sawtooth', 0.045);
      this.playTone(1720, 390, 0.055, 'triangle', 0.024);
      this.playMetallicTick(0.82);
      return;
    }
    const heavy = event.weaponId === 'war-hammer';
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
    if (event.weaponId === 'skip-stone') {
      this.playTone(210, 610, 0.11, 'sine', 0.035);
      this.playTone(980, 460, 0.05, 'triangle', 0.022);
    }
    else if (event.weaponId === 'demolition-bomb') {
      this.playTone(92, 340, 0.15, 'sawtooth', 0.046);
      this.playTone(1520, 920, 0.055, 'square', 0.022, 0.02);
      this.playPulseSequence(1180, 0.16, 'square', 0.025, 0.34);
    }
    else if (event.weaponId === 'kill-zone-round') this.playGatlingRound(false);
    else if (RAPID_RIFLE_ROUNDS.has(event.weaponId)) this.playAutomaticRifleCrack(false);
    else if (event.weaponId === 'pinning-round-projectile') this.playPinningRoundCrack();
    else if (event.weaponId === 'arc-emitter') this.playElectricProjectileLaunch();
    else if (event.weaponId.includes('rocket') || event.weaponId.includes('missile')) {
      this.playTone(125, 310, 0.14, 'sawtooth', 0.055);
      this.playTone(72, 42, 0.17, 'triangle', 0.035);
    }
    else this.playTone(430, 170, 0.1, 'triangle', 0.035);
  }

  private playProjectileImpact(event: ProjectileImpactEvent): void {
    if (event.weaponId === 'skip-stone') {
      this.playTone(148, 54, 0.13, 'triangle', 0.052);
      this.playTone(1240, 420, 0.055, 'sine', 0.026);
      this.playMetallicTick(0.58);
    }
    else if (event.weaponId === 'demolition-bomb') {
      this.playTone(1180, 76, 0.15, 'square', 0.056);
      this.playTone(92, 30, 0.24, 'sawtooth', 0.072);
      this.playMetallicTick(0.34);
    }
    else if (event.weaponId === 'kill-zone-round') {
      this.playTone(980, 310, 0.028, 'triangle', 0.014);
      this.playMetallicTick(0.12);
    }
    else if (RAPID_RIFLE_ROUNDS.has(event.weaponId)) {
      this.playTone(1250, 340, 0.035, 'triangle', 0.018);
      this.playMetallicTick(0.2);
    }
    else if (event.weaponId === 'pinning-round-projectile') {
      this.playTone(680, 105, 0.09, 'square', 0.045);
      this.playMetallicTick(0.62);
    }
    else if (event.weaponId === 'arc-emitter') this.playElectricProjectileImpact();
    else if (event.weaponId.includes('rocket') || event.weaponId.includes('missile')) {
      this.playTone(108, 34, 0.22, 'square', 0.08);
      this.playTone(310, 74, 0.11, 'sawtooth', 0.035);
    }
    else this.playTone(470, 125, 0.11, 'triangle', 0.04);
  }


  private playElectricProjectileLaunch(): void {
    // A short capacitive crack with a bright ionized tail. Kept deliberately
    // below skill gain so Arc Emitter remains readable without masking casts.
    this.playTone(1080, 290, 0.072, 'square', 0.044);
    this.playTone(1760, 720, 0.034, 'triangle', 0.019, 0.006);
  }

  private playElectricProjectileImpact(): void {
    // The low body distinguishes contact from launch while the high snap
    // communicates shocked-state application even when hitmarkers are busy.
    this.playTone(1320, 145, 0.085, 'square', 0.042);
    this.playTone(350, 58, 0.105, 'triangle', 0.025);
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
    const duration = 0.018;
    const reservation = this.reserveVoice(duration, 0, true);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
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
    gain.gain.setValueAtTime((0.11 + strength * 0.045) * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration);
    this.trackVoice(source, reservation);
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
    const reservation = this.reserveVoice(0.12);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = magnitude > 9 ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(Math.max(55, 160 - magnitude * 7), now);
    oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    gain.gain.setValueAtTime(Math.min(0.16, 0.025 + magnitude * 0.005) * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
    this.trackVoice(oscillator, reservation);
  }

  private playBlast(event: BlastEvent): void {
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = event.kind === 'explosion' ? Math.min(0.48, 0.18 + event.radius / 900) : 0.28;
    const lowReservation = this.reserveVoice(duration + 0.02);
    if (!lowReservation) return;

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = event.kind === 'explosion' ? 'sawtooth' : 'sine';
    const baseFrequency = event.kind === 'explosion' ? Math.max(36, 78 - event.radius * 0.08) : 95;
    low.frequency.setValueAtTime(baseFrequency, now);
    low.frequency.exponentialRampToValueAtTime(event.kind === 'explosion' ? 28 : 48, now + duration);
    lowGain.gain.setValueAtTime((event.kind === 'explosion' ? 0.16 : 0.095) * this.schedulingGainScale, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    low.connect(lowGain);
    lowGain.connect(master);
    low.start(now);
    low.stop(now + duration + 0.02);
    this.trackVoice(low, lowReservation);

    const noiseReservation = this.reserveVoice(duration);
    if (!noiseReservation) return;
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
    gain.gain.setValueAtTime((event.kind === 'explosion' ? 0.13 : 0.075) * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise, noiseReservation);
  }

  private playGatlingRound(focused: boolean): void {
    const gain = focused ? 0.072 : 0.045;
    this.playTone(138, 52, 0.045, 'square', gain);
    this.playTone(1780, 920, 0.018, 'triangle', gain * 0.48);
    if (focused) this.playMetallicTick(0.2);
  }

  private playAbilityCharge(event: AbilityActivatedEvent): void {
    const { abilityId, castTicks } = event;
    const ultimate = event.slot === 'ultimate';
    const profile = getAbilityCombatAudioProfile(abilityId);
    if (profile) {
      const groupKey = this.abilityGroupKey(event.entityId, abilityId);
      const focused = this.focusedIds.has(event.entityId);
      for (const phase of ['anticipation', 'activation', 'sustain', 'release'] as const) {
        const layer = resolveCombatAudioLayer(profile, phase, castTicks);
        if (layer?.anchor === 'activated') this.playCombatAudioLayer(layer, focused, groupKey);
      }
      return;
    }
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const duration = Math.max(0.12, Math.min(0.75, castTicks / 60));
    const reservation = this.reserveVoice(duration + 0.02, 0, ultimate);
    if (!reservation) return;
    const water = ['surge-dash', 'pressure-wave', 'undertow', 'tidal-cataclysm'].includes(abilityId);
    const ice = ['glacier-charge', 'frost-nova', 'ice-anchor', 'absolute-zero'].includes(abilityId);
    const electric = ['lightning-dash', 'arc-burst', 'polarity-pull'].includes(abilityId);
    const nature = ['bramble-charge', 'seed-burst', 'regenerate', 'overgrowth'].includes(abilityId);
    const voidSkill = ['phase-lunge', 'gravity-well', 'void-burst', 'singularity'].includes(abilityId);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = electric ? 'square' : voidSkill ? 'sine' : ice || nature ? 'triangle' : water ? 'sine' : 'triangle';
    const startFrequency = abilityId === 'tidal-cataclysm' ? 120 : ice ? 410 : electric ? 520 : nature ? 135 : voidSkill ? 96 : water ? 180 : 150;
    const endFrequency = abilityId === 'undertow' || abilityId === 'gravity-well' || abilityId === 'singularity' ? 48 : startFrequency * (water ? 1.65 : electric ? 1.8 : ice ? 0.62 : nature ? 0.74 : 1.25);
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime((ultimate ? 0.075 : 0.038) * this.schedulingGainScale, now + Math.min(0.15, duration * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator, reservation);

    if (['tidal-cataclysm', 'absolute-zero', 'overgrowth', 'singularity'].includes(abilityId)) {
      const pulseFrequency = abilityId === 'tidal-cataclysm' ? 210 : abilityId === 'absolute-zero' ? 480 : abilityId === 'overgrowth' ? 140 : 68;
      this.playPulseSequence(pulseFrequency, duration, 'sine');
    }
  }

  private playAbilityResolve(event: AbilityResolvedEvent): void {
    const profile = getAbilityCombatAudioProfile(event.abilityId);
    if (profile) {
      for (const phase of ['activation', 'sustain', 'release'] as const) {
        const layer = resolveCombatAudioLayer(profile, phase);
        if (layer?.anchor === 'resolved') this.playCombatAudioLayer(layer, this.focusedIds.has(event.entityId));
      }
      return;
    }
    const id = event.abilityId;
    if (id === 'riptide-contact') this.playTone(330, 180, 0.09, 'sine', 0.035);
    else if (id === 'surge-dash') this.playTone(210, 520, 0.14, 'sine', 0.055);
    else if (id === 'pressure-wave') this.playTone(165, 82, 0.24, 'sine', 0.065);
    else if (id === 'undertow') this.playTone(120, 48, 0.32, 'triangle', 0.07);
    else if (id === 'tidal-cataclysm') {
      this.playTone(145, 48, 0.48, 'sine', 0.095);
      this.playTone(420, 95, 0.34, 'triangle', 0.045);
    } else if (id === 'blast-contact') this.playTone(150, 48, 0.11, 'square', 0.055);
    else if (id === 'ember-impact') this.playTone(175, 62, 0.11, 'sawtooth', 0.045);
    else if (id === 'steel-impact') this.playTone(230, 52, 0.13, 'triangle', 0.05);
    else if (id === 'frost-impact') this.playTone(620, 310, 0.11, 'triangle', 0.04);
    else if (id === 'glacier-charge') this.playTone(520, 150, 0.2, 'triangle', 0.06);
    else if (id === 'frost-nova') { this.playTone(680, 180, 0.3, 'sine', 0.065); this.playPulseSequence(760, 0.2, 'triangle'); }
    else if (id === 'ice-anchor') this.playTone(360, 120, 0.34, 'triangle', 0.065);
    else if (id === 'absolute-zero') { this.playTone(720, 55, 0.58, 'sine', 0.095); this.playTone(980, 190, 0.32, 'triangle', 0.04); }
    else if (id === 'static-strike') this.playTone(720, 260, 0.08, 'square', 0.035);
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
    else this.playTone(180, 320, 0.16, 'triangle', 0.045);
  }

  private playCombatAudioLayer(
    layer: ResolvedCombatAudioLayer,
    focused = false,
    groupKey?: string
  ): void {
    const previousGainScale = this.schedulingGainScale;
    const previousGroupKey = this.schedulingGroupKey;
    this.schedulingGainScale = this.resolveAbilityGainScale(layer, focused);
    this.schedulingGroupKey = groupKey;
    try {
      const palette = COMBAT_AUDIO_PALETTE_TUNING[layer.palette];
      const volume = 0.085 * layer.gainScale;
      const duration = layer.durationSeconds;
      const delay = layer.delaySeconds;
      const critical = layer.hierarchy === 'ultimate' && (layer.phase === 'anticipation' || layer.phase === 'activation');

      if (layer.phase === 'anticipation') {
        const start = layer.intent === 'pull' ? palette.mid : layer.intent === 'status-application' ? palette.mid * 0.82 : palette.low;
        const end = layer.intent === 'pull' ? palette.low : palette.high;
        this.playTone(start, end, duration, palette.wave, volume * 0.72, delay, critical);
        if (layer.palette === 'explosive') {
          this.playPulseSequence(palette.high * 0.82, duration, palette.pulse, delay, 0.52 * layer.gainScale, critical);
          this.playTone(palette.low * 1.4, palette.mid * 0.9, duration, 'sawtooth', volume * 0.34, delay, critical);
        } else if (layer.intent === 'pull') {
          this.playPulseSequence(palette.low * 1.2, duration, palette.pulse, delay, 0.52 * layer.gainScale, critical);
        } else if (layer.intent === 'status-application') {
          this.playPulseSequence(palette.high * 0.82, duration, palette.pulse, delay, 0.42 * layer.gainScale, critical);
        } else if (layer.intent === 'ultimate' || layer.intent === 'channel' || layer.intent === 'transformation') {
          this.playPulseSequence(palette.mid, duration, palette.pulse, delay, 0.75 * layer.gainScale, critical);
          if (layer.intent === 'transformation' && layer.palette === 'mechanical') {
            this.playTone(palette.mid, palette.high * 1.16, duration * 0.9, 'triangle', volume * 0.42, delay, critical);
          }
        }
        return;
      }

      if (layer.phase === 'activation') {
        if (layer.intent === 'explosion' || layer.intent === 'knockback') {
          this.playTone(palette.high, palette.low, duration, palette.wave, volume * 1.18, delay, critical);
          this.playTone(palette.low * 1.35, Math.max(24, palette.low * 0.56), duration * 1.08, 'triangle', volume * 0.78, delay, critical);
          if (layer.palette === 'explosive') {
            this.playTone(palette.high * 1.55, palette.mid * 0.9, duration * 0.24, 'square', volume * 0.52, delay, critical);
            this.playPulseSequence(palette.mid, duration * 0.78, 'square', delay + 0.015, 0.38 * layer.gainScale, critical);
          }
        } else if (layer.intent === 'pull') {
          this.playTone(palette.mid, palette.low, duration, palette.wave, volume * 1.02, delay, critical);
          this.playTone(palette.low * 1.4, Math.max(24, palette.low * 0.62), duration * 1.1, 'sine', volume * 0.58, delay, critical);
        } else if (layer.intent === 'projectile') {
          this.playTone(palette.high, palette.mid * 0.62, duration * 0.74, palette.wave, volume, delay, critical);
          this.playTone(palette.high * 1.35, palette.high * 0.72, duration * 0.36, 'triangle', volume * 0.42, delay, critical);
        } else if (layer.intent === 'beam') {
          this.playTone(palette.high * 1.12, palette.mid * 0.72, duration, palette.wave, volume * 1.08, delay, critical);
          this.playTone(palette.mid * 1.3, palette.low * 1.1, duration * 1.15, 'triangle', volume * 0.54, delay, critical);
        } else if (layer.intent === 'burst-fire') {
          this.playPulseSequence(palette.high, duration, palette.pulse, delay, 1.05 * layer.gainScale, critical);
          this.playTone(palette.mid, palette.low, duration * 0.7, palette.wave, volume, delay, critical);
        } else {
          this.playTone(palette.mid, palette.high, duration, palette.wave, volume, delay, critical);
        }
        return;
      }

      if (layer.phase === 'sustain') {
        const pulseFrequency = layer.intent === 'pull' ? palette.low : palette.mid;
        this.playPulseSequence(pulseFrequency, duration, palette.pulse, delay, 0.9 * layer.gainScale, critical);
        if (layer.intent === 'pull') {
          this.playTone(palette.low * 1.55, palette.low * 0.78, duration, 'sine', volume * 0.44, delay, critical);
        } else if (layer.intent === 'beam' || layer.intent === 'channel' || layer.intent === 'transformation') {
          this.playTone(palette.mid * 0.82, palette.mid * 1.16, duration, palette.wave, volume * 0.48, delay, critical);
        } else if (layer.intent === 'burst-fire') {
          this.playTone(palette.low * 1.35, palette.mid * 0.78, duration, palette.wave, volume * 0.38, delay, critical);
        }
        return;
      }

      if (layer.intent === 'beam') {
        this.playTone(palette.high, palette.mid * 0.72, duration * 0.62, palette.wave, volume * 0.78, delay, critical);
        this.playTone(palette.mid, palette.low, duration, 'triangle', volume * 0.52, delay, critical);
        return;
      }

      const releaseStart = layer.intent === 'status-application' ? palette.high : palette.mid;
      if (layer.intent === 'knockback' || layer.intent === 'explosion') {
        this.playTone(palette.mid, palette.low, duration, palette.wave, volume, delay, critical);
        this.playTone(palette.low * 1.25, Math.max(24, palette.low * 0.5), duration * 0.8, 'triangle', volume * 0.58, delay, critical);
        if (layer.palette === 'explosive') {
          this.playTone(palette.high * 0.72, palette.low * 0.8, duration * 0.62, 'sawtooth', volume * 0.34, delay + 0.025, critical);
        }
      } else {
        this.playTone(releaseStart, palette.low, duration, palette.wave, volume * 0.82, delay, critical);
        if (layer.intent === 'transformation') {
          this.playTone(palette.high * 0.72, palette.low * 0.84, duration * 0.76, palette.pulse, volume * 0.36, delay, critical);
        }
      }
      if (layer.intent === 'ultimate' || layer.intent === 'status-application') {
        this.playTone(palette.high * 1.08, palette.mid * 0.72, duration * 0.58, 'triangle', volume * 0.42, delay, critical);
      }
    } finally {
      this.schedulingGainScale = previousGainScale;
      this.schedulingGroupKey = previousGroupKey;
    }
  }

  private resolveAbilityGainScale(layer: ResolvedCombatAudioLayer, focused: boolean): number {
    if (focused) return 1.08;
    if (this.focusedIds.size === 0) {
      return layer.hierarchy === 'ultimate' ? Math.max(0.88, this.ambientGainScale) : this.ambientGainScale;
    }
    return layer.hierarchy === 'ultimate' ? Math.max(0.82, this.aiAbilityGainScale) : this.aiAbilityGainScale;
  }

  private playCombatAudioContact(
    contact: ResolvedCombatAudioContact,
    focused: boolean,
    damage: number
  ): void {
    const palette = COMBAT_AUDIO_PALETTE_TUNING[contact.palette];
    const damageScale = Math.max(0.75, Math.min(1.16, damage / 4));
    const focusScale = focused ? 1.14 : 0.86;
    const crowdScale = focused ? 1 : this.focusedIds.size === 0 ? this.ambientGainScale : this.aiAbilityGainScale;
    const volume = 0.038 * contact.gainScale * damageScale * focusScale * crowdScale;
    this.playTone(
      palette.high * 1.08,
      palette.mid * 0.84,
      contact.durationSeconds,
      palette.pulse,
      volume,
      0,
      focused
    );
  }

  private playHazard(kind: 'ice' | 'water' | 'lava' | 'electric' | 'wind', damage: number): void {
    if (kind === 'lava') this.playTone(105, 38, 0.18, 'sawtooth', damage > 0 ? 0.05 : 0.025);
    else if (kind === 'electric') { this.playTone(420, 110, 0.11, 'square', 0.04); this.playTone(760, 260, 0.07, 'sine', 0.02); }
    else if (kind === 'water') this.playTone(245, 135, 0.13, 'sine', 0.025);
    else if (kind === 'ice') this.playTone(560, 290, 0.1, 'triangle', 0.025);
    else this.playTone(190, 310, 0.1, 'sine', 0.018);
  }

  private playPinningRoundCrack(): void {
    this.playAutomaticRifleCrack(false);
    this.playTone(210, 72, 0.085, 'square', 0.05);
    this.playMetallicTick(0.72);
  }

  private playAutomaticRifleCrack(focused = false): void {
    const duration = 0.045;
    const reservation = this.reserveVoice(duration, 0, focused);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
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
    gain.gain.setValueAtTime((focused ? 0.115 : 0.085) * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(highpass);
    highpass.connect(presence);
    presence.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise, reservation);
    if (focused) {
      this.playFocusTone(1180, 190, 0.042, 'square', 0.038);
      this.playFocusTone(135, 68, 0.06, 'triangle', 0.025);
    } else {
      this.playTone(980, 210, 0.038, 'square', 0.022);
    }
  }

  private playMeleeWhoosh(strength: number, spinning: boolean): void {
    const duration = spinning ? 0.16 : 0.105;
    const reservation = this.reserveVoice(duration);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
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
    gain.gain.linearRampToValueAtTime((0.045 + strength * 0.045) * this.schedulingGainScale, now + duration * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise, reservation);
    this.playTone(spinning ? 310 : 520, spinning ? 92 : 150, duration * 0.75, 'triangle', 0.018 + strength * 0.012);
  }

  private playMetallicTick(strength: number): void {
    this.playTone(2100, 620, 0.045, 'square', 0.025 + strength * 0.018);
    this.playTone(980, 330, 0.06, 'triangle', 0.018 + strength * 0.012);
  }

  private playFocusTone(start: number, end: number, duration: number, type: OscillatorType, volume: number): void {
    const reservation = this.reserveVoice(duration + 0.02, 0, true);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator, reservation);
  }

  private playTone(start: number, end: number, duration: number, type: OscillatorType, volume: number, delaySeconds = 0, critical = false): void {
    const delay = Math.max(0, delaySeconds);
    const reservation = this.reserveVoice(duration + 0.02, delay, critical);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator, reservation);
  }

  private playPulseSequence(frequency: number, duration: number, type: OscillatorType, delaySeconds = 0, volumeScale = 1, critical = false): void {
    const delay = Math.max(0, delaySeconds);
    const reservation = this.reserveVoice(duration + 0.03, delay, critical);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, now);
    const pulses = 4;
    for (let i = 0; i < pulses; i += 1) {
      const t = now + (i / pulses) * duration;
      gain.gain.linearRampToValueAtTime((0.025 + i * 0.008) * volumeScale * this.schedulingGainScale, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.04, duration / pulses * 0.72));
    }
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    this.trackVoice(oscillator, reservation);
  }

  private playDeath(): void {
    const duration = 0.34;
    const reservation = this.reserveVoice(duration);
    if (!reservation) return;
    const ctx = this.context!;
    const master = this.master!;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(90, now);
    oscillator.frequency.exponentialRampToValueAtTime(32, now + 0.3);
    gain.gain.setValueAtTime(0.14 * this.schedulingGainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration);
    this.trackVoice(oscillator, reservation);
  }

  private reserveVoice(durationSeconds: number, delaySeconds = 0, critical = false): AudioVoiceReservation | undefined {
    const ctx = this.context;
    if (!ctx) return undefined;
    const now = ctx.currentTime;
    this.pruneVoiceReservations(now);
    const startsAt = now + Math.max(0, delaySeconds);
    const endsAt = startsAt + Math.max(0.01, durationSeconds);
    const overlap = this.voiceReservations.reduce((count, reservation) => (
      reservation.startsAt < endsAt && reservation.endsAt > startsAt ? count + 1 : count
    ), 0);
    const limit = this.voiceLimit + (critical ? this.criticalVoiceReserve : 0);
    if (overlap >= limit) return undefined;
    const reservation = { startsAt, endsAt, critical };
    this.voiceReservations.push(reservation);
    return reservation;
  }

  private pruneVoiceReservations(now = this.context?.currentTime ?? 0): void {
    let write = 0;
    for (const reservation of this.voiceReservations) {
      if (reservation.endsAt <= now) continue;
      this.voiceReservations[write] = reservation;
      write += 1;
    }
    this.voiceReservations.length = write;
  }

  private getActiveVoiceCount(): number {
    const now = this.context?.currentTime ?? 0;
    this.pruneVoiceReservations(now);
    let active = 0;
    for (const reservation of this.voiceReservations) {
      if (reservation.startsAt <= now && reservation.endsAt > now) active += 1;
    }
    return active;
  }

  private trackVoice(node: AudioScheduledSourceNode, reservation: AudioVoiceReservation): void {
    this.sourceReservations.set(node, reservation);
    this.activeSources.add(node);
    const groupKey = this.schedulingGroupKey;
    if (groupKey) {
      let sources = this.abilitySources.get(groupKey);
      if (!sources) {
        sources = new Set<AudioScheduledSourceNode>();
        this.abilitySources.set(groupKey, sources);
      }
      sources.add(node);
    }
    node.addEventListener('ended', () => {
      this.activeSources.delete(node);
      reservation.endsAt = Math.min(reservation.endsAt, this.context?.currentTime ?? reservation.endsAt);
      if (!groupKey) return;
      const sources = this.abilitySources.get(groupKey);
      sources?.delete(node);
      if (sources?.size === 0) this.abilitySources.delete(groupKey);
    }, { once: true });
  }

  private abilityGroupKey(entityId: number, abilityId: string): string {
    return `${entityId}:${abilityId}`;
  }

  private cancelAbilitySourceGroup(groupKey: string): void {
    const sources = this.abilitySources.get(groupKey);
    if (!sources) return;
    const now = this.context?.currentTime ?? 0;
    for (const source of sources) {
      const reservation = this.sourceReservations.get(source);
      if (reservation) reservation.endsAt = Math.min(reservation.endsAt, now);
      try { source.stop(now); } catch { /* Source already ended or was never started. */ }
      this.activeSources.delete(source);
    }
    this.abilitySources.delete(groupKey);
  }

  private cancelAbilitySourcesForEntity(entityId: number): void {
    const prefix = `${entityId}:`;
    for (const groupKey of [...this.abilitySources.keys()]) {
      if (groupKey.startsWith(prefix)) this.cancelAbilitySourceGroup(groupKey);
    }
  }

  private cancelAllAbilitySources(): void {
    for (const groupKey of [...this.abilitySources.keys()]) this.cancelAbilitySourceGroup(groupKey);
  }

  private cancelAllSources(): void {
    const now = this.context?.currentTime ?? 0;
    for (const source of [...this.activeSources]) {
      const reservation = this.sourceReservations.get(source);
      if (reservation) reservation.endsAt = Math.min(reservation.endsAt, now);
      try { source.stop(now); } catch { /* Source already ended or was never started. */ }
    }
    this.activeSources.clear();
    this.abilitySources.clear();
  }

}
