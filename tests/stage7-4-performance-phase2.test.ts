import { describe, expect, it } from 'vitest';
import { getAiProfile } from '@kinetic/content';
import { AiController, aiWorkloadPolicyForEntityCount, selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function duelSnapshot(): WorldSnapshot {
  const battle: BattleDefinition = {
    seed: 7458,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'ai', x: 280, y: 340 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'ai', x: 720, y: 340 }
    ],
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
  };
  return new LocalSimulationRunner(battle).getSnapshot();
}

function massSnapshot(tick: number): WorldSnapshot {
  const base = duelSnapshot();
  const first = base.entities[0]!;
  const second = base.entities[1]!;
  const entities: EntitySnapshot[] = [];
  for (let index = 0; index < 100; index += 1) {
    const team = index < 50 ? 1 : 2;
    const template = team === 1 ? first : second;
    const local = team === 1 ? index : index - 50;
    entities.push({
      ...template,
      id: index,
      team,
      x: 120 + (local % 10) * 70 + (team === 2 ? 760 : 0),
      y: 110 + Math.floor(local / 10) * 100,
      abilities: template.abilities.map((ability) => ({ ...ability })),
      statuses: template.statuses.map((status) => ({ ...status })),
      activeZoneIds: [...template.activeZoneIds]
    });
  }
  return { ...base, tick, entities };
}

describe('v1.1 Stage 7.4 performance phase 2', () => {
  it('uses progressively lower AI decision cadences for larger battles', () => {
    expect(aiWorkloadPolicyForEntityCount(24)).toEqual({
      reactionIntervalFloor: 1,
      attackDecisionInterval: 1,
      aimRefreshInterval: 1,
      clusterRefreshInterval: 1
    });
    expect(aiWorkloadPolicyForEntityCount(100)).toEqual({
      reactionIntervalFloor: 8,
      attackDecisionInterval: 5,
      aimRefreshInterval: 2,
      clusterRefreshInterval: 20
    });
    expect(aiWorkloadPolicyForEntityCount(140).attackDecisionInterval).toBe(8);
  });

  it('keeps fast action selection identical while omitting debug allocations', () => {
    const snapshot = duelSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const profile = getAiProfile('ranged-gunner');
    const detailed = selectAbilityAction(snapshot, self, target, profile);
    const fast = selectAbilityAction(snapshot, self, target, profile, false);

    expect(fast.debug).toBeNull();
    expect(fast.selected?.kind).toBe(detailed.selected?.kind);
    expect(fast.selected?.slot).toBe(detailed.selected?.slot);
    expect(fast.selected?.abilityId).toBe(detailed.selected?.abilityId);
    expect(fast.selected?.targetId).toBe(detailed.selected?.targetId);
    expect(fast.selected?.score).toBe(detailed.selected?.score);
    expect(detailed.debug.candidates.length).toBeGreaterThan(0);
  });

  it('staggers mass-battle attack evaluations instead of evaluating all 100 fighters together', () => {
    const ai = new AiController(false);
    const evaluations: number[] = [];
    for (let tick = 0; tick < 5; tick += 1) {
      const commands = ai.commandsForTick(massSnapshot(tick));
      const stats = ai.getWorkloadStats();
      evaluations.push(stats.attackEvaluations);
      expect(commands.filter((command) => command.type === 'move')).toHaveLength(100);
      expect(stats.attackDecisionInterval).toBe(5);
      expect(stats.aiEntities).toBe(100);
    }

    expect(Math.max(...evaluations)).toBeLessThanOrEqual(20);
    expect(evaluations.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(100);
  });
});
