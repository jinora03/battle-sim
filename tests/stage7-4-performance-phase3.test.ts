import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function createBattle(seed = 7459, unitsPerTeam = 5): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < unitsPerTeam; index += 1) participants.push({ fighterId: 'gunner', team: 1, controller: 'ai' });
  for (let index = 0; index < unitsPerTeam; index += 1) participants.push({ fighterId: 'mech-bruiser', team: 2, controller: 'ai' });
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
  };
}

describe('v1.1 Stage 7.4 performance phase 3', () => {
  it('reuses the live runtime snapshot while preserving immutable public snapshots', () => {
    const runner = new LocalSimulationRunner(createBattle());
    const immutableBefore = runner.getSnapshot();
    const immutableX = immutableBefore.entities[0]!.x;
    const runtimeBefore = runner.getRuntimeSnapshot();
    const runtimeEntity = runtimeBefore.entities[0]!;
    const runtimeAbilities = runtimeEntity.abilities;
    const runtimeBasic = runtimeAbilities[0]!;

    expect(runner.getRuntimeSnapshot()).toBe(runtimeBefore);
    expect(runner.getRuntimeSnapshot().entities[0]).toBe(runtimeEntity);
    expect(runner.getSnapshot()).toBe(immutableBefore);

    runner.step([]);
    const runtimeAfter = runner.getRuntimeSnapshot();
    const immutableAfter = runner.getSnapshot();

    expect(runtimeAfter).toBe(runtimeBefore);
    expect(runtimeAfter.entities[0]).toBe(runtimeEntity);
    expect(runtimeAfter.entities[0]!.abilities).toBe(runtimeAbilities);
    expect(runtimeAfter.entities[0]!.abilities[0]).toBe(runtimeBasic);
    expect(runtimeAfter.tick).toBe(1);
    expect(immutableBefore.tick).toBe(0);
    expect(immutableBefore.entities[0]!.x).toBe(immutableX);
    expect(immutableAfter).not.toBe(immutableBefore);
    expect(checksumSnapshot(runtimeAfter)).toBe(checksumSnapshot(immutableAfter));
  });

  it('keeps pooled entity and ability objects stable across a 50v50 workload', () => {
    const runner = new LocalSimulationRunner(createBattle(7460, 50));
    const runtime = runner.getRuntimeSnapshot();
    const firstEntity = runtime.entities[0]!;
    const firstAbilities = firstEntity.abilities;
    const lastEntity = runtime.entities[99]!;

    for (let tick = 0; tick < 20; tick += 1) {
      runner.step([]);
      const next = runner.getRuntimeSnapshot();
      expect(next).toBe(runtime);
      expect(next.entities[0]).toBe(firstEntity);
      expect(next.entities[0]!.abilities).toBe(firstAbilities);
      expect(next.entities[99]).toBe(lastEntity);
      expect(next.entities).toHaveLength(100);
    }

    expect(checksumSnapshot(runtime)).toBe(checksumSnapshot(runner.getSnapshot()));
  });
});
