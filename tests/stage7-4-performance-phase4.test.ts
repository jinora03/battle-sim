import { describe, expect, it } from 'vitest';
import { AiController, ReplayController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationCommand } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

const duel: BattleDefinition = {
  seed: 7460,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'gunner', team: 1, controller: 'ai', x: 250, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'ai', x: 750, y: 360 }
  ],
  rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
};

describe('v1.1 Stage 7.4 performance phase 4', () => {
  it('losslessly run-length encodes repeated movement commands', () => {
    const recorder = new ReplayRecorder(duel);
    const commands: SimulationCommand[] = [];
    for (let entityId = 0; entityId < 100; entityId += 1) {
      commands.push({ type: 'move', entityId, direction: { x: 1, y: 0 }, facing: { x: 0, y: 1 } });
    }
    for (let tick = 0; tick < 120; tick += 1) recorder.record(tick, commands);

    const replay = recorder.export();
    expect(replay.schemaVersion).toBe(2);
    if (replay.schemaVersion !== 2) throw new Error('Expected replay schema 2');
    expect(recorder.commandCount).toBe(12_000);
    expect(recorder.storedCommandCount).toBe(100);
    expect(replay.frames).toHaveLength(0);
    expect(replay.movementRuns).toHaveLength(100);
    expect(replay.movementRuns[0]).toMatchObject({ startTick: 0, endTick: 119 });
    expect(recorder.compressionRatio).toBeGreaterThan(0.99);
  });

  it('splits exact movement runs and preserves action frames', () => {
    const recorder = new ReplayRecorder(duel);
    recorder.record(0, [{ type: 'move', entityId: 0, direction: { x: 1, y: 0 } }]);
    recorder.record(1, [
      { type: 'move', entityId: 0, direction: { x: 1, y: 0 } },
      { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } }
    ]);
    recorder.record(2, [{ type: 'move', entityId: 0, direction: { x: 0, y: 1 } }]);
    recorder.record(3, []);

    const replay = recorder.export();
    if (replay.schemaVersion !== 2) throw new Error('Expected replay schema 2');
    expect(replay.frames).toHaveLength(1);
    expect(replay.frames[0]?.tick).toBe(1);
    expect(replay.movementRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ startTick: 0, endTick: 1 }),
      expect.objectContaining({ startTick: 2, endTick: 2 })
    ]));
  });

  it('replays schema 2 to the same deterministic checksum', () => {
    const original = new LocalSimulationRunner(duel);
    const ai = new AiController();
    const recorder = new ReplayRecorder(duel);

    for (let tick = 0; tick < 240; tick += 1) {
      const snapshot = original.getRuntimeSnapshot();
      const commands = ai.commandsForTick(snapshot);
      recorder.record(snapshot.tick, commands);
      original.step(commands);
    }

    const replay = recorder.export();
    const playback = new LocalSimulationRunner(duel);
    const controller = new ReplayController(replay);
    for (let tick = 0; tick < 240; tick += 1) {
      const commands = controller.commandsForTick(playback.getRuntimeSnapshot());
      playback.step(commands);
    }

    expect(replay.schemaVersion).toBe(2);
    expect(checksumSnapshot(playback.getSnapshot())).toBe(checksumSnapshot(original.getSnapshot()));
  });
});
