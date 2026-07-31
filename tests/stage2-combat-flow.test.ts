import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function runTicks(runner: LocalSimulationRunner, ticks: number, commandsForTick: (tick: number) => SimulationCommand[] = () => []) {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks && !runner.getSnapshot().battleEnded; tick += 1) {
    events.push(...runner.step(commandsForTick(tick)));
  }
  return events;
}

describe('v1.1 Stage 2 combat flow', () => {
  it('transfers momentum without passive body-contact damage', () => {
    const battle: BattleDefinition = {
      seed: 1201,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'water-shaper', team: 1, controller: 'player', x: 330, y: 470 },
        { fighterId: 'bomber', team: 2, controller: 'player', x: 385, y: 470 }
      ],
      rules: { maxBattleTicks: 600 }
    };
    const runner = new LocalSimulationRunner(battle);
    const initial = runner.getSnapshot().entities.map((entity) => entity.hp);
    const events = runTicks(runner, 90, () => [
      { type: 'move', entityId: 0, direction: { x: 1, y: 0 } },
      { type: 'move', entityId: 1, direction: { x: -1, y: 0 } }
    ]);
    const after = runner.getSnapshot().entities.map((entity) => entity.hp);
    expect(events.some((event) => event.type === 'impact')).toBe(true);
    expect(events.some((event) => event.type === 'damage')).toBe(false);
    expect(after).toEqual(initial);
  });

  it('allows an explicitly configured ram ability to deal collision damage', () => {
    const battle: BattleDefinition = {
      seed: 1202,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'thorn-colossus', team: 1, controller: 'player', x: 280, y: 470 },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 400, y: 470 }
      ],
      rules: { maxBattleTicks: 600 }
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 180, (tick) => {
      const commands: SimulationCommand[] = [
        tick < 24 ? { type: 'stop', entityId: 0 } : { type: 'move', entityId: 0, direction: { x: 1, y: 0 } },
        { type: 'stop', entityId: 1 }
      ];
      if (tick === 0) commands.push({ type: 'activateAbility', entityId: 0, slot: 'skill1', targetId: 1, direction: { x: 1, y: 0 } });
      return commands;
    });
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'bramble-charge')).toBe(true);
    expect(events.some((event) => event.type === 'damage' && event.sourceId === 0 && event.targetId === 1)).toBe(true);
  });

  it('rejects a targeted melee activation outside its configured range', () => {
    const battle: BattleDefinition = {
      seed: 1203,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'thorn-colossus', team: 1, controller: 'player', x: 120, y: 470 },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 690, y: 470 }
      ]
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runner.step([{ type: 'activateAbility', entityId: 0, slot: 'skill1', targetId: 1, direction: { x: 1, y: 0 } }]);
    expect(events.some((event) => event.type === 'abilityActivated')).toBe(false);
  });

  it('rejects a targeted activation when an arena obstacle blocks line of sight', () => {
    const battle: BattleDefinition = {
      seed: 12031,
      arenaId: 'pillar-court',
      modeId: 'duel',
      participants: [
        { fighterId: 'thorn-colossus', team: 1, controller: 'player', x: 308, y: 370 },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 432, y: 370 }
      ]
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runner.step([{ type: 'activateAbility', entityId: 0, slot: 'skill1', targetId: 1, direction: { x: 1, y: 0 } }]);
    expect(events.some((event) => event.type === 'abilityActivated')).toBe(false);
  });

  it('does not bypass an ability cooldown with repeated activation commands', () => {
    const battle: BattleDefinition = {
      seed: 12032,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'mech-bruiser', team: 1, controller: 'player', x: 260, y: 470 },
        { fighterId: 'bomber', team: 2, controller: 'player', x: 500, y: 470 }
      ]
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 90, () => [{ type: 'activateAbility', entityId: 0, slot: 'skill3' }]);
    expect(events.filter((event) => event.type === 'abilityActivated' && event.entityId === 0 && event.abilityId === 'fortify')).toHaveLength(1);
  });

  it('enters a stable result state and stops accepting further combat commands', () => {
    const battle: BattleDefinition = {
      seed: 1204,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'bomber', team: 1, controller: 'player', x: 300, y: 470, statScale: { damage: 3 } },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 410, y: 470, statScale: { hp: 0.08 } }
      ],
      rules: { maxBattleTicks: 300 }
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 180, (tick) => tick === 0
      ? [{ type: 'activateAbility', entityId: 0, slot: 'ultimate', targetId: 1, direction: { x: 1, y: 0 } }]
      : []);
    const final = runner.getSnapshot();
    expect(events.some((event) => event.type === 'battleEnded')).toBe(true);
    expect(final.battleEnded).toBe(true);
    expect(final.result?.winningTeam).toBe(1);
    expect(final.result?.reason).toBe('elimination');
    expect(final.entities.every((entity) => entity.vx === 0 && entity.vy === 0)).toBe(true);
    expect(runner.step([{ type: 'move', entityId: 0, direction: { x: 1, y: 0 } }])).toEqual([]);
    expect(runner.getSnapshot()).toEqual(final);
  });

  it('selects no more than one competing skill command for each AI fighter per tick', () => {
    const battle: BattleDefinition = {
      seed: 1205,
      arenaId: 'pillar-court',
      modeId: 'duel',
      participants: [
        { fighterId: 'mech-bruiser', team: 1 },
        { fighterId: 'bomber', team: 2 }
      ]
    };
    const runner = new LocalSimulationRunner(battle);
    const ai = new AiController();
    for (let tick = 0; tick < 500 && !runner.getSnapshot().battleEnded; tick += 1) {
      const snapshot = runner.getSnapshot();
      const commands = ai.commandsForTick(snapshot);
      for (const entity of snapshot.entities.filter((item) => item.controller === 'ai')) {
        expect(commands.filter((command) => command.entityId === entity.id && command.type === 'activateAbility').length).toBeLessThanOrEqual(1);
      }
      runner.step(commands);
    }
    expect(ai.getDecisionDebug().length).toBeGreaterThan(0);
  });
});
