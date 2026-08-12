import type { BattleDefinition } from '@kinetic/protocol';
import { summarizeBattleIntelligence, type BattleIntelligenceSummary } from './battleIntelligence';
import { AbilityAnalyticsCollector, type RosterAbilityAnalytics } from './abilityAnalytics';
import { AiDecisionAnalyticsCollector, type RosterAiDecisionAnalytics } from './aiDecisionAnalytics';
import { BattlePacingAnalyticsCollector, type RosterPacingAnalytics } from './pacingAnalytics';
import { buildBattleIntelligenceFindings, type BattleIntelligenceFinding } from './intelligenceFindings';
import { rankBattleSeeds, type RankedSeedBattle, type SeedBatchProgress } from './seedBattleRanking';

export const MATCHUP_MATRIX_SAMPLE_SIZES = [10, 50, 100] as const;
export type MatchupMatrixSampleSize = typeof MATCHUP_MATRIX_SAMPLE_SIZES[number];

export interface MatchupMatrixFighter {
  id: string;
  name: string;
}

export interface MatchupMatrixCell {
  fighterAId: string;
  fighterBId: string;
  sampleSize: number;
  fighterAWins: number;
  fighterBWins: number;
  fighterAWinRate: number;
  fighterBWinRate: number;
  drawRate: number;
  timeoutRate: number;
  safetyLimitRate: number;
  medianDurationSeconds: number;
  averageDurationSeconds: number;
  averageTotalDamage: number;
  averageUltimates: number;
  closeFightRate: number;
  oneSidedFightRate: number;
  bestCreatorSeed: number | null;
  bestCreatorScore: number | null;
  bestCreatorOrientation: 'forward' | 'reverse' | null;
}

export interface FighterBalanceSummary {
  fighterId: string;
  matchupCount: number;
  battleSamples: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  drawRate: number;
  averageMedianDurationSeconds: number;
  closeFightRate: number;
  oneSidedFightRate: number;
  strongestOpponentId: string | null;
  strongestOpponentWinRate: number;
  weakestOpponentId: string | null;
  weakestOpponentWinRate: number;
}

export interface MatchupMatrixResult {
  fighters: MatchupMatrixFighter[];
  sampleSizePerMatchup: number;
  totalPairings: number;
  totalBattles: number;
  cells: MatchupMatrixCell[];
  fighterSummaries: FighterBalanceSummary[];
  abilityAnalytics: RosterAbilityAnalytics;
  aiDecisionAnalytics: RosterAiDecisionAnalytics;
  pacingAnalytics: RosterPacingAnalytics;
  findings: BattleIntelligenceFinding[];
}

export interface MatchupMatrixProgress {
  phase: 'searching' | 'complete';
  completedPairings: number;
  totalPairings: number;
  completedBattles: number;
  totalBattles: number;
  progress: number;
  activeFighterAId: string | null;
  activeFighterBId: string | null;
  activeSeed: number | null;
  message: string;
}

export interface AnalyzeRosterMatchupsOptions {
  sampleSize?: MatchupMatrixSampleSize | number;
  startSeed?: number;
  signal?: AbortSignal;
  createBattle(fighterAId: string, fighterBId: string, seed: number): BattleDefinition;
  onProgress?(progress: MatchupMatrixProgress): void;
  /** Test/perf escape hatch forwarded to the existing headless seed scanner. */
  maxTicksPerBattle?: number;
  yieldIntervalTicks?: number;
}

interface MatchupPair {
  fighterA: MatchupMatrixFighter;
  fighterB: MatchupMatrixFighter;
}

interface OrientationRun {
  orientation: 'forward' | 'reverse';
  results: RankedSeedBattle[];
}

/**
 * Runs every unique roster pairing through the existing deterministic headless
 * scanner. Each matchup is split evenly across both team/spawn orientations so
 * the matrix does not silently bake Team 1 placement into fighter win rates.
 */
export async function analyzeRosterMatchups(
  fighters: readonly MatchupMatrixFighter[],
  options: AnalyzeRosterMatchupsOptions
): Promise<MatchupMatrixResult> {
  const normalizedFighters = normalizeFighters(fighters);
  const sampleSize = normalizeSampleSize(options.sampleSize ?? 10);
  const pairs = createPairs(normalizedFighters);
  const totalBattles = pairs.length * sampleSize;
  const cells: MatchupMatrixCell[] = [];
  const startSeed = normalizeSeed(options.startSeed ?? 1);
  const forwardCount = Math.ceil(sampleSize / 2);
  const reverseCount = sampleSize - forwardCount;
  const abilityAnalytics = new AbilityAnalyticsCollector();
  const aiDecisionAnalytics = new AiDecisionAnalyticsCollector();
  const pacingAnalytics = new BattlePacingAnalyticsCollector();

  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    throwIfCancelled(options.signal);
    const pair = pairs[pairIndex]!;
    const pairBattleOffset = pairIndex * sampleSize;
    const pairSeed = normalizeSeed(startSeed + pairIndex * 1009);
    const runs: OrientationRun[] = [];

    if (forwardCount > 0) {
      const forwardBattle = options.createBattle(pair.fighterA.id, pair.fighterB.id, pairSeed);
      const forward = await rankBattleSeeds(forwardBattle, {
        count: forwardCount,
        startSeed: pairSeed,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.maxTicksPerBattle !== undefined ? { maxTicksPerBattle: options.maxTicksPerBattle } : {}),
        ...(options.yieldIntervalTicks !== undefined ? { yieldIntervalTicks: options.yieldIntervalTicks } : {}),
        onInitialSnapshot: (snapshot) => {
          abilityAnalytics.beginBattle(
            snapshot.entities.map((entity) => ({
              id: entity.id,
              fighterId: entity.fighterId,
              primaryAttackId: entity.primaryAttackId
            }))
          );
          aiDecisionAnalytics.beginBattle(
            snapshot.entities.map((entity) => ({ id: entity.id, fighterId: entity.fighterId }))
          );
          pacingAnalytics.beginBattle(snapshot);
        },
        onEvents: (events) => {
          abilityAnalytics.observeEvents(events);
          pacingAnalytics.observeEvents(events);
        },
        onAiDecision: (decision, tick) => aiDecisionAnalytics.observeDecision(decision, tick),
        onBattleComplete: (battleResult) => {
          abilityAnalytics.endBattle();
          aiDecisionAnalytics.endBattle();
          pacingAnalytics.endBattle(battleResult);
        },
        onProgress: (progress) => emitProgress(options, progress, {
          pair,
          pairIndex,
          pairCount: pairs.length,
          pairBattleOffset,
          orientationOffset: 0,
          totalBattles
        })
      });
      runs.push({ orientation: 'forward', results: forward });
    }

    if (reverseCount > 0) {
      const reverseBattle = options.createBattle(pair.fighterB.id, pair.fighterA.id, pairSeed);
      const reverse = await rankBattleSeeds(reverseBattle, {
        count: reverseCount,
        startSeed: pairSeed,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.maxTicksPerBattle !== undefined ? { maxTicksPerBattle: options.maxTicksPerBattle } : {}),
        ...(options.yieldIntervalTicks !== undefined ? { yieldIntervalTicks: options.yieldIntervalTicks } : {}),
        onInitialSnapshot: (snapshot) => {
          abilityAnalytics.beginBattle(
            snapshot.entities.map((entity) => ({
              id: entity.id,
              fighterId: entity.fighterId,
              primaryAttackId: entity.primaryAttackId
            }))
          );
          aiDecisionAnalytics.beginBattle(
            snapshot.entities.map((entity) => ({ id: entity.id, fighterId: entity.fighterId }))
          );
          pacingAnalytics.beginBattle(snapshot);
        },
        onEvents: (events) => {
          abilityAnalytics.observeEvents(events);
          pacingAnalytics.observeEvents(events);
        },
        onAiDecision: (decision, tick) => aiDecisionAnalytics.observeDecision(decision, tick),
        onBattleComplete: (battleResult) => {
          abilityAnalytics.endBattle();
          aiDecisionAnalytics.endBattle();
          pacingAnalytics.endBattle(battleResult);
        },
        onProgress: (progress) => emitProgress(options, progress, {
          pair,
          pairIndex,
          pairCount: pairs.length,
          pairBattleOffset,
          orientationOffset: forwardCount,
          totalBattles
        })
      });
      runs.push({ orientation: 'reverse', results: reverse });
    }

    cells.push(createCell(pair, runs));
    options.onProgress?.({
      phase: 'searching',
      completedPairings: pairIndex + 1,
      totalPairings: pairs.length,
      completedBattles: (pairIndex + 1) * sampleSize,
      totalBattles,
      progress: totalBattles > 0 ? ((pairIndex + 1) * sampleSize) / totalBattles : 1,
      activeFighterAId: pairIndex + 1 < pairs.length ? pairs[pairIndex + 1]!.fighterA.id : null,
      activeFighterBId: pairIndex + 1 < pairs.length ? pairs[pairIndex + 1]!.fighterB.id : null,
      activeSeed: null,
      message: `${pairIndex + 1} / ${pairs.length} matchups analyzed`
    });
  }

  const resultWithoutFindings: Omit<MatchupMatrixResult, 'findings'> = {
    fighters: normalizedFighters,
    sampleSizePerMatchup: sampleSize,
    totalPairings: pairs.length,
    totalBattles,
    cells,
    fighterSummaries: summarizeFighterBalance(normalizedFighters, cells),
    abilityAnalytics: abilityAnalytics.summarize(),
    aiDecisionAnalytics: aiDecisionAnalytics.summarize(),
    pacingAnalytics: pacingAnalytics.summarize()
  };
  const result: MatchupMatrixResult = {
    ...resultWithoutFindings,
    findings: buildBattleIntelligenceFindings(resultWithoutFindings)
  };

  options.onProgress?.({
    phase: 'complete',
    completedPairings: pairs.length,
    totalPairings: pairs.length,
    completedBattles: totalBattles,
    totalBattles,
    progress: 1,
    activeFighterAId: null,
    activeFighterBId: null,
    activeSeed: null,
    message: `${pairs.length} matchups · ${totalBattles.toLocaleString()} battles complete`
  });

  return result;
}

export function getMatchupCell(
  result: MatchupMatrixResult,
  fighterAId: string,
  fighterBId: string
): MatchupMatrixCell | null {
  if (fighterAId === fighterBId) return null;
  return result.cells.find((cell) =>
    (cell.fighterAId === fighterAId && cell.fighterBId === fighterBId)
    || (cell.fighterAId === fighterBId && cell.fighterBId === fighterAId)
  ) ?? null;
}

export function getFighterMatchupWinRate(cell: MatchupMatrixCell, fighterId: string): number {
  if (cell.fighterAId === fighterId) return cell.fighterAWinRate;
  if (cell.fighterBId === fighterId) return cell.fighterBWinRate;
  return 0;
}

function createCell(pair: MatchupPair, runs: readonly OrientationRun[]): MatchupMatrixCell {
  const forward = runs.find((run) => run.orientation === 'forward')?.results ?? [];
  const reverse = runs.find((run) => run.orientation === 'reverse')?.results ?? [];
  const canonicalReverse = reverse.map(remapReverseResult);
  const canonicalResults = [...forward, ...canonicalReverse];
  const intelligence = summarizeBattleIntelligence(canonicalResults);
  const fighterAWins = intelligence.teamWinRates.find((team) => team.team === 1)?.wins ?? 0;
  const fighterBWins = intelligence.teamWinRates.find((team) => team.team === 2)?.wins ?? 0;
  const best = findBestOrientationResult(runs);

  return {
    fighterAId: pair.fighterA.id,
    fighterBId: pair.fighterB.id,
    sampleSize: intelligence.sampleSize,
    fighterAWins,
    fighterBWins,
    fighterAWinRate: rateForTeam(intelligence, 1),
    fighterBWinRate: rateForTeam(intelligence, 2),
    drawRate: intelligence.drawRate,
    timeoutRate: intelligence.timeoutRate,
    safetyLimitRate: intelligence.safetyLimitRate,
    medianDurationSeconds: intelligence.medianDurationSeconds,
    averageDurationSeconds: intelligence.averageDurationSeconds,
    averageTotalDamage: intelligence.averageTotalDamage,
    averageUltimates: intelligence.averageUltimates,
    closeFightRate: intelligence.closeFightRate,
    oneSidedFightRate: intelligence.oneSidedFightRate,
    bestCreatorSeed: best?.result.seed ?? null,
    bestCreatorScore: best?.result.score ?? null,
    bestCreatorOrientation: best?.orientation ?? null
  };
}

function summarizeFighterBalance(
  fighters: readonly MatchupMatrixFighter[],
  cells: readonly MatchupMatrixCell[]
): FighterBalanceSummary[] {
  return fighters.map((fighter) => {
    const fighterCells = cells.filter((cell) => cell.fighterAId === fighter.id || cell.fighterBId === fighter.id);
    let battleSamples = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let weightedClose = 0;
    let weightedOneSided = 0;
    let durationTotal = 0;
    let strongestOpponentId: string | null = null;
    let weakestOpponentId: string | null = null;
    let strongestOpponentWinRate = -1;
    let weakestOpponentWinRate = 2;

    for (const cell of fighterCells) {
      const isA = cell.fighterAId === fighter.id;
      const fighterWins = isA ? cell.fighterAWins : cell.fighterBWins;
      const opponentWins = isA ? cell.fighterBWins : cell.fighterAWins;
      const opponentId = isA ? cell.fighterBId : cell.fighterAId;
      const winRate = isA ? cell.fighterAWinRate : cell.fighterBWinRate;
      const cellDraws = Math.max(0, cell.sampleSize - fighterWins - opponentWins);

      battleSamples += cell.sampleSize;
      wins += fighterWins;
      losses += opponentWins;
      draws += cellDraws;
      weightedClose += cell.closeFightRate * cell.sampleSize;
      weightedOneSided += cell.oneSidedFightRate * cell.sampleSize;
      durationTotal += cell.medianDurationSeconds;

      if (winRate > strongestOpponentWinRate) {
        strongestOpponentWinRate = winRate;
        strongestOpponentId = opponentId;
      }
      if (winRate < weakestOpponentWinRate) {
        weakestOpponentWinRate = winRate;
        weakestOpponentId = opponentId;
      }
    }

    return {
      fighterId: fighter.id,
      matchupCount: fighterCells.length,
      battleSamples,
      wins,
      losses,
      draws,
      winRate: battleSamples > 0 ? wins / battleSamples : 0,
      drawRate: battleSamples > 0 ? draws / battleSamples : 0,
      averageMedianDurationSeconds: fighterCells.length > 0 ? durationTotal / fighterCells.length : 0,
      closeFightRate: battleSamples > 0 ? weightedClose / battleSamples : 0,
      oneSidedFightRate: battleSamples > 0 ? weightedOneSided / battleSamples : 0,
      strongestOpponentId,
      strongestOpponentWinRate: strongestOpponentWinRate >= 0 ? strongestOpponentWinRate : 0,
      weakestOpponentId,
      weakestOpponentWinRate: weakestOpponentWinRate <= 1 ? weakestOpponentWinRate : 0
    };
  });
}

function remapReverseResult(result: RankedSeedBattle): RankedSeedBattle {
  return {
    ...result,
    winningTeam: result.winningTeam === 1 ? 2 : result.winningTeam === 2 ? 1 : null
  };
}

function findBestOrientationResult(runs: readonly OrientationRun[]): { orientation: OrientationRun['orientation']; result: RankedSeedBattle } | null {
  let best: { orientation: OrientationRun['orientation']; result: RankedSeedBattle } | null = null;
  for (const run of runs) {
    for (const result of run.results) {
      if (!best || result.score > best.result.score || (result.score === best.result.score && result.seed < best.result.seed)) {
        best = { orientation: run.orientation, result };
      }
    }
  }
  return best;
}

function rateForTeam(summary: BattleIntelligenceSummary, teamId: number): number {
  return summary.teamWinRates.find((team) => team.team === teamId)?.rate ?? 0;
}

function createPairs(fighters: readonly MatchupMatrixFighter[]): MatchupPair[] {
  const pairs: MatchupPair[] = [];
  for (let a = 0; a < fighters.length; a += 1) {
    for (let b = a + 1; b < fighters.length; b += 1) {
      pairs.push({ fighterA: fighters[a]!, fighterB: fighters[b]! });
    }
  }
  return pairs;
}

function normalizeFighters(fighters: readonly MatchupMatrixFighter[]): MatchupMatrixFighter[] {
  const seen = new Set<string>();
  const normalized: MatchupMatrixFighter[] = [];
  for (const fighter of fighters) {
    if (!fighter.id || seen.has(fighter.id)) continue;
    seen.add(fighter.id);
    normalized.push({ id: fighter.id, name: fighter.name || fighter.id });
  }
  return normalized;
}

function normalizeSampleSize(value: number): number {
  if (!Number.isFinite(value)) return 10;
  const rounded = Math.max(2, Math.min(100, Math.trunc(value)));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.trunc(value) >>> 0 || 1;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Matchup matrix analysis was cancelled.');
}

function emitProgress(
  options: AnalyzeRosterMatchupsOptions,
  progress: SeedBatchProgress,
  context: {
    pair: MatchupPair;
    pairIndex: number;
    pairCount: number;
    pairBattleOffset: number;
    orientationOffset: number;
    totalBattles: number;
  }
): void {
  // Matrix runs can contain thousands of battles. Forward live progress only
  // on the same cadence that the headless simulation yields to the browser so
  // the bar moves during a battle without flooding React with tick updates.
  const uiProgressIntervalTicks = Math.max(
    1,
    Math.trunc(options.yieldIntervalTicks ?? 600)
  );
  if (
    progress.activeSeedTicks > 0 &&
    progress.activeSeedTicks % uiProgressIntervalTicks !== 0
  ) {
    return;
  }
  const completedBattleUnits = Math.min(
    context.totalBattles,
    context.pairBattleOffset +
      context.orientationOffset +
      progress.progress * progress.total
  );
  const completedBattles = Math.min(
    context.totalBattles,
    Math.floor(completedBattleUnits)
  );
  options.onProgress?.({
    phase: 'searching',
    completedPairings: context.pairIndex,
    totalPairings: context.pairCount,
    completedBattles,
    totalBattles: context.totalBattles,
    progress: context.totalBattles > 0 ? completedBattleUnits / context.totalBattles : 1,
    activeFighterAId: context.pair.fighterA.id,
    activeFighterBId: context.pair.fighterB.id,
    activeSeed: progress.activeSeed,
    message: `${context.pair.fighterA.name} vs ${context.pair.fighterB.name} · ${completedBattles.toLocaleString()} / ${context.totalBattles.toLocaleString()} battles`
  });
}
