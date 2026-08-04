import { describe, expect, it } from 'vitest';
import { getAiProfile } from '@kinetic/content';
import {
  getAiAbilityScoreJitter,
  getAiOpeningReadyTick,
  getAiOpeningWindow,
  selectAbilityAction
} from '@kinetic/controllers';
import type { BattleDefinition, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function sentinelSnapshot(seed = 8621): WorldSnapshot {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'solar-sentinel', team: 1, controller: 'ai', x: 240, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 760, y: 360 }
    ],
    rules: {
      maxBattleTicks: 900,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle).getSnapshot();
}

describe('Stage 8.6C-2A seeded opening readiness', () => {
  it('keeps basics immediate while staging movement, normal, payoff and ultimate skills', () => {
    expect(getAiOpeningReadyTick(1, 0, 'basic', 'solar-punch', 'offensive')).toBe(0);
    expect(getAiOpeningWindow('skill1', 'movement')).toEqual({ minTicks: 18, maxTicks: 60, category: 'movement' });
    expect(getAiOpeningWindow('skill1', 'offensive')).toEqual({ minTicks: 30, maxTicks: 120, category: 'normal' });
    expect(getAiOpeningWindow('skill3', 'offensive')).toEqual({ minTicks: 90, maxTicks: 210, category: 'payoff' });
    expect(getAiOpeningWindow('ultimate', 'offensive')).toEqual({ minTicks: 300, maxTicks: 480, category: 'ultimate' });
  });

  it('produces stable delays for the same seed and varied delays across different seeds', () => {
    const first = getAiOpeningReadyTick(8621, 0, 'ultimate', 'solar-laser', 'offensive');
    const repeated = getAiOpeningReadyTick(8621, 0, 'ultimate', 'solar-laser', 'offensive');
    expect(repeated).toBe(first);
    expect(first).toBeGreaterThanOrEqual(300);
    expect(first).toBeLessThanOrEqual(480);

    const delays = new Set(Array.from({ length: 12 }, (_, index) =>
      getAiOpeningReadyTick(8621 + index, 0, 'ultimate', 'solar-laser', 'offensive')
    ));
    expect(delays.size).toBeGreaterThan(1);
  });

  it('holds Solar Eye Beams at battle start and makes it selectable after its seeded window', () => {
    const snapshot = sentinelSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const profile = getAiProfile('solar-sentinel');
    const context = { openingReadiness: true, variationEpoch: 0 } as const;
    const openingReadyTick = getAiOpeningReadyTick(snapshot.seed, self.id, 'ultimate', 'solar-laser', 'offensive');

    const opening = selectAbilityAction(snapshot, self, target, profile, true, undefined, context);
    const ultimateCandidate = opening.debug?.candidates.find((candidate) => candidate.slot === 'ultimate');
    expect(ultimateCandidate).toMatchObject({ valid: false });
    expect(ultimateCandidate?.reason).toContain('opening lockout');
    expect(opening.selected?.abilityId).not.toBe('solar-laser');

    const readySnapshot = { ...snapshot, tick: openingReadyTick };
    const ready = selectAbilityAction(readySnapshot, self, target, profile, true, undefined, context);
    expect(ready.selected).toMatchObject({ kind: 'ability', slot: 'ultimate', abilityId: 'solar-laser' });
  });

  it('keeps score variation stable within an ability epoch instead of rerolling every tick', () => {
    const first = getAiAbilityScoreJitter(8621, 0, 'solar-laser', 0);
    expect(getAiAbilityScoreJitter(8621, 0, 'solar-laser', 0)).toBe(first);
    expect(Math.abs(first)).toBeLessThanOrEqual(3.25);

    const epochs = new Set(Array.from({ length: 8 }, (_, epoch) =>
      getAiAbilityScoreJitter(8621, 0, 'solar-laser', epoch).toFixed(6)
    ));
    expect(epochs.size).toBeGreaterThan(1);
  });
});
