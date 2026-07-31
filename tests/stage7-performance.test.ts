import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import { LocalSimulationRunner, SpatialHashGrid } from '@kinetic/simulation';
import {
  RuntimePerformanceProfiler,
  classifyPerformancePressure,
  diagnosticsIntervalForEntityCount,
  identifyPerformanceBottleneck
} from '../apps/game/src/runtime/performance';

function createProfileBattle(seed: number): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < 10; index += 1) participants.push({ fighterId: 'volt-striker', team: 1 });
  for (let index = 0; index < 10; index += 1) participants.push({ fighterId: 'mech-bruiser', team: 2 });
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 900 }
  };
}

describe('v1.1 Stage 7 large-battle performance', () => {
  it('reuses one immutable snapshot until simulation state advances', () => {
    const runner = new LocalSimulationRunner(createProfileBattle(7001));
    const first = runner.getSnapshot();
    expect(runner.getSnapshot()).toBe(first);
    runner.step([]);
    const second = runner.getSnapshot();
    expect(second).not.toBe(first);
    expect(runner.getSnapshot()).toBe(second);
  });

  it('reuses spatial buckets and supports bounded projectile queries', () => {
    const grid = new SpatialHashGrid(1000, 1000, 100);
    const ids = Array.from({ length: 100 }, (_, index) => index);
    grid.rebuild(ids, (id) => (id % 10) * 95 + 20, (id) => Math.floor(id / 10) * 95 + 20);
    let pairs = 0;
    grid.forEachCandidatePair(() => { pairs += 1; });
    const queried: number[] = [];
    grid.forEachInAabb(0, 0, 205, 205, (id) => queried.push(id));
    const diagnostics = grid.getDiagnostics();
    expect(pairs).toBeLessThan(4_950);
    expect(diagnostics.occupiedCells).toBeGreaterThan(50);
    expect(diagnostics.maxBucketSize).toBeLessThanOrEqual(4);
    expect(queried).toContain(0);
    expect(queried).toContain(11);
    expect(queried).not.toContain(99);

    grid.rebuild(ids.slice(0, 10), (id) => id * 20, () => 20);
    expect(grid.getDiagnostics().occupiedCells).toBeLessThan(diagnostics.occupiedCells);
  });

  it('reports broadphase and numeric-safety metrics without changing gameplay rules', () => {
    const runner = new LocalSimulationRunner(createProfileBattle(7002));
    for (let tick = 0; tick < 20; tick += 1) runner.step([]);
    const metrics = runner.getSnapshot().metrics;
    expect(metrics.activeEntities).toBe(20);
    expect(metrics.occupiedBroadphaseCells).toBeGreaterThan(0);
    expect(metrics.maxBroadphaseBucket).toBeGreaterThan(0);
    expect(metrics.invalidNumericStates).toBe(0);
  });


  it('reduces diagnostics publication frequency as battles grow', () => {
    expect(diagnosticsIntervalForEntityCount(2)).toBe(6);
    expect(diagnosticsIntervalForEntityCount(24)).toBe(6);
    expect(diagnosticsIntervalForEntityCount(25)).toBe(15);
    expect(diagnosticsIntervalForEntityCount(49)).toBe(60);
    expect(diagnosticsIntervalForEntityCount(100)).toBe(60);
    expect(diagnosticsIntervalForEntityCount(101)).toBe(90);
  });

  it('classifies sustained load and identifies the dominant browser bottleneck', () => {
    expect(classifyPerformancePressure(12, 16.67, 0)).toBe('healthy');
    expect(classifyPerformancePressure(22, 16.67, 9)).toBe('strained');
    expect(identifyPerformanceBottleneck(9, 3)).toBe('simulation');
    expect(identifyPerformanceBottleneck(2, 8)).toBe('render');

    const profiler = new RuntimePerformanceProfiler();
    let summary = profiler.getSummary();
    for (let index = 0; index < 40; index += 1) {
      summary = profiler.record({ simulationMs: 3, renderMs: 18, frameMs: 24 }, 16.67);
    }
    profiler.addDroppedSimulationTicks(3);
    summary = profiler.record({ simulationMs: 3, renderMs: 20, frameMs: 25 }, 16.67);
    expect(summary.pressure === 'strained' || summary.pressure === 'critical').toBe(true);
    expect(summary.bottleneck).toBe('render');
    expect(summary.droppedSimulationTicks).toBe(3);
  });
});
