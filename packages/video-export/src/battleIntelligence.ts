import type { RankedSeedBattle } from './seedBattleRanking';

export interface BattleIntelligenceTeamRate {
  team: number;
  wins: number;
  rate: number;
}

export interface BattleIntelligenceSummary {
  sampleSize: number;
  completedBattles: number;
  completionRate: number;
  teamWinRates: BattleIntelligenceTeamRate[];
  drawRate: number;
  timeoutRate: number;
  safetyLimitRate: number;
  averageDurationSeconds: number;
  medianDurationSeconds: number;
  averageTotalDamage: number;
  averageDamageEvents: number;
  averageUltimates: number;
  averageSpectacleEvents: number;
  averageWinnerRemainingHpRatio: number;
  closeFightRate: number;
  oneSidedFightRate: number;
  bestCreatorSeed: number | null;
  bestCreatorScore: number | null;
}

/**
 * Aggregates deterministic seed-scan results into matchup-level diagnostics.
 * This stays pure so future roster matrices, CLI tooling, and the UI can share
 * the same definitions without rerunning or coupling to the renderer.
 */
export function summarizeBattleIntelligence(
  results: readonly RankedSeedBattle[]
): BattleIntelligenceSummary {
  const sampleSize = results.length;
  if (sampleSize === 0) return emptySummary();

  const teamWins = new Map<number, number>();
  const durations: number[] = [];
  let completedBattles = 0;
  let draws = 0;
  let timeouts = 0;
  let safetyLimits = 0;
  let totalDamage = 0;
  let totalDamageEvents = 0;
  let totalUltimates = 0;
  let totalSpectacleEvents = 0;
  let winnerHpRatioTotal = 0;
  let decisiveBattles = 0;
  let closeFights = 0;
  let oneSidedFights = 0;
  let best: RankedSeedBattle | null = null;

  for (const result of results) {
    durations.push(result.metrics.durationSeconds);
    totalDamage += result.metrics.totalDamage;
    totalDamageEvents += result.metrics.damageEvents;
    totalUltimates += result.metrics.ultimates;
    totalSpectacleEvents += result.metrics.spectacleEvents;

    if (result.battleEnded) completedBattles += 1;
    else safetyLimits += 1;

    if (result.metrics.resultReason === 'timeout') timeouts += 1;
    if (result.metrics.resultReason === 'draw') draws += 1;

    if (result.winningTeam !== null) {
      teamWins.set(result.winningTeam, (teamWins.get(result.winningTeam) ?? 0) + 1);
      decisiveBattles += 1;
      winnerHpRatioTotal += result.metrics.winnerRemainingHpRatio;
      if (result.metrics.winnerRemainingHpRatio <= 0.3) closeFights += 1;
      if (result.metrics.winnerRemainingHpRatio >= 0.7) oneSidedFights += 1;
    } else if (result.metrics.resultReason !== 'timeout') {
      // A non-timeout result without a winner is effectively a draw even when
      // older result data did not explicitly label it as one.
      draws += result.metrics.resultReason === 'draw' ? 0 : 1;
    }

    if (!best || result.score > best.score || (result.score === best.score && result.seed < best.seed)) {
      best = result;
    }
  }

  durations.sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianDurationSeconds = durations.length % 2 === 0
    ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2
    : durations[middle] ?? 0;

  return {
    sampleSize,
    completedBattles,
    completionRate: completedBattles / sampleSize,
    teamWinRates: [...teamWins.entries()]
      .sort(([teamA], [teamB]) => teamA - teamB)
      .map(([team, wins]) => ({ team, wins, rate: wins / sampleSize })),
    drawRate: draws / sampleSize,
    timeoutRate: timeouts / sampleSize,
    safetyLimitRate: safetyLimits / sampleSize,
    averageDurationSeconds: sum(durations) / sampleSize,
    medianDurationSeconds,
    averageTotalDamage: totalDamage / sampleSize,
    averageDamageEvents: totalDamageEvents / sampleSize,
    averageUltimates: totalUltimates / sampleSize,
    averageSpectacleEvents: totalSpectacleEvents / sampleSize,
    averageWinnerRemainingHpRatio: decisiveBattles > 0 ? winnerHpRatioTotal / decisiveBattles : 0,
    closeFightRate: decisiveBattles > 0 ? closeFights / decisiveBattles : 0,
    oneSidedFightRate: decisiveBattles > 0 ? oneSidedFights / decisiveBattles : 0,
    bestCreatorSeed: best?.seed ?? null,
    bestCreatorScore: best?.score ?? null
  };
}

function emptySummary(): BattleIntelligenceSummary {
  return {
    sampleSize: 0,
    completedBattles: 0,
    completionRate: 0,
    teamWinRates: [],
    drawRate: 0,
    timeoutRate: 0,
    safetyLimitRate: 0,
    averageDurationSeconds: 0,
    medianDurationSeconds: 0,
    averageTotalDamage: 0,
    averageDamageEvents: 0,
    averageUltimates: 0,
    averageSpectacleEvents: 0,
    averageWinnerRemainingHpRatio: 0,
    closeFightRate: 0,
    oneSidedFightRate: 0,
    bestCreatorSeed: null,
    bestCreatorScore: null
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
