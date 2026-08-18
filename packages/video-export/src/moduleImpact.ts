import type { BattleDefinition } from '@kinetic/protocol';
import { rankBattleSeeds, type RankedSeedBattle, type SeedBatchProgress } from './seedBattleRanking';

export const MODULE_IMPACT_SAMPLE_SIZES = [4, 10, 20] as const;
export type ModuleImpactSampleSize = typeof MODULE_IMPACT_SAMPLE_SIZES[number];

export interface ModuleImpactOpponent {
  opponentId: string;
  sampleSizePerScenario: number;
  baselineWinRate: number;
  equippedWinRate: number;
  winRateDelta: number;
  baselineDrawRate: number;
  equippedDrawRate: number;
  baselineAverageDurationSeconds: number;
  equippedAverageDurationSeconds: number;
  durationDeltaSeconds: number;
}

export interface ModuleImpactScenarioSummary {
  battles: number;
  wins: number;
  draws: number;
  winRate: number;
  drawRate: number;
  averageDurationSeconds: number;
  timeoutRate: number;
}

export type ModuleImpactFindingSeverity = 'high' | 'watch' | 'info';

export interface ModuleImpactFinding {
  id: string;
  severity: ModuleImpactFindingSeverity;
  title: string;
  detail: string;
  opponentId?: string;
}

export interface ModuleImpactResult {
  fighterId: string;
  moduleId: string;
  sampleSizePerScenario: number;
  opponentCount: number;
  totalBattles: number;
  baseline: ModuleImpactScenarioSummary;
  equipped: ModuleImpactScenarioSummary;
  winRateDelta: number;
  averageDurationDeltaSeconds: number;
  opponents: ModuleImpactOpponent[];
  findings: ModuleImpactFinding[];
}

export interface ModuleImpactProgress {
  phase: 'searching' | 'complete';
  completedBattles: number;
  totalBattles: number;
  progress: number;
  activeOpponentId: string | null;
  activeScenario: 'baseline' | 'equipped' | null;
  message: string;
}

export interface AnalyzeFighterModuleImpactOptions {
  fighterId: string;
  moduleId: string;
  opponentIds: readonly string[];
  sampleSize?: ModuleImpactSampleSize | number;
  startSeed?: number;
  signal?: AbortSignal;
  createBattle(
    fighterAId: string,
    fighterBId: string,
    seed: number,
    moduleIdsA: readonly string[],
    moduleIdsB: readonly string[]
  ): BattleDefinition;
  onProgress?(progress: ModuleImpactProgress): void;
  maxTicksPerBattle?: number;
  yieldIntervalTicks?: number;
}

interface OrientedResult {
  result: RankedSeedBattle;
  focalTeam: number;
}

interface ScenarioRun {
  outcomes: OrientedResult[];
}

/**
 * Compares one module against that fighter's standard configuration using the
 * same deterministic seeds and both team orientations for every opponent.
 * This measures module impact without changing AI or base fighter data.
 */
export async function analyzeFighterModuleImpact(
  options: AnalyzeFighterModuleImpactOptions
): Promise<ModuleImpactResult> {
  const opponentIds = [...new Set(options.opponentIds.filter((id) => id && id !== options.fighterId))];
  const sampleSize = normalizeSampleSize(options.sampleSize ?? 4);
  const totalBattles = opponentIds.length * sampleSize * 2;
  const startSeed = normalizeSeed(options.startSeed ?? 1);
  const opponentResults: ModuleImpactOpponent[] = [];
  const baselineAll: OrientedResult[] = [];
  const equippedAll: OrientedResult[] = [];

  for (let opponentIndex = 0; opponentIndex < opponentIds.length; opponentIndex += 1) {
    throwIfCancelled(options.signal);
    const opponentId = opponentIds[opponentIndex]!;
    const pairSeed = normalizeSeed(startSeed + opponentIndex * 1009);
    const baselineOffset = opponentIndex * sampleSize * 2;
    const baseline = await runSideBalancedScenario(options, opponentId, pairSeed, [], sampleSize, baselineOffset, totalBattles, 'baseline');
    const equipped = await runSideBalancedScenario(options, opponentId, pairSeed, [options.moduleId], sampleSize, baselineOffset + sampleSize, totalBattles, 'equipped');
    baselineAll.push(...baseline.outcomes);
    equippedAll.push(...equipped.outcomes);
    opponentResults.push(createOpponentSummary(opponentId, sampleSize, baseline.outcomes, equipped.outcomes));
  }

  const baseline = summarizeScenario(baselineAll);
  const equipped = summarizeScenario(equippedAll);
  const resultWithoutFindings: Omit<ModuleImpactResult, 'findings'> = {
    fighterId: options.fighterId,
    moduleId: options.moduleId,
    sampleSizePerScenario: sampleSize,
    opponentCount: opponentIds.length,
    totalBattles,
    baseline,
    equipped,
    winRateDelta: equipped.winRate - baseline.winRate,
    averageDurationDeltaSeconds: equipped.averageDurationSeconds - baseline.averageDurationSeconds,
    opponents: opponentResults.sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta) || a.opponentId.localeCompare(b.opponentId))
  };
  const result: ModuleImpactResult = {
    ...resultWithoutFindings,
    findings: buildModuleImpactFindings(resultWithoutFindings)
  };

  options.onProgress?.({
    phase: 'complete',
    completedBattles: totalBattles,
    totalBattles,
    progress: 1,
    activeOpponentId: null,
    activeScenario: null,
    message: `${totalBattles.toLocaleString()} module comparison battles complete`
  });
  return result;
}

export function buildModuleImpactFindings(result: Omit<ModuleImpactResult, 'findings'>): ModuleImpactFinding[] {
  const findings: ModuleImpactFinding[] = [];
  const scenarioBattles = result.baseline.battles;
  if (scenarioBattles < 50) {
    findings.push({
      id: 'sample-size',
      severity: 'info',
      title: 'Small comparison sample',
      detail: `${scenarioBattles} battles per configuration is useful for screening, not final balance decisions.`
    });
  }

  if (result.winRateDelta >= 0.1) {
    findings.push({
      id: 'global-positive-swing',
      severity: result.winRateDelta >= 0.16 ? 'high' : 'watch',
      title: 'Large positive module swing',
      detail: `Equipping the module raises roster win rate by ${formatPoints(result.winRateDelta)}.`
    });
  } else if (result.winRateDelta <= -0.08) {
    findings.push({
      id: 'global-negative-swing',
      severity: result.winRateDelta <= -0.14 ? 'high' : 'watch',
      title: 'Module underperforms baseline',
      detail: `Equipping the module lowers roster win rate by ${formatPoints(Math.abs(result.winRateDelta))}.`
    });
  }

  for (const opponent of result.opponents) {
    if (opponent.sampleSizePerScenario < 10 || Math.abs(opponent.winRateDelta) < 0.25) continue;
    findings.push({
      id: `matchup-${opponent.opponentId}`,
      severity: Math.abs(opponent.winRateDelta) >= 0.4 ? 'high' : 'watch',
      opponentId: opponent.opponentId,
      title: 'Matchup-specific module swing',
      detail: `The module changes win rate against ${opponent.opponentId} by ${formatSignedPoints(opponent.winRateDelta)}.`
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'stable-impact',
      severity: 'info',
      title: 'No large module swing detected',
      detail: 'This sample does not show a large global or matchup-specific win-rate change.'
    });
  }
  return findings;
}

async function runSideBalancedScenario(
  options: AnalyzeFighterModuleImpactOptions,
  opponentId: string,
  seed: number,
  moduleIds: readonly string[],
  sampleSize: number,
  completedOffset: number,
  totalBattles: number,
  scenario: 'baseline' | 'equipped'
): Promise<ScenarioRun> {
  const forwardCount = Math.ceil(sampleSize / 2);
  const reverseCount = sampleSize - forwardCount;
  const outcomes: OrientedResult[] = [];

  if (forwardCount > 0) {
    const battle = options.createBattle(options.fighterId, opponentId, seed, moduleIds, []);
    const results = await rankBattleSeeds(battle, {
      count: forwardCount,
      startSeed: seed,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.maxTicksPerBattle !== undefined ? { maxTicksPerBattle: options.maxTicksPerBattle } : {}),
      ...(options.yieldIntervalTicks !== undefined ? { yieldIntervalTicks: options.yieldIntervalTicks } : {}),
      onProgress: (progress) => emitProgress(options, progress, completedOffset, totalBattles, opponentId, scenario)
    });
    outcomes.push(...results.map((result) => ({ result, focalTeam: 1 })));
  }

  if (reverseCount > 0) {
    const battle = options.createBattle(opponentId, options.fighterId, seed, [], moduleIds);
    const results = await rankBattleSeeds(battle, {
      count: reverseCount,
      startSeed: seed,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.maxTicksPerBattle !== undefined ? { maxTicksPerBattle: options.maxTicksPerBattle } : {}),
      ...(options.yieldIntervalTicks !== undefined ? { yieldIntervalTicks: options.yieldIntervalTicks } : {}),
      onProgress: (progress) => emitProgress(options, progress, completedOffset + forwardCount, totalBattles, opponentId, scenario)
    });
    outcomes.push(...results.map((result) => ({ result, focalTeam: 2 })));
  }
  return { outcomes };
}

function emitProgress(
  options: AnalyzeFighterModuleImpactOptions,
  progress: SeedBatchProgress,
  offset: number,
  totalBattles: number,
  opponentId: string,
  scenario: 'baseline' | 'equipped'
): void {
  const completedUnits = Math.min(totalBattles, offset + progress.progress * progress.total);
  options.onProgress?.({
    phase: 'searching',
    completedBattles: Math.min(totalBattles, Math.floor(completedUnits)),
    totalBattles,
    progress: totalBattles > 0 ? completedUnits / totalBattles : 1,
    activeOpponentId: opponentId,
    activeScenario: scenario,
    message: `${scenario === 'baseline' ? 'Baseline' : 'Equipped'} vs ${opponentId}`
  });
}

function createOpponentSummary(
  opponentId: string,
  sampleSize: number,
  baseline: readonly OrientedResult[],
  equipped: readonly OrientedResult[]
): ModuleImpactOpponent {
  const base = summarizeScenario(baseline);
  const mod = summarizeScenario(equipped);
  return {
    opponentId,
    sampleSizePerScenario: sampleSize,
    baselineWinRate: base.winRate,
    equippedWinRate: mod.winRate,
    winRateDelta: mod.winRate - base.winRate,
    baselineDrawRate: base.drawRate,
    equippedDrawRate: mod.drawRate,
    baselineAverageDurationSeconds: base.averageDurationSeconds,
    equippedAverageDurationSeconds: mod.averageDurationSeconds,
    durationDeltaSeconds: mod.averageDurationSeconds - base.averageDurationSeconds
  };
}

function summarizeScenario(outcomes: readonly OrientedResult[]): ModuleImpactScenarioSummary {
  let wins = 0;
  let draws = 0;
  let duration = 0;
  let timeouts = 0;
  for (const outcome of outcomes) {
    if (outcome.result.winningTeam === outcome.focalTeam) wins += 1;
    else if (outcome.result.winningTeam === null) draws += 1;
    duration += outcome.result.metrics.durationSeconds;
    if (outcome.result.metrics.resultReason === 'timeout' || outcome.result.metrics.resultReason === 'safety-limit') timeouts += 1;
  }
  return {
    battles: outcomes.length,
    wins,
    draws,
    winRate: outcomes.length > 0 ? wins / outcomes.length : 0,
    drawRate: outcomes.length > 0 ? draws / outcomes.length : 0,
    averageDurationSeconds: outcomes.length > 0 ? duration / outcomes.length : 0,
    timeoutRate: outcomes.length > 0 ? timeouts / outcomes.length : 0
  };
}

function normalizeSampleSize(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(100, Math.trunc(value)));
}

function normalizeSeed(value: number): number {
  return Math.trunc(Number.isFinite(value) ? value : 1) >>> 0 || 1;
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Module impact analysis cancelled.', 'AbortError');
}

function formatPoints(value: number): string {
  return `${Math.round(value * 100)} percentage points`;
}

function formatSignedPoints(value: number): string {
  const points = Math.round(value * 100);
  return `${points >= 0 ? '+' : ''}${points} points`;
}
