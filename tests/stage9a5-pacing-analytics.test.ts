import { describe, expect, it } from 'vitest';
import type { SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import {
  BattlePacingAnalyticsCollector,
  getFighterPacingAnalytics,
  type RankedSeedBattle
} from '@kinetic/video-export';

function snapshot(): WorldSnapshot {
  return {
    tick: 0,
    entities: [
      { id: 1, fighterId: 'pyro-brawler' },
      { id: 2, fighterId: 'bomber' }
    ]
  } as WorldSnapshot;
}

function result(endTick: number, resultReason = 'elimination'): RankedSeedBattle {
  return {
    rank: 1,
    seed: 1,
    score: 50,
    endTick,
    checksum: 'test',
    battleEnded: resultReason !== 'safety-limit',
    winningTeam: 1,
    labels: [],
    metrics: {
      durationSeconds: endTick / 60,
      totalDamage: 100,
      damageEvents: 2,
      largestHit: 60,
      knockouts: 1,
      ultimates: 1,
      blasts: 0,
      spectacleEvents: 2,
      winnerRemainingHpRatio: 0.4,
      resultReason
    }
  };
}

describe('Stage 9A.5 battle pacing analytics', () => {
  it('measures opening timing, ult timing, KOs and quiet combat gaps', () => {
    const collector = new BattlePacingAnalyticsCollector();
    collector.beginBattle(snapshot());
    collector.observeEvents([
      {
        type: 'abilityActivated', tick: 60, entityId: 1, abilityId: 'flame-ring', slot: 'skill1',
        position: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, castTicks: 8
      },
      {
        type: 'damage', tick: 120, sourceId: 1, targetId: 2, amount: 20, element: 'fire', hpAfter: 80,
        position: { x: 10, y: 0 }
      },
      {
        type: 'abilityActivated', tick: 600, entityId: 2, abilityId: 'carpet-bombing', slot: 'ultimate',
        position: { x: 20, y: 0 }, direction: { x: -1, y: 0 }, castTicks: 12
      },
      { type: 'death', tick: 900, entityId: 2, killerId: 1, position: { x: 20, y: 0 } }
    ] satisfies SimulationEvent[]);
    collector.endBattle(result(1200));

    collector.beginBattle(snapshot());
    collector.observeEvents([
      {
        type: 'damage', tick: 480, sourceId: 2, targetId: 1, amount: 25, element: 'neutral', hpAfter: 75,
        position: { x: 0, y: 0 }
      }
    ] satisfies SimulationEvent[]);
    collector.endBattle(result(720));

    const analytics = collector.summarize();
    expect(analytics.overall.battleSamples).toBe(2);
    expect(analytics.overall.averageFirstDamageSeconds).toBe(5);
    expect(analytics.overall.slowOpeningRate).toBe(0.5);
    expect(analytics.overall.ultimateBattleRate).toBe(0.5);
    expect(analytics.overall.stallBattleRate).toBeGreaterThan(0);

    const pyro = getFighterPacingAnalytics(analytics, 'pyro-brawler');
    expect(pyro?.battleSamples).toBe(2);
    expect(pyro?.averageFirstDamageDealtSeconds).toBe(2);
    expect(pyro?.averageFirstSkillUseSeconds).toBe(1);
    expect(pyro?.averageFirstUltimateUseSeconds).toBeNull();
  });
});
