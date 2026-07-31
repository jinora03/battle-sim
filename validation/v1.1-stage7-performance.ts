import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner, SpatialHashGrid } from '@kinetic/simulation';
import {
  RuntimePerformanceProfiler,
  classifyPerformancePressure,
  identifyPerformanceBottleneck
} from '../apps/game/src/runtime/performance';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createMassBattle(seed: number): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < 20; index += 1) {
    participants.push({ fighterId: index % 2 === 0 ? 'water-shaper' : 'pyro-brawler', team: 1 });
    participants.push({ fighterId: index % 2 === 0 ? 'bomber' : 'volt-striker', team: 2 });
  }
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'soft',
      teamCollisionScale: 0.24,
      collisionDamageCooldownTicks: 12,
      maxBattleTicks: 1_800
    }
  };
}

function run(seed: number, ticks = 900) {
  const runner = new LocalSimulationRunner(createMassBattle(seed));
  const ai = new AiController();
  const initial = runner.getSnapshot();
  assert(runner.getSnapshot() === initial, 'Snapshot was not reused before state advanced.');
  let snapshot = initial;
  let maxCandidates = 0;
  let projectileChecks = 0;

  for (let index = 0; index < ticks && !snapshot.battleEnded; index += 1) {
    runner.step(ai.commandsForTick(snapshot));
    const next = runner.getSnapshot();
    assert(next !== snapshot, 'Simulation step did not invalidate the snapshot cache.');
    assert(runner.getSnapshot() === next, 'Snapshot was rebuilt without a state change.');
    snapshot = next;
    maxCandidates = Math.max(maxCandidates, snapshot.metrics.candidatePairs);
    projectileChecks += snapshot.metrics.projectileEntityChecks + snapshot.metrics.projectileObstacleChecks;
    assert(snapshot.metrics.invalidNumericStates === 0, 'Unexpected numeric recovery in normal benchmark.');
  }

  return { snapshot, checksum: checksumSnapshot(snapshot), maxCandidates, projectileChecks };
}

const grid = new SpatialHashGrid(1_000, 1_000, 100);
const ids = Array.from({ length: 100 }, (_, index) => index);
grid.rebuild(ids, (id) => (id % 10) * 95 + 20, (id) => Math.floor(id / 10) * 95 + 20);
const selected: number[] = [];
grid.forEachInAabb(0, 0, 205, 205, (id) => selected.push(id));
assert(selected.includes(0) && selected.includes(11) && !selected.includes(99), 'Bounded spatial query failed.');

const first = run(707_070);
const second = run(707_070);
assert(first.checksum === second.checksum, '20v20 checksum mismatch.');
assert(first.snapshot.tick === second.snapshot.tick, '20v20 ending tick mismatch.');
assert(first.maxCandidates < 780, 'Broadphase regressed to all-pairs candidate count.');
assert(first.projectileChecks > 0, 'Projectile bounded queries were not exercised.');

assert(classifyPerformancePressure(12, 16.67, 0) === 'healthy', 'Healthy pressure classification failed.');
assert(classifyPerformancePressure(22, 16.67, 9) === 'strained', 'Strained pressure classification failed.');
assert(identifyPerformanceBottleneck(9, 3) === 'simulation', 'Simulation bottleneck classification failed.');
assert(identifyPerformanceBottleneck(2, 8) === 'render', 'Render bottleneck classification failed.');
const profiler = new RuntimePerformanceProfiler();
let summary = profiler.getSummary();
for (let index = 0; index < 40; index += 1) {
  summary = profiler.record({ simulationMs: 3, renderMs: 18, frameMs: 24 }, 16.67);
}
profiler.addDroppedSimulationTicks(3);
summary = profiler.record({ simulationMs: 3, renderMs: 20, frameMs: 25 }, 16.67);
assert(summary.pressure !== 'healthy', 'Sustained slow frames were not classified as pressure.');
assert(summary.bottleneck === 'render', 'Profiler did not identify render bottleneck.');
assert(summary.droppedSimulationTicks === 3, 'Dropped simulation ticks were not retained.');

console.log(`PASS Stage 7 deterministic 20v20 checksum ${first.checksum}`);
console.log(`PASS broadphase max candidates ${first.maxCandidates}; projectile checks ${first.projectileChecks}`);
console.log(`PASS profiler ${summary.pressure}/${summary.bottleneck}; dropped ticks ${summary.droppedSimulationTicks}`);
