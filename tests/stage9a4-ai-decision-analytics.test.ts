import { describe, expect, it } from 'vitest';
import type { AiDecisionDebug } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import {
  AiDecisionAnalyticsCollector,
  getFighterAiDecisionAnalytics,
  runHeadlessSeedSimulation
} from '@kinetic/video-export';

function duel(seed: number): BattleDefinition {
  return {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'ai', loadout: { moduleIds: [] } },
      { fighterId: 'bomber', team: 2, controller: 'ai', loadout: { moduleIds: [] } }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'full',
      teamCollisionScale: 1,
      maxBattleTicks: 9000
    }
  };
}

describe('Stage 9A.4 AI decision analytics', () => {
  it('separates valid-but-skipped actions from concrete blocker reasons', () => {
    const collector = new AiDecisionAnalyticsCollector();
    collector.beginBattle([{ id: 1, fighterId: 'gunner' }]);

    collector.observeDecision({
      entityId: 1,
      targetId: 2,
      kind: 'ability',
      slot: 'skill2',
      abilityId: 'suppressive-fire',
      score: 60,
      distance: 240,
      reason: 'Suppressive Fire: skill ready',
      candidates: [
        { slot: 'skill1', abilityId: 'tactical-slide', abilityName: 'Tactical Slide', valid: true, score: 48, reason: 'skill ready', distance: 240, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'skill2', abilityId: 'suppressive-fire', abilityName: 'Suppressive Fire', valid: true, score: 60, reason: 'skill ready', distance: 240, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'skill3', abilityId: 'pinning-round', abilityName: 'Pinning Round', valid: false, score: 52, reason: 'cooldown', distance: 240, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'ultimate', abilityId: 'kill-zone', abilityName: 'Kill Zone', valid: false, score: 70, reason: 'opening lockout (240 ticks remaining)', distance: 240, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'basic', abilityId: 'automatic-rifle', abilityName: 'Automatic Rifle', valid: true, score: 30, reason: 'primary attack ready', distance: 240, targetCount: 1, source: 'primaryAttack', targetId: 2 }
      ]
    } satisfies AiDecisionDebug, 60);

    collector.observeDecision({
      entityId: 1,
      targetId: 2,
      kind: 'move',
      slot: null,
      abilityId: null,
      score: 0,
      distance: 680,
      reason: 'No valid attack; repositioning into range.',
      candidates: [
        { slot: 'skill1', abilityId: 'tactical-slide', abilityName: 'Tactical Slide', valid: false, score: 48, reason: 'target out of range (680 > 520)', distance: 680, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'skill2', abilityId: 'suppressive-fire', abilityName: 'Suppressive Fire', valid: false, score: 60, reason: 'cooldown', distance: 680, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'skill3', abilityId: 'pinning-round', abilityName: 'Pinning Round', valid: false, score: 52, reason: 'cooldown', distance: 680, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'ultimate', abilityId: 'kill-zone', abilityName: 'Kill Zone', valid: false, score: 70, reason: 'opening lockout (180 ticks remaining)', distance: 680, targetCount: 1, source: 'ability', targetId: 2 },
        { slot: 'basic', abilityId: 'automatic-rifle', abilityName: 'Automatic Rifle', valid: false, score: 30, reason: 'moving into primary range', distance: 680, targetCount: 1, source: 'primaryAttack', targetId: 2 }
      ]
    } satisfies AiDecisionDebug, 120);

    collector.endBattle();
    const gunner = getFighterAiDecisionAnalytics(collector.summarize(), 'gunner');
    expect(gunner?.decisionEvaluations).toBe(2);
    expect(gunner?.abilitySelections).toBe(1);
    expect(gunner?.repositionDecisions).toBe(1);

    const suppressive = gunner?.actions.find((action) => action.actionId === 'suppressive-fire');
    expect(suppressive?.validOpportunities).toBe(1);
    expect(suppressive?.selections).toBe(1);
    expect(suppressive?.blockedRate).toBe(0.5);
    expect(suppressive?.blockReasons[0]?.category).toBe('cooldown-or-busy');

    const slide = gunner?.actions.find((action) => action.actionId === 'tactical-slide');
    expect(slide?.readyButSkipped).toBe(1);
    expect(slide?.readyButSkippedRate).toBe(1);
    expect(slide?.blockReasons[0]?.category).toBe('range');
  });

  it('observes live AI decisions without changing the deterministic checksum', async () => {
    const battle = duel(9123);
    const baseline = await runHeadlessSeedSimulation(battle, {
      recordReplay: false,
      requireBattleEnd: false,
      maxTicks: 180,
      yieldIntervalTicks: 1000
    });
    const decisions: AiDecisionDebug[] = [];
    const observed = await runHeadlessSeedSimulation(battle, {
      recordReplay: false,
      requireBattleEnd: false,
      maxTicks: 180,
      yieldIntervalTicks: 1000,
      onAiDecision: (decision) => decisions.push(decision)
    });

    expect(decisions.length).toBeGreaterThan(0);
    expect(observed.endTick).toBe(baseline.endTick);
    expect(observed.checksum).toBe(baseline.checksum);
  });
});
