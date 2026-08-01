import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

/**
 * Headless, repeatable simulation benchmark.
 *
 * This measures SIMULATION-CORE time only (AI decision + `runner.step`), which
 * is exactly the budget that must hold on the reference device:
 *   - average simulation time  < 12 ms / fixed tick
 *   - p95 simulation time      < 16.67 ms / fixed tick (one 60 Hz frame)
 *
 * Renderer, React UI, effects and audio time are NOT measured here (there is no
 * DOM/canvas/WebAudio in Node); those belong to the in-browser benchmark. The
 * numbers below are relative and machine-dependent, so this file only prints a
 * report and a soft budget verdict. It hard-asserts structural facts and
 * determinism, which are machine-independent and never flaky.
 *
 * Run with: `npm run bench`
 */

interface Scenario {
  label: string;
  perTeam: number;
  arenaId: string;
  modeId: string;
  seed: number;
}

interface BenchResult {
  label: string;
  startEntities: number;
  endEntities: number;
  sampledTicks: number;
  avgStepMs: number;
  p95StepMs: number;
  maxStepMs: number;
  avgAiMs: number;
  avgTotalMs: number;
  heapDeltaMb: number;
}

const SIM_BUDGET_AVG_MS = 12;
const SIM_BUDGET_P95_MS = 1000 / 60; // 16.67 ms

function buildBattle(scenario: Scenario): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < scenario.perTeam; index += 1) {
    participants.push({ fighterId: index % 2 === 0 ? 'water-shaper' : 'pyro-brawler', team: 1, controller: 'ai' });
  }
  for (let index = 0; index < scenario.perTeam; index += 1) {
    participants.push({ fighterId: index % 2 === 0 ? 'bomber' : 'mech-bruiser', team: 2, controller: 'ai' });
  }
  return {
    seed: scenario.seed,
    arenaId: scenario.arenaId,
    modeId: scenario.modeId,
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 100_000 }
  };
}

function percentile(samples: number[], ratio: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function runScenario(scenario: Scenario, ticks: number, warmup: number): BenchResult {
  const runner = new LocalSimulationRunner(buildBattle(scenario));
  const ai = new AiController(false);
  const startEntities = runner.getRuntimeSnapshot().entities.length;

  // Warm up the JIT and steady-state allocation before timing.
  for (let index = 0; index < warmup; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    if (snapshot.battleEnded) break;
    runner.step(ai.commandsForTick(snapshot));
  }

  const stepSamples: number[] = [];
  const aiSamples: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  for (let index = 0; index < ticks; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    if (snapshot.battleEnded) break;
    const aiStart = performance.now();
    const commands = ai.commandsForTick(snapshot);
    const aiMs = performance.now() - aiStart;
    const stepStart = performance.now();
    runner.step(commands);
    const stepMs = performance.now() - stepStart;
    stepSamples.push(stepMs);
    aiSamples.push(aiMs);
  }
  const heapAfter = process.memoryUsage().heapUsed;

  const avg = (list: number[]) => (list.length === 0 ? 0 : list.reduce((sum, value) => sum + value, 0) / list.length);
  const avgStepMs = avg(stepSamples);
  const avgAiMs = avg(aiSamples);
  return {
    label: scenario.label,
    startEntities,
    endEntities: runner.getRuntimeSnapshot().entities.length,
    sampledTicks: stepSamples.length,
    avgStepMs,
    p95StepMs: percentile(stepSamples, 0.95),
    maxStepMs: stepSamples.reduce((max, value) => Math.max(max, value), 0),
    avgAiMs,
    avgTotalMs: avgStepMs + avgAiMs,
    heapDeltaMb: (heapAfter - heapBefore) / (1024 * 1024)
  };
}

function report(results: BenchResult[]): void {
  const fmt = (value: number, width = 8) => value.toFixed(3).padStart(width);
  const lines: string[] = [];
  lines.push('');
  lines.push('  Kinetic Battle Engine — headless simulation benchmark (sim-core only)');
  lines.push(`  Node ${process.version} · budget: avg step < ${SIM_BUDGET_AVG_MS} ms, p95 step < ${SIM_BUDGET_P95_MS.toFixed(2)} ms`);
  lines.push('  ' + '-'.repeat(96));
  lines.push('  scenario        entities  ticks   avgStep   p95Step   maxStep    avgAI   avgTotal   heapΔMB   verdict');
  lines.push('  ' + '-'.repeat(96));
  for (const r of results) {
    const is50v50 = r.label.startsWith('50v50');
    const verdict = is50v50
      ? (r.avgStepMs < SIM_BUDGET_AVG_MS && r.p95StepMs < SIM_BUDGET_P95_MS ? 'PASS' : 'OVER-BUDGET')
      : '—';
    lines.push(
      `  ${r.label.padEnd(14)} ${String(`${r.startEntities}→${r.endEntities}`).padStart(9)} ${String(r.sampledTicks).padStart(6)}` +
      ` ${fmt(r.avgStepMs)} ${fmt(r.p95StepMs)} ${fmt(r.maxStepMs)} ${fmt(r.avgAiMs)} ${fmt(r.avgTotalMs)} ${fmt(r.heapDeltaMb)}   ${verdict}`
    );
  }
  lines.push('  ' + '-'.repeat(96));
  lines.push('  Note: renderer / React / effects / audio time is NOT included (headless). heapΔ is an');
  lines.push('  approximate allocation indicator without forced GC. Certify FPS/memory in the browser bench.');
  lines.push('');
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

describe('simulation performance benchmark', () => {
  const scenarios: Scenario[] = [
    { label: '1v1', perTeam: 1, arenaId: 'iron-pit', modeId: 'duel', seed: 0x1a2b3c },
    { label: '20v20', perTeam: 20, arenaId: 'war-basin', modeId: 'mass-skirmish', seed: 0x20b2b0 },
    { label: '50v50', perTeam: 50, arenaId: 'war-basin', modeId: 'mass-skirmish', seed: 0x505050 }
  ];

  it('measures sim-core time for 1v1 / 20v20 / 50v50 and reports against the budget', () => {
    const results: BenchResult[] = [
      runScenario(scenarios[0]!, 900, 60),
      runScenario(scenarios[1]!, 600, 60),
      runScenario(scenarios[2]!, 600, 30)
    ];
    report(results);

    // Machine-independent structural guarantees (never flaky):
    expect(results[0]!.startEntities).toBe(2);
    expect(results[1]!.startEntities).toBe(40);
    expect(results[2]!.startEntities).toBe(100);
    for (const result of results) {
      expect(result.sampledTicks).toBeGreaterThan(0);
      expect(Number.isFinite(result.avgStepMs)).toBe(true);
      expect(result.avgStepMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('50v50 remains deterministic across two identical runs (portability guard)', () => {
    const scenario = scenarios[2]!;
    const runOnce = (): string => {
      const runner = new LocalSimulationRunner(buildBattle(scenario));
      const ai = new AiController(false);
      for (let tick = 0; tick < 400; tick += 1) {
        const snapshot = runner.getRuntimeSnapshot();
        if (snapshot.battleEnded) break;
        runner.step(ai.commandsForTick(snapshot));
      }
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(runOnce()).toBe(runOnce());
  });
});
