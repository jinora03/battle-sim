import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import {
  analyzeRosterMatchups,
  getFighterMatchupWinRate,
  getMatchupCell
} from '@kinetic/video-export';

function duel(fighterAId: string, fighterBId: string, seed: number): BattleDefinition {
  return {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterAId, team: 1, controller: 'ai', loadout: { moduleIds: [] } },
      { fighterId: fighterBId, team: 2, controller: 'ai', loadout: { moduleIds: [] } }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'full',
      teamCollisionScale: 1,
      maxBattleTicks: 9000
    }
  };
}

describe('Stage 9A.2 roster matchup matrix', () => {
  it('runs every unique pairing and exposes row-relative matrix rates', async () => {
    const fighters = [
      { id: 'pyro-brawler', name: 'Pyro' },
      { id: 'bomber', name: 'Bomber' },
      { id: 'gunner', name: 'Gunner' }
    ];

    const result = await analyzeRosterMatchups(fighters, {
      sampleSize: 2,
      startSeed: 700,
      createBattle: duel,
      maxTicksPerBattle: 12,
      yieldIntervalTicks: 1000
    });

    expect(result.totalPairings).toBe(3);
    expect(result.totalBattles).toBe(6);
    expect(result.cells).toHaveLength(3);
    expect(result.fighterSummaries).toHaveLength(3);
    expect(result.abilityAnalytics.fighters).toHaveLength(3);
    expect(result.abilityAnalytics.fighters.every((fighter) => fighter.battleSamples === 4)).toBe(true);
    expect(result.aiDecisionAnalytics.fighters).toHaveLength(3);
    expect(result.aiDecisionAnalytics.fighters.every((fighter) => fighter.battleSamples === 4)).toBe(true);
    expect(result.pacingAnalytics.overall.battleSamples).toBe(6);
    expect(result.findings.length).toBeGreaterThan(0);

    const cell = getMatchupCell(result, 'pyro-brawler', 'bomber');
    expect(cell).not.toBeNull();
    expect(cell?.sampleSize).toBe(2);
    if (cell) {
      expect(getFighterMatchupWinRate(cell, 'pyro-brawler')).toBe(cell.fighterAId === 'pyro-brawler' ? cell.fighterAWinRate : cell.fighterBWinRate);
      expect(getFighterMatchupWinRate(cell, 'bomber')).toBe(cell.fighterAId === 'bomber' ? cell.fighterAWinRate : cell.fighterBWinRate);
    }
  });

  it('reports deterministic progress across the whole matrix', async () => {
    const progress: number[] = [];
    const result = await analyzeRosterMatchups([
      { id: 'pyro-brawler', name: 'Pyro' },
      { id: 'bomber', name: 'Bomber' }
    ], {
      sampleSize: 2,
      startSeed: 42,
      createBattle: duel,
      maxTicksPerBattle: 8,
      yieldIntervalTicks: 1000,
      onProgress: (update) => progress.push(update.progress)
    });

    expect(result.totalPairings).toBe(1);
    expect(result.totalBattles).toBe(2);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1]!)).toBe(true);
  });
});
