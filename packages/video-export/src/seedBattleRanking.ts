import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { SIM_TICK_RATE } from '@kinetic/simulation';
import { runHeadlessSeedSimulation, SeedReplayGenerationError } from './seedReplayGenerator';

export const SEED_BATCH_SIZES = [10, 25, 50] as const;
export type SeedBatchSize = typeof SEED_BATCH_SIZES[number];

export interface SeedBattleMetrics {
  durationSeconds: number;
  totalDamage: number;
  damageEvents: number;
  largestHit: number;
  knockouts: number;
  ultimates: number;
  blasts: number;
  spectacleEvents: number;
  winnerRemainingHpRatio: number;
  resultReason: string;
}

export interface RankedSeedBattle {
  rank: number;
  seed: number;
  score: number;
  endTick: number;
  checksum: string;
  battleEnded: boolean;
  winningTeam: number | null;
  metrics: SeedBattleMetrics;
  labels: string[];
}

export interface SeedBatchProgress {
  phase: 'searching' | 'complete' | 'cancelled';
  completed: number;
  total: number;
  activeSeed: number | null;
  activeSeedTicks: number;
  progress: number;
  best: RankedSeedBattle | null;
  message: string;
}

export interface RankBattleSeedsOptions {
  count?: SeedBatchSize | number;
  startSeed?: number;
  signal?: AbortSignal;
  onProgress?(progress: SeedBatchProgress): void;
  /** Test/perf escape hatch. Production uses the existing battle/export limit. */
  maxTicksPerBattle?: number;
  yieldIntervalTicks?: number;
}

interface MutableMetrics {
  totalDamage: number;
  damageEvents: number;
  largestHit: number;
  knockouts: number;
  ultimates: number;
  blasts: number;
  spectacleEvents: number;
}

/**
 * Searches a bounded sequence of deterministic seeds without creating replay
 * data or invoking any video encoder. The selected seed can later be handed to
 * generateSeedReplay once, then reused across export formats.
 */
export async function rankBattleSeeds(
  battle: BattleDefinition,
  options: RankBattleSeedsOptions = {}
): Promise<RankedSeedBattle[]> {
  const count = clampBatchCount(options.count ?? 10);
  const startSeed = normalizeSeed(options.startSeed ?? battle.seed);
  const seeds = createSeedBatch(startSeed, count);
  const ranked: RankedSeedBattle[] = [];

  for (let index = 0; index < seeds.length; index += 1) {
    throwIfCancelled(options.signal);
    const seed = seeds[index]!;
    const candidate = structuredClone(battle);
    candidate.seed = seed;
    const metrics = createMutableMetrics();
    let initialTotalMaxHp = 0;
    let activeSeedTicks = 0;

    const simulation = await runHeadlessSeedSimulation(candidate, {
      ...(options.signal ? { signal: options.signal } : {}),
      recordReplay: false,
      requireBattleEnd: false,
      ...(options.maxTicksPerBattle !== undefined ? { maxTicks: options.maxTicksPerBattle } : {}),
      yieldIntervalTicks: options.yieldIntervalTicks ?? 600,
      progressIntervalTicks: 120,
      onInitialSnapshot: (snapshot) => {
        initialTotalMaxHp = snapshot.entities.reduce((sum, entity) => sum + Math.max(0, entity.maxHp), 0);
      },
      onEvents: (events) => observeEvents(metrics, events),
      onProgress: (progress) => {
        activeSeedTicks = progress.simulatedTicks;
        options.onProgress?.({
          phase: 'searching',
          completed: index,
          total: seeds.length,
          activeSeed: seed,
          activeSeedTicks,
          progress: (index + progress.progress) / seeds.length,
          best: ranked[0] ?? null,
          message: `Scanning seed ${seed.toLocaleString()} · ${index + 1} / ${seeds.length}`
        });
      }
    });

    const result = createRankedResult(
      seed,
      simulation.finalSnapshot,
      simulation.checksum,
      metrics,
      initialTotalMaxHp,
      candidate.participants.length
    );
    ranked.push(result);
    sortAndRank(ranked);

    options.onProgress?.({
      phase: 'searching',
      completed: index + 1,
      total: seeds.length,
      activeSeed: index + 1 < seeds.length ? seeds[index + 1]! : null,
      activeSeedTicks: 0,
      progress: (index + 1) / seeds.length,
      best: ranked[0] ?? null,
      message: `${index + 1} / ${seeds.length} seeds scored`
    });
  }

  options.onProgress?.({
    phase: 'complete',
    completed: seeds.length,
    total: seeds.length,
    activeSeed: null,
    activeSeedTicks: 0,
    progress: 1,
    best: ranked[0] ?? null,
    message: ranked[0]
      ? `Best seed ${ranked[0].seed.toLocaleString()} · score ${ranked[0].score}`
      : 'Seed search complete.'
  });
  return ranked;
}

export function createSeedBatch(startSeed: number, count: number): number[] {
  const safeCount = clampBatchCount(count);
  const start = normalizeSeed(startSeed);
  return Array.from({ length: safeCount }, (_, index) => (start + index) >>> 0);
}

export function scoreBattleForCreators(
  snapshot: WorldSnapshot,
  metrics: Omit<SeedBattleMetrics, 'durationSeconds' | 'winnerRemainingHpRatio' | 'resultReason'>,
  initialTotalMaxHp: number,
  participantCount: number
): number {
  const durationSeconds = Math.max(1 / SIM_TICK_RATE, snapshot.tick / SIM_TICK_RATE);
  const resolvedParticipantCount = Math.max(2, participantCount);
  const averageMaxHp = initialTotalMaxHp / resolvedParticipantCount;
  const damagePressure = clamp01(metrics.totalDamage / Math.max(1, initialTotalMaxHp * 0.9));
  const actionDensity = clamp01((metrics.damageEvents / durationSeconds) / Math.max(0.6, resolvedParticipantCount * 0.45));
  const knockoutCoverage = clamp01(metrics.knockouts / Math.max(1, resolvedParticipantCount - 1));
  const ultimateCoverage = clamp01(metrics.ultimates / Math.max(1, resolvedParticipantCount));
  const heavyHit = clamp01(metrics.largestHit / Math.max(1, averageMaxHp * 0.28));
  const spectacle = clamp01(metrics.spectacleEvents / Math.max(4, resolvedParticipantCount * 4));
  const winnerRemainingHpRatio = calculateWinnerRemainingHpRatio(snapshot);
  const closeFinish = snapshot.winningTeam === null ? 0.45 : clamp01((1 - winnerRemainingHpRatio) / 0.7);
  const durationQuality = calculateDurationQuality(durationSeconds);
  const decisiveFinish = snapshot.battleEnded && snapshot.result?.reason !== 'timeout' && snapshot.result?.reason !== 'draw' ? 1 : 0;

  let score = 0;
  score += damagePressure * 19;
  score += actionDensity * 16;
  score += knockoutCoverage * 15;
  score += ultimateCoverage * 13;
  score += heavyHit * 10;
  score += spectacle * 9;
  score += closeFinish * 9;
  score += durationQuality * 5;
  score += decisiveFinish * 4;

  if (!snapshot.battleEnded) score -= 25;
  else if (snapshot.result?.reason === 'timeout') score -= 15;
  else if (snapshot.result?.reason === 'draw') score -= 7;
  if (durationSeconds < 5) score -= (5 - durationSeconds) * 3;

  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

function createRankedResult(
  seed: number,
  snapshot: WorldSnapshot,
  checksum: string,
  mutable: MutableMetrics,
  initialTotalMaxHp: number,
  initialParticipantCount = 2
): RankedSeedBattle {
  const resolvedInitialMaxHp = initialTotalMaxHp > 0
    ? initialTotalMaxHp
    : snapshot.entities.reduce((sum, entity) => sum + Math.max(0, entity.maxHp), 0);
  const winnerRemainingHpRatio = calculateWinnerRemainingHpRatio(snapshot);
  const metrics: SeedBattleMetrics = {
    durationSeconds: snapshot.tick / SIM_TICK_RATE,
    totalDamage: mutable.totalDamage,
    damageEvents: mutable.damageEvents,
    largestHit: mutable.largestHit,
    knockouts: mutable.knockouts,
    ultimates: mutable.ultimates,
    blasts: mutable.blasts,
    spectacleEvents: mutable.spectacleEvents,
    winnerRemainingHpRatio,
    resultReason: snapshot.result?.reason ?? (snapshot.battleEnded ? 'complete' : 'safety-limit')
  };
  const score = scoreBattleForCreators(snapshot, mutable, Math.max(1, resolvedInitialMaxHp), Math.max(2, initialParticipantCount));
  return {
    rank: 0,
    seed,
    score,
    endTick: snapshot.tick,
    checksum,
    battleEnded: snapshot.battleEnded,
    winningTeam: snapshot.winningTeam,
    metrics,
    labels: buildLabels(metrics, snapshot.battleEnded)
  };
}

function observeEvents(metrics: MutableMetrics, events: readonly SimulationEvent[]): void {
  for (const event of events) {
    if (event.type === 'damage' && !event.prevented && event.amount > 0) {
      metrics.totalDamage += event.amount;
      metrics.damageEvents += 1;
      metrics.largestHit = Math.max(metrics.largestHit, event.amount);
    } else if (event.type === 'death') {
      metrics.knockouts += 1;
    } else if (event.type === 'abilityActivated' && event.slot === 'ultimate') {
      metrics.ultimates += 1;
      metrics.spectacleEvents += 2;
    } else if (event.type === 'blast') {
      metrics.blasts += 1;
      metrics.spectacleEvents += 1;
    } else if (event.type === 'obstacleDestroyed') {
      metrics.spectacleEvents += 2;
    } else if (event.type === 'wallImpact' && event.magnitude >= 6) {
      metrics.spectacleEvents += 1;
    } else if (event.type === 'obstacleImpact' && event.magnitude >= 6) {
      metrics.spectacleEvents += 1;
    } else if (event.type === 'impact' && event.magnitude >= 7) {
      metrics.spectacleEvents += 1;
    }
  }
}

function createMutableMetrics(): MutableMetrics {
  return {
    totalDamage: 0,
    damageEvents: 0,
    largestHit: 0,
    knockouts: 0,
    ultimates: 0,
    blasts: 0,
    spectacleEvents: 0
  };
}

function calculateWinnerRemainingHpRatio(snapshot: WorldSnapshot): number {
  if (snapshot.winningTeam === null) return 0;
  const winners = snapshot.entities.filter((entity) => entity.team === snapshot.winningTeam);
  const hp = winners.reduce((sum, entity) => sum + Math.max(0, entity.hp), 0);
  const maxHp = winners.reduce((sum, entity) => sum + Math.max(0, entity.maxHp), 0);
  return maxHp > 0 ? clamp01(hp / maxHp) : 0;
}

function calculateDurationQuality(seconds: number): number {
  if (seconds < 6) return clamp01(seconds / 6) * 0.4;
  if (seconds <= 75) return 1;
  if (seconds >= 180) return 0.35;
  return 1 - ((seconds - 75) / 105) * 0.65;
}

function buildLabels(metrics: SeedBattleMetrics, battleEnded: boolean): string[] {
  const labels: string[] = [];
  if (!battleEnded) labels.push('Safety limit');
  if (metrics.knockouts > 0) labels.push(`${metrics.knockouts} KO${metrics.knockouts === 1 ? '' : 's'}`);
  if (metrics.ultimates > 0) labels.push(`${metrics.ultimates} ult${metrics.ultimates === 1 ? '' : 's'}`);
  if (metrics.winnerRemainingHpRatio > 0 && metrics.winnerRemainingHpRatio <= 0.3) labels.push('Close finish');
  if (metrics.spectacleEvents >= 6) labels.push('High spectacle');
  if (labels.length === 0) labels.push(`${Math.round(metrics.durationSeconds)}s battle`);
  return labels.slice(0, 3);
}

function sortAndRank(results: RankedSeedBattle[]): void {
  results.sort((a, b) => b.score - a.score || Number(b.battleEnded) - Number(a.battleEnded) || a.seed - b.seed);
  results.forEach((result, index) => {
    result.rank = index + 1;
  });
}

function clampBatchCount(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(50, Math.trunc(value)));
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.trunc(value) >>> 0;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SeedReplayGenerationError('Seed batch search was cancelled.', 'cancelled');
}
