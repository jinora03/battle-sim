import { describe, expect, it } from 'vitest';
import { AiController, PlayerController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function createBattle(): BattleDefinition {
  return {
    seed: 4812914,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'water-shaper', team: 1, x: 190, y: 480, controller: 'player' },
      { fighterId: 'bomber', team: 2, x: 530, y: 480, controller: 'ai' }
    ]
  };
}

describe('unified controller pipeline', () => {
  it('keeps AI from issuing commands for player-controlled entities', () => {
    const runner = new LocalSimulationRunner(createBattle());
    const commands = new AiController().commandsForTick(runner.getSnapshot());
    expect(commands.some((command) => command.entityId === 0)).toBe(false);
    expect(commands.some((command) => command.entityId === 1)).toBe(true);
  });

  it('emits movement and skill commands from persistent player input', () => {
    const runner = new LocalSimulationRunner(createBattle());
    const player = new PlayerController();
    player.setControlledEntities([0]);
    player.setMovement({ x: 1, y: 0 });
    player.setAim({ x: 1, y: 0 });
    player.activate('skill1');
    const commands = player.commandsForTick(runner.getSnapshot());
    expect(commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'move', entityId: 0 }),
      expect.objectContaining({ type: 'activateAbility', entityId: 0, slot: 'skill1' })
    ]));
  });
});
