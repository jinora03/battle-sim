import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import {
  analyzeFighterModuleImpact,
  buildModuleImpactFindings,
  type ModuleImpactResult
} from '@kinetic/video-export';

function duel(
  fighterAId: string,
  fighterBId: string,
  seed: number,
  moduleIdsA: readonly string[],
  moduleIdsB: readonly string[]
): BattleDefinition {
  return {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterAId, team: 1, controller: 'ai', loadout: { moduleIds: [...moduleIdsA] } },
      { fighterId: fighterBId, team: 2, controller: 'ai', loadout: { moduleIds: [...moduleIdsB] } }
    ],
    rules: { friendlyFire: false, teamCollision: 'full', teamCollisionScale: 1, maxBattleTicks: 9000 }
  };
}

describe('Stage 9B module impact analytics', () => {
  it('compares standard and equipped configurations with deterministic progress', async () => {
    const progress: number[] = [];
    const result = await analyzeFighterModuleImpact({
      fighterId: 'frost-warden',
      moduleId: 'razor-rime',
      opponentIds: ['bomber'],
      sampleSize: 2,
      startSeed: 9120,
      createBattle: duel,
      maxTicksPerBattle: 10,
      yieldIntervalTicks: 1000,
      onProgress: (update) => progress.push(update.progress)
    });

    expect(result.totalBattles).toBe(4);
    expect(result.baseline.battles).toBe(2);
    expect(result.equipped.battles).toBe(2);
    expect(result.opponents).toHaveLength(1);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1]!)).toBe(true);
  });

  it('flags large global and matchup-specific swings conservatively', () => {
    const base: Omit<ModuleImpactResult, 'findings'> = {
      fighterId: 'bomber',
      moduleId: 'heavy-fuse',
      sampleSizePerScenario: 20,
      opponentCount: 3,
      totalBattles: 120,
      baseline: { battles: 60, wins: 27, draws: 3, winRate: 0.45, drawRate: 0.05, averageDurationSeconds: 24, timeoutRate: 0 },
      equipped: { battles: 60, wins: 39, draws: 2, winRate: 0.65, drawRate: 0.033, averageDurationSeconds: 21, timeoutRate: 0 },
      winRateDelta: 0.2,
      averageDurationDeltaSeconds: -3,
      opponents: [
        {
          opponentId: 'gunner',
          sampleSizePerScenario: 20,
          baselineWinRate: 0.4,
          equippedWinRate: 0.8,
          winRateDelta: 0.4,
          baselineDrawRate: 0,
          equippedDrawRate: 0,
          baselineAverageDurationSeconds: 25,
          equippedAverageDurationSeconds: 18,
          durationDeltaSeconds: -7
        }
      ]
    };

    const findings = buildModuleImpactFindings(base);
    expect(findings.some((finding) => finding.id === 'global-positive-swing' && finding.severity === 'high')).toBe(true);
    expect(findings.some((finding) => finding.id === 'matchup-gunner' && finding.severity === 'high')).toBe(true);
  });
});
