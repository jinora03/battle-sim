import type { EntityId, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { SIM_TICK_RATE } from '@kinetic/simulation';
import type { RankedSeedBattle } from './seedBattleRanking';

const SHORT_FIGHT_SECONDS = 10;
const LONG_FIGHT_SECONDS = 45;
const QUIET_GAP_SECONDS = 3;
const STALL_GAP_SECONDS = 6;
const SLOW_OPENING_SECONDS = 5;

export interface BattlePacingAnalytics {
  battleSamples: number;
  averageDurationSeconds: number;
  medianDurationSeconds: number;
  shortFightRate: number;
  longFightRate: number;
  slowOpeningRate: number;
  averageFirstDamageSeconds: number | null;
  averageFirstSkillSeconds: number | null;
  averageFirstUltimateSeconds: number | null;
  ultimateBattleRate: number;
  averageFirstKoSeconds: number | null;
  koBattleRate: number;
  averageLongestQuietGapSeconds: number;
  averageQuietTimeRatio: number;
  stallBattleRate: number;
  timeoutRate: number;
  safetyLimitRate: number;
}

export interface FighterPacingAnalytics extends BattlePacingAnalytics {
  fighterId: string;
  averageFirstDamageDealtSeconds: number | null;
  averageFirstSkillUseSeconds: number | null;
  averageFirstUltimateUseSeconds: number | null;
}

export interface RosterPacingAnalytics {
  overall: BattlePacingAnalytics;
  fighters: FighterPacingAnalytics[];
}

interface CurrentBattleState {
  entityToFighter: Map<EntityId, string>;
  fighterIds: string[];
  firstDamageTick: number | null;
  firstSkillTick: number | null;
  firstUltimateTick: number | null;
  firstKoTick: number | null;
  firstDamageByFighter: Map<string, number>;
  firstSkillByFighter: Map<string, number>;
  firstUltimateByFighter: Map<string, number>;
  lastMeaningfulTick: number;
  longestQuietGapTicks: number;
  quietTicks: number;
}

interface BattlePacingSample {
  fighterIds: string[];
  durationSeconds: number;
  firstDamageSeconds: number | null;
  firstSkillSeconds: number | null;
  firstUltimateSeconds: number | null;
  firstKoSeconds: number | null;
  firstDamageByFighter: Map<string, number>;
  firstSkillByFighter: Map<string, number>;
  firstUltimateByFighter: Map<string, number>;
  longestQuietGapSeconds: number;
  quietTimeRatio: number;
  timedOut: boolean;
  safetyLimited: boolean;
}

/**
 * Read-only battle pacing collector used by Stage 9A.5. It observes the same
 * event stream as the other intelligence collectors and never changes commands
 * or simulation state.
 */
export class BattlePacingAnalyticsCollector {
  private readonly samples: BattlePacingSample[] = [];
  private current: CurrentBattleState | null = null;

  beginBattle(snapshot: WorldSnapshot): void {
    const entityToFighter = new Map<EntityId, string>();
    const fighterIds: string[] = [];
    const seen = new Set<string>();
    for (const entity of snapshot.entities) {
      entityToFighter.set(entity.id, entity.fighterId);
      if (!seen.has(entity.fighterId)) {
        seen.add(entity.fighterId);
        fighterIds.push(entity.fighterId);
      }
    }

    this.current = {
      entityToFighter,
      fighterIds,
      firstDamageTick: null,
      firstSkillTick: null,
      firstUltimateTick: null,
      firstKoTick: null,
      firstDamageByFighter: new Map(),
      firstSkillByFighter: new Map(),
      firstUltimateByFighter: new Map(),
      lastMeaningfulTick: 0,
      longestQuietGapTicks: 0,
      quietTicks: 0
    };
  }

  observeEvents(events: readonly SimulationEvent[]): void {
    const battle = this.current;
    if (!battle || events.length === 0) return;

    for (const event of events) {
      if (event.type === 'damage' && !event.prevented && event.amount > 0) {
        battle.firstDamageTick ??= event.tick;
        if (event.sourceId !== undefined) {
          const fighterId = battle.entityToFighter.get(event.sourceId);
          if (fighterId && !battle.firstDamageByFighter.has(fighterId)) {
            battle.firstDamageByFighter.set(fighterId, event.tick);
          }
        }
        markMeaningfulActivity(battle, event.tick);
        continue;
      }

      if (event.type === 'abilityActivated') {
        const fighterId = battle.entityToFighter.get(event.entityId);
        if (event.slot === 'ultimate') {
          battle.firstUltimateTick ??= event.tick;
          if (fighterId && !battle.firstUltimateByFighter.has(fighterId)) {
            battle.firstUltimateByFighter.set(fighterId, event.tick);
          }
        } else if (event.slot !== 'basic') {
          battle.firstSkillTick ??= event.tick;
          if (fighterId && !battle.firstSkillByFighter.has(fighterId)) {
            battle.firstSkillByFighter.set(fighterId, event.tick);
          }
        }
        markMeaningfulActivity(battle, event.tick);
        continue;
      }

      if (event.type === 'weaponAttackStarted' || event.type === 'weaponHit' || event.type === 'blast') {
        markMeaningfulActivity(battle, event.tick);
        continue;
      }

      if (event.type === 'death') {
        battle.firstKoTick ??= event.tick;
        markMeaningfulActivity(battle, event.tick);
      }
    }
  }

  endBattle(result: RankedSeedBattle): void {
    const battle = this.current;
    if (!battle) return;

    const endTick = Math.max(0, result.endTick);
    closeQuietGap(battle, endTick);
    const durationSeconds = endTick / SIM_TICK_RATE;
    const sample: BattlePacingSample = {
      fighterIds: [...battle.fighterIds],
      durationSeconds,
      firstDamageSeconds: toSeconds(battle.firstDamageTick),
      firstSkillSeconds: toSeconds(battle.firstSkillTick),
      firstUltimateSeconds: toSeconds(battle.firstUltimateTick),
      firstKoSeconds: toSeconds(battle.firstKoTick),
      firstDamageByFighter: mapTicksToSeconds(battle.firstDamageByFighter),
      firstSkillByFighter: mapTicksToSeconds(battle.firstSkillByFighter),
      firstUltimateByFighter: mapTicksToSeconds(battle.firstUltimateByFighter),
      longestQuietGapSeconds: battle.longestQuietGapTicks / SIM_TICK_RATE,
      quietTimeRatio: endTick > 0 ? clamp01(battle.quietTicks / endTick) : 0,
      timedOut: result.metrics.resultReason === 'timeout',
      safetyLimited: !result.battleEnded || result.metrics.resultReason === 'safety-limit'
    };
    this.samples.push(sample);
    this.current = null;
  }

  summarize(): RosterPacingAnalytics {
    const fighterIds = new Set<string>();
    for (const sample of this.samples) {
      for (const fighterId of sample.fighterIds) fighterIds.add(fighterId);
    }

    return {
      overall: summarizeSamples(this.samples),
      fighters: [...fighterIds]
        .sort((a, b) => a.localeCompare(b))
        .map((fighterId) => summarizeFighterSamples(fighterId, this.samples))
    };
  }
}

export function getFighterPacingAnalytics(
  analytics: RosterPacingAnalytics,
  fighterId: string
): FighterPacingAnalytics | null {
  return analytics.fighters.find((fighter) => fighter.fighterId === fighterId) ?? null;
}

function summarizeFighterSamples(
  fighterId: string,
  allSamples: readonly BattlePacingSample[]
): FighterPacingAnalytics {
  const samples = allSamples.filter((sample) => sample.fighterIds.includes(fighterId));
  const summary = summarizeSamples(samples);
  return {
    fighterId,
    ...summary,
    averageFirstDamageDealtSeconds: averageNullable(samples.map((sample) => sample.firstDamageByFighter.get(fighterId) ?? null)),
    averageFirstSkillUseSeconds: averageNullable(samples.map((sample) => sample.firstSkillByFighter.get(fighterId) ?? null)),
    averageFirstUltimateUseSeconds: averageNullable(samples.map((sample) => sample.firstUltimateByFighter.get(fighterId) ?? null))
  };
}

function summarizeSamples(samples: readonly BattlePacingSample[]): BattlePacingAnalytics {
  const battleSamples = samples.length;
  const durations = samples.map((sample) => sample.durationSeconds);
  return {
    battleSamples,
    averageDurationSeconds: average(durations),
    medianDurationSeconds: median(durations),
    shortFightRate: rate(samples, (sample) => sample.durationSeconds < SHORT_FIGHT_SECONDS),
    longFightRate: rate(samples, (sample) => sample.durationSeconds > LONG_FIGHT_SECONDS),
    slowOpeningRate: rate(samples, (sample) => (sample.firstDamageSeconds ?? sample.durationSeconds) > SLOW_OPENING_SECONDS),
    averageFirstDamageSeconds: averageNullable(samples.map((sample) => sample.firstDamageSeconds)),
    averageFirstSkillSeconds: averageNullable(samples.map((sample) => sample.firstSkillSeconds)),
    averageFirstUltimateSeconds: averageNullable(samples.map((sample) => sample.firstUltimateSeconds)),
    ultimateBattleRate: rate(samples, (sample) => sample.firstUltimateSeconds !== null),
    averageFirstKoSeconds: averageNullable(samples.map((sample) => sample.firstKoSeconds)),
    koBattleRate: rate(samples, (sample) => sample.firstKoSeconds !== null),
    averageLongestQuietGapSeconds: average(samples.map((sample) => sample.longestQuietGapSeconds)),
    averageQuietTimeRatio: average(samples.map((sample) => sample.quietTimeRatio), 0),
    stallBattleRate: rate(samples, (sample) => sample.longestQuietGapSeconds >= STALL_GAP_SECONDS),
    timeoutRate: rate(samples, (sample) => sample.timedOut),
    safetyLimitRate: rate(samples, (sample) => sample.safetyLimited)
  };
}

function markMeaningfulActivity(battle: CurrentBattleState, tick: number): void {
  const normalizedTick = Math.max(0, tick);
  const gap = Math.max(0, normalizedTick - battle.lastMeaningfulTick);
  recordQuietGap(battle, gap);
  battle.lastMeaningfulTick = Math.max(battle.lastMeaningfulTick, normalizedTick);
}

function closeQuietGap(battle: CurrentBattleState, endTick: number): void {
  const gap = Math.max(0, endTick - battle.lastMeaningfulTick);
  recordQuietGap(battle, gap);
}

function recordQuietGap(battle: CurrentBattleState, gapTicks: number): void {
  battle.longestQuietGapTicks = Math.max(battle.longestQuietGapTicks, gapTicks);
  if (gapTicks >= QUIET_GAP_SECONDS * SIM_TICK_RATE) battle.quietTicks += gapTicks;
}

function mapTicksToSeconds(source: ReadonlyMap<string, number>): Map<string, number> {
  return new Map([...source.entries()].map(([key, tick]) => [key, tick / SIM_TICK_RATE]));
}

function toSeconds(tick: number | null): number | null {
  return tick === null ? null : tick / SIM_TICK_RATE;
}

function rate<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return items.filter(predicate).length / items.length;
}

function average(values: readonly number[], fallback = 0): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? average(present) : null;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
