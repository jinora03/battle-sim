import { describe, expect, it } from 'vitest';
import type { BattleDefinition, SimulationCommand } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';

const battle: BattleDefinition = {
  seed: 7401,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'gunner', team: 1 },
    { fighterId: 'bomber', team: 2 }
  ],
  rules: { friendlyFire: false, teamCollision: 'full', teamCollisionScale: 1, maxBattleTicks: 900 }
};

describe('v1.1 Stage 7.4 performance phase 1', () => {
  it('reports replay counts without exporting or cloning the full replay', () => {
    const recorder = new ReplayRecorder(battle);
    const commands: SimulationCommand[] = [
      { type: 'move', entityId: 0, direction: { x: 1, y: 0 }, facing: { x: 1, y: 0 } },
      { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } }
    ];

    expect(recorder.frameCount).toBe(0);
    expect(recorder.commandCount).toBe(0);
    recorder.record(0, commands);
    expect(recorder.frameCount).toBe(1);
    expect(recorder.commandCount).toBe(2);

    const exported = recorder.export();
    expect(exported.frames).toHaveLength(1);
    expect(recorder.frameCount).toBe(1);

    recorder.reset({ ...battle, seed: 7402 });
    expect(recorder.frameCount).toBe(0);
    expect(recorder.commandCount).toBe(0);
  });
});
