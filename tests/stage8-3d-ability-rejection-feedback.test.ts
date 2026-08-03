import { describe, expect, it } from 'vitest';
import type {
  BattleDefinition,
  ControllerKind,
  SimulationCommand,
  SimulationEvent
} from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function battle(
  fighterId: string,
  controller: ControllerKind,
  sourceX: number,
  targetX: number
): BattleDefinition {
  return {
    seed: 83401,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId, team: 1, controller, x: sourceX, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: targetX, y: 470 }
    ],
    rules: {
      maxBattleTicks: 600,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
}

function activate(slot: 'skill2' | 'skill3'): SimulationCommand {
  return {
    type: 'activateAbility',
    entityId: 0,
    slot,
    targetId: 1,
    direction: { x: 1, y: 0 }
  };
}

function rejection(events: readonly SimulationEvent[]) {
  return events.find(
    (event): event is Extract<SimulationEvent, { type: 'abilityRejected' }> =>
      event.type === 'abilityRejected'
  );
}

describe('Stage 8.3D player ability rejection feedback', () => {
  it('reports an out-of-range player skill without starting its cooldown or changing simulation state', () => {
    const rejectedRunner = new LocalSimulationRunner(battle('gunner', 'player', 160, 900));
    const controlRunner = new LocalSimulationRunner(battle('gunner', 'player', 160, 900));

    const events = rejectedRunner.step([activate('skill2'), { type: 'stop', entityId: 1 }]);
    controlRunner.step([{ type: 'stop', entityId: 1 }]);

    expect(rejection(events)).toMatchObject({
      entityId: 0,
      abilityId: 'suppressive-fire',
      slot: 'skill2',
      reason: 'out-of-range',
      targetId: 1
    });
    expect(events.some((event) => event.type === 'abilityActivated')).toBe(false);
    expect(
      rejectedRunner.getSnapshot().entities[0]?.abilities.find((ability) => ability.slot === 'skill2')
    ).toMatchObject({ phase: 'ready', cooldownRemainingTicks: 0 });
    expect(checksumSnapshot(rejectedRunner.getSnapshot())).toBe(
      checksumSnapshot(controlRunner.getSnapshot())
    );
  });

  it('reports unmet combo requirements for a player without exposing content conditions to AI events', () => {
    const playerRunner = new LocalSimulationRunner(battle('pyro-brawler', 'player', 400, 600));
    const playerEvents = playerRunner.step([activate('skill3'), { type: 'stop', entityId: 1 }]);

    expect(rejection(playerEvents)).toMatchObject({
      entityId: 0,
      abilityId: 'molten-guard',
      slot: 'skill3',
      reason: 'requirements-not-met'
    });

    const aiRunner = new LocalSimulationRunner(battle('pyro-brawler', 'ai', 400, 600));
    const aiEvents = aiRunner.step([activate('skill3'), { type: 'stop', entityId: 1 }]);

    expect(aiEvents.some((event) => event.type === 'abilityRejected')).toBe(false);
    expect(aiEvents.some((event) => event.type === 'abilityActivated')).toBe(false);
  });

  it('distinguishes a busy cast from a skill that is cooling down', () => {
    const runner = new LocalSimulationRunner(battle('gunner', 'player', 220, 520));

    const started = runner.step([activate('skill2'), { type: 'stop', entityId: 1 }]);
    expect(started.some((event) => event.type === 'abilityActivated' && event.abilityId === 'suppressive-fire')).toBe(true);

    const busyEvents = runner.step([activate('skill2'), { type: 'stop', entityId: 1 }]);
    expect(rejection(busyEvents)?.reason).toBe('busy');

    for (let tick = 0; tick < 16; tick += 1) {
      runner.step([{ type: 'stop', entityId: 1 }]);
    }
    const cooldownEvents = runner.step([activate('skill2'), { type: 'stop', entityId: 1 }]);
    expect(rejection(cooldownEvents)?.reason).toBe('cooldown');
  });
});
