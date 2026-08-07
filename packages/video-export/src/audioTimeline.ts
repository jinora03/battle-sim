import {
  COMBAT_AUDIO_PHASES,
  getAbilityCombatAudioProfile,
  resolveCombatAudioLayer,
  type ResolvedCombatAudioLayer
} from '@kinetic/audio';
import { getArena } from '@kinetic/content';
import type { BattleDefinition, SimulationEvent, Vec2 } from '@kinetic/protocol';

export type ReplayAudioWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

export interface ReplayAudioCue {
  id: string;
  startsAtSeconds: number;
  durationSeconds: number;
  waveform: ReplayAudioWaveform;
  startFrequency: number;
  endFrequency: number;
  gain: number;
  pan: number;
  attackSeconds: number;
  releaseSeconds: number;
  seed: number;
}

interface PaletteTuning {
  low: number;
  mid: number;
  high: number;
  waveform: Exclude<ReplayAudioWaveform, 'noise'>;
}

const PALETTE_TUNING: Readonly<Record<ResolvedCombatAudioLayer['palette'], PaletteTuning>> = {
  kinetic: { low: 82, mid: 260, high: 760, waveform: 'triangle' },
  explosive: { low: 42, mid: 165, high: 1280, waveform: 'sawtooth' },
  fire: { low: 58, mid: 180, high: 520, waveform: 'sawtooth' },
  electric: { low: 52, mid: 620, high: 1180, waveform: 'square' },
  gravity: { low: 34, mid: 96, high: 260, waveform: 'sine' },
  mechanical: { low: 64, mid: 210, high: 920, waveform: 'sawtooth' },
  water: { low: 78, mid: 245, high: 620, waveform: 'sine' },
  ice: { low: 120, mid: 520, high: 1080, waveform: 'triangle' },
  nature: { low: 72, mid: 180, high: 460, waveform: 'triangle' },
  void: { low: 38, mid: 115, high: 430, waveform: 'sine' },
  solar: { low: 96, mid: 360, high: 920, waveform: 'sawtooth' }
};

const MAX_CUES_PER_TICK = 14;

export class ReplayAudioTimeline {
  private readonly cues: ReplayAudioCue[] = [];
  private readonly cueKeys = new Set<string>();
  private readonly arenaWidth: number;
  private readonly battleSeed: number;

  constructor(battle: BattleDefinition) {
    this.arenaWidth = Math.max(1, getArena(battle.arenaId).width);
    this.battleSeed = battle.seed;
  }

  addEvents(events: readonly SimulationEvent[]): void {
    const byTick = new Map<number, SimulationEvent[]>();
    for (const event of events) {
      const tickEvents = byTick.get(event.tick);
      if (tickEvents) tickEvents.push(event);
      else byTick.set(event.tick, [event]);
    }
    for (const [tick, tickEvents] of byTick) this.addTickEvents(tick, tickEvents);
  }

  finalize(): readonly ReplayAudioCue[] {
    return this.cues.slice().sort((a, b) => a.startsAtSeconds - b.startsAtSeconds || compareIds(a.id, b.id));
  }

  private addTickEvents(tick: number, events: readonly SimulationEvent[]): void {
    let cueBudget = MAX_CUES_PER_TICK;
    let strongestDamage = 0;
    let strongestDamagePosition: Vec2 | undefined;
    let missileBlast = false;
    for (const event of events) {
      if (event.type === 'blast' && isMissileAbility(event.abilityId)) missileBlast = true;
    }

    for (const event of events) {
      if (cueBudget <= 0) break;
      const before = this.cues.length;
      if (event.type === 'abilityActivated') {
        this.addAbilityLayers(event.abilityId, 'activated', event.tick, event.position, event.castTicks, event.entityId);
      } else if (event.type === 'abilityResolved') {
        this.addAbilityLayers(event.abilityId, 'resolved', event.tick, event.position, 0, event.entityId);
      } else if (event.type === 'blast') {
        this.addExplosion(event.tick, event.position, event.radius, event.force, event.sourceId, event.abilityId ?? 'blast');
      } else if (event.type === 'projectileSpawned') {
        this.addProjectileLaunch(event.tick, event.position, event.weaponId, event.sourceId, event.projectileId);
      } else if (event.type === 'projectileImpact') {
        if (!(missileBlast && isMissileWeapon(event.weaponId))) {
          this.addImpact(event.tick, event.position, isMissileWeapon(event.weaponId) ? 0.72 : 0.42, event.sourceId, event.weaponId);
        }
      } else if (event.type === 'weaponAttackStarted') {
        this.addWeaponCommit(event.tick, event.position, event.category, event.entityId, event.weaponId);
      } else if (event.type === 'weaponHit' && event.presentation !== 'continuous') {
        this.addImpact(event.tick, event.position, Math.min(1, 0.34 + event.damage / 180), event.sourceId, event.weaponId);
      } else if (event.type === 'damage' && !event.prevented && event.amount > strongestDamage) {
        strongestDamage = event.amount;
        strongestDamagePosition = event.position;
      } else if (event.type === 'death') {
        this.addDeath(event.tick, event.position, event.entityId);
      } else if (event.type === 'battleEnded') {
        this.addBattleResult(event.tick, event.winningTeam ?? 0);
      }
      cueBudget -= this.cues.length - before;
    }

    if (strongestDamage > 0 && cueBudget > 0) {
      this.addHitmarker(tick, strongestDamagePosition, strongestDamage);
    }
  }

  private addAbilityLayers(
    abilityId: string,
    anchor: 'activated' | 'resolved',
    tick: number,
    position: Vec2,
    castTicks: number,
    entityId: number
  ): void {
    const profile = getAbilityCombatAudioProfile(abilityId);
    if (!profile) {
      this.addCue({
        id: `${tick}:ability:${entityId}:${abilityId}:${anchor}`,
        tick,
        position,
        delaySeconds: 0,
        durationSeconds: anchor === 'activated' ? 0.16 : 0.2,
        waveform: 'triangle',
        startFrequency: anchor === 'activated' ? 190 : 310,
        endFrequency: anchor === 'activated' ? 340 : 120,
        gain: 0.065,
        seedSalt: hashString(abilityId)
      });
      return;
    }
    for (const phase of COMBAT_AUDIO_PHASES) {
      const layer = resolveCombatAudioLayer(profile, phase, castTicks);
      if (!layer || layer.anchor !== anchor) continue;
      this.addProfileLayer(tick, position, entityId, layer);
    }
  }

  private addProfileLayer(tick: number, position: Vec2, entityId: number, layer: ResolvedCombatAudioLayer): void {
    const tuning = PALETTE_TUNING[layer.palette];
    const direction = layer.phase === 'anticipation' || layer.intent === 'pull' ? 1 : -1;
    const startFrequency = direction > 0 ? tuning.low : tuning.high;
    const endFrequency = direction > 0 ? tuning.mid : tuning.low;
    const baseGain = 0.055 * layer.gainScale;
    const id = `${tick}:profile:${entityId}:${layer.abilityId}:${layer.phase}:${layer.anchor}`;
    this.addCue({
      id,
      tick,
      position,
      delaySeconds: layer.delaySeconds,
      durationSeconds: layer.durationSeconds,
      waveform: tuning.waveform,
      startFrequency,
      endFrequency,
      gain: baseGain,
      seedSalt: hashString(`${layer.abilityId}:${layer.phase}`)
    });

    if (layer.intent === 'explosion' || layer.intent === 'ultimate' || layer.variant?.includes('collapse') || layer.variant?.includes('finale')) {
      this.addCue({
        id: `${id}:body`,
        tick,
        position,
        delaySeconds: layer.delaySeconds,
        durationSeconds: Math.min(0.75, layer.durationSeconds * 1.18),
        waveform: 'noise',
        startFrequency: tuning.low,
        endFrequency: tuning.low,
        gain: baseGain * 0.72,
        seedSalt: hashString(`${layer.abilityId}:${layer.phase}:noise`)
      });
    } else if (layer.intent === 'channel' || layer.intent === 'burst-fire' || layer.variant?.includes('flow')) {
      this.addCue({
        id: `${id}:texture`,
        tick,
        position,
        delaySeconds: layer.delaySeconds + 0.012,
        durationSeconds: layer.durationSeconds,
        waveform: layer.intent === 'burst-fire' ? 'square' : 'sine',
        startFrequency: tuning.mid,
        endFrequency: tuning.high,
        gain: baseGain * 0.38,
        seedSalt: hashString(`${layer.abilityId}:${layer.phase}:texture`)
      });
    }
  }

  private addExplosion(tick: number, position: Vec2, radius: number, force: number, sourceId: number, id: string): void {
    const strength = Math.max(0.45, Math.min(1.25, radius / 260 + force / 28));
    this.addCue({
      id: `${tick}:blast:${sourceId}:${id}:low`, tick, position, delaySeconds: 0, durationSeconds: 0.42,
      waveform: 'sawtooth', startFrequency: 92, endFrequency: 28, gain: 0.105 * strength, seedSalt: 91
    });
    this.addCue({
      id: `${tick}:blast:${sourceId}:${id}:noise`, tick, position, delaySeconds: 0.006, durationSeconds: 0.32,
      waveform: 'noise', startFrequency: 0, endFrequency: 0, gain: 0.075 * strength, seedSalt: 191
    });
  }

  private addProjectileLaunch(tick: number, position: Vec2, weaponId: string, sourceId: number, projectileId: number): void {
    const missile = isMissileWeapon(weaponId);
    this.addCue({
      id: `${tick}:projectile:${sourceId}:${projectileId}`,
      tick,
      position,
      delaySeconds: 0,
      durationSeconds: missile ? 0.16 : 0.045,
      waveform: missile ? 'sawtooth' : 'square',
      startFrequency: missile ? 120 : 1550,
      endFrequency: missile ? 330 : 520,
      gain: missile ? 0.055 : 0.027,
      seedSalt: hashString(weaponId) ^ projectileId
    });
  }

  private addWeaponCommit(tick: number, position: Vec2, category: string, entityId: number, weaponId: string): void {
    const ranged = category === 'ranged' || category === 'automatic' || category === 'beam';
    this.addCue({
      id: `${tick}:weapon:${entityId}:${weaponId}`,
      tick,
      position,
      delaySeconds: 0,
      durationSeconds: ranged ? 0.055 : 0.11,
      waveform: ranged ? 'square' : 'triangle',
      startFrequency: ranged ? 760 : 340,
      endFrequency: ranged ? 190 : 95,
      gain: ranged ? 0.026 : 0.038,
      seedSalt: hashString(weaponId)
    });
  }

  private addImpact(tick: number, position: Vec2, strength: number, sourceId: number, id: string): void {
    this.addCue({
      id: `${tick}:impact:${sourceId}:${id}`,
      tick,
      position,
      delaySeconds: 0,
      durationSeconds: 0.1 + 0.08 * strength,
      waveform: 'triangle',
      startFrequency: 420 + 250 * strength,
      endFrequency: 68,
      gain: 0.045 * strength,
      seedSalt: hashString(id)
    });
  }

  private addHitmarker(tick: number, position: Vec2 | undefined, damage: number): void {
    const strength = Math.max(0.35, Math.min(1, damage / 120));
    const resolvedPosition = position ?? { x: this.arenaWidth / 2, y: 0 };
    this.addCue({
      id: `${tick}:hitmarker`, tick, position: resolvedPosition, delaySeconds: 0.004, durationSeconds: 0.055,
      waveform: 'square', startFrequency: 1850, endFrequency: 640, gain: 0.035 * strength, seedSalt: 771
    });
  }

  private addDeath(tick: number, position: Vec2, entityId: number): void {
    this.addCue({
      id: `${tick}:death:${entityId}`, tick, position, delaySeconds: 0, durationSeconds: 0.42,
      waveform: 'sawtooth', startFrequency: 105, endFrequency: 28, gain: 0.11, seedSalt: entityId
    });
  }

  private addBattleResult(tick: number, winningTeam: number): void {
    const center = { x: this.arenaWidth / 2, y: 0 };
    this.addCue({
      id: `${tick}:result:body`, tick, position: center, delaySeconds: 0.16, durationSeconds: 0.75,
      waveform: 'triangle', startFrequency: winningTeam === 0 ? 170 : 210, endFrequency: winningTeam === 0 ? 95 : 520,
      gain: 0.075, seedSalt: winningTeam + 3001
    });
    this.addCue({
      id: `${tick}:result:accent`, tick, position: center, delaySeconds: 0.32, durationSeconds: 0.38,
      waveform: 'sine', startFrequency: 420, endFrequency: winningTeam === 0 ? 260 : 860,
      gain: 0.042, seedSalt: winningTeam + 4001
    });
  }

  private addCue(input: {
    id: string;
    tick: number;
    position: Vec2;
    delaySeconds: number;
    durationSeconds: number;
    waveform: ReplayAudioWaveform;
    startFrequency: number;
    endFrequency: number;
    gain: number;
    seedSalt: number;
  }): void {
    if (this.cueKeys.has(input.id)) return;
    this.cueKeys.add(input.id);
    const durationSeconds = Math.max(0.02, Math.min(2.4, input.durationSeconds));
    this.cues.push({
      id: input.id,
      startsAtSeconds: input.tick / 60 + Math.max(0, input.delaySeconds),
      durationSeconds,
      waveform: input.waveform,
      startFrequency: Math.max(20, input.startFrequency || 20),
      endFrequency: Math.max(20, input.endFrequency || input.startFrequency || 20),
      gain: Math.max(0, Math.min(0.22, input.gain)),
      pan: Math.max(-0.82, Math.min(0.82, input.position.x / this.arenaWidth * 2 - 1)),
      attackSeconds: Math.min(0.018, durationSeconds * 0.16),
      releaseSeconds: Math.min(0.16, durationSeconds * 0.45),
      seed: mixSeed(this.battleSeed, input.tick, input.seedSalt)
    });
  }
}

function isMissileWeapon(id: string): boolean {
  return id.includes('rocket') || id.includes('missile');
}

function isMissileAbility(id: string | undefined): boolean {
  return !!id && (id.includes('rocket') || id.includes('missile') || id === 'starburst-convergence' || id === 'siege-marker');
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixSeed(a: number, b: number, c: number): number {
  let value = (a ^ Math.imul(b + 1, 0x9e3779b1) ^ c) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
