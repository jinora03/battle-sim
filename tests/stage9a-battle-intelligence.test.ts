import { describe, expect, it } from 'vitest';
import { summarizeBattleIntelligence, type RankedSeedBattle } from '@kinetic/video-export';

function result(overrides: Partial<RankedSeedBattle> & Pick<RankedSeedBattle, 'seed' | 'winningTeam'>): RankedSeedBattle {
  return {
    rank: 1,
    score: 50,
    endTick: 1200,
    checksum: `seed-${overrides.seed}`,
    battleEnded: true,
    metrics: {
      durationSeconds: 20,
      totalDamage: 1000,
      damageEvents: 20,
      largestHit: 120,
      knockouts: 1,
      ultimates: 1,
      blasts: 2,
      spectacleEvents: 4,
      winnerRemainingHpRatio: 0.5,
      resultReason: 'elimination'
    },
    labels: [],
    ...overrides
  };
}

describe('Stage 9A battle intelligence summary', () => {
  it('summarizes matchup win rates, pacing, closeness and action metrics', () => {
    const summary = summarizeBattleIntelligence([
      result({ seed: 10, winningTeam: 1, score: 72, metrics: {
        durationSeconds: 10, totalDamage: 800, damageEvents: 10, largestHit: 100, knockouts: 1,
        ultimates: 1, blasts: 2, spectacleEvents: 3, winnerRemainingHpRatio: 0.2, resultReason: 'elimination'
      }}),
      result({ seed: 11, winningTeam: 2, score: 84, metrics: {
        durationSeconds: 20, totalDamage: 1200, damageEvents: 20, largestHit: 180, knockouts: 1,
        ultimates: 2, blasts: 4, spectacleEvents: 7, winnerRemainingHpRatio: 0.8, resultReason: 'elimination'
      }}),
      result({ seed: 12, winningTeam: 1, score: 65, metrics: {
        durationSeconds: 30, totalDamage: 1000, damageEvents: 30, largestHit: 150, knockouts: 1,
        ultimates: 0, blasts: 1, spectacleEvents: 2, winnerRemainingHpRatio: 0.4, resultReason: 'elimination'
      }}),
      result({ seed: 13, winningTeam: null, score: 10, battleEnded: true, metrics: {
        durationSeconds: 40, totalDamage: 600, damageEvents: 12, largestHit: 80, knockouts: 0,
        ultimates: 1, blasts: 0, spectacleEvents: 1, winnerRemainingHpRatio: 0, resultReason: 'draw'
      }})
    ]);

    expect(summary.sampleSize).toBe(4);
    expect(summary.teamWinRates).toEqual([
      { team: 1, wins: 2, rate: 0.5 },
      { team: 2, wins: 1, rate: 0.25 }
    ]);
    expect(summary.drawRate).toBe(0.25);
    expect(summary.averageDurationSeconds).toBe(25);
    expect(summary.medianDurationSeconds).toBe(25);
    expect(summary.averageTotalDamage).toBe(900);
    expect(summary.averageDamageEvents).toBe(18);
    expect(summary.averageUltimates).toBe(1);
    expect(summary.closeFightRate).toBeCloseTo(1 / 3);
    expect(summary.oneSidedFightRate).toBeCloseTo(1 / 3);
    expect(summary.bestCreatorSeed).toBe(11);
    expect(summary.bestCreatorScore).toBe(84);
  });

  it('tracks timeout and safety-limit failures separately', () => {
    const summary = summarizeBattleIntelligence([
      result({ seed: 20, winningTeam: null, battleEnded: true, metrics: {
        durationSeconds: 150, totalDamage: 100, damageEvents: 3, largestHit: 50, knockouts: 0,
        ultimates: 0, blasts: 0, spectacleEvents: 0, winnerRemainingHpRatio: 0, resultReason: 'timeout'
      }}),
      result({ seed: 21, winningTeam: null, battleEnded: false, metrics: {
        durationSeconds: 150, totalDamage: 80, damageEvents: 2, largestHit: 40, knockouts: 0,
        ultimates: 0, blasts: 0, spectacleEvents: 0, winnerRemainingHpRatio: 0, resultReason: 'safety-limit'
      }})
    ]);

    expect(summary.completionRate).toBe(0.5);
    expect(summary.timeoutRate).toBe(0.5);
    expect(summary.safetyLimitRate).toBe(0.5);
    expect(summary.drawRate).toBe(0.5);
  });

  it('returns a stable zero summary for an empty scan', () => {
    expect(summarizeBattleIntelligence([])).toMatchObject({
      sampleSize: 0,
      teamWinRates: [],
      averageDurationSeconds: 0,
      bestCreatorSeed: null
    });
  });
});
