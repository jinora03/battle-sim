import { AiController, PlayerController } from '@kinetic/controllers';
import type { BattleDefinition, ReplayData, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner, SIM_TICK_RATE } from '@kinetic/simulation';
import { VIDEO_EXPORT_MAX_DURATION_SECONDS, type ReplayExportSource } from './types';

const DEFAULT_YIELD_INTERVAL_TICKS = 180;
const DEFAULT_PROGRESS_INTERVAL_TICKS = 30;

export type SeedReplayGenerationPhase = 'preparing' | 'simulating' | 'complete';

export interface SeedReplayGenerationProgress {
  phase: SeedReplayGenerationPhase;
  simulatedTicks: number;
  maxTicks: number;
  progress: number;
  message: string;
}

export interface SeedReplayGenerationOptions {
  signal?: AbortSignal;
  onProgress?(progress: SeedReplayGenerationProgress): void;
  /** Test/perf escape hatch. Runtime callers should normally use the battle/export limits. */
  maxTicks?: number;
  yieldIntervalTicks?: number;
  progressIntervalTicks?: number;
}

export interface HeadlessSeedSimulationOptions extends SeedReplayGenerationOptions {
  /** Batch ranking can skip replay recording to reduce allocations and memory pressure. */
  recordReplay?: boolean;
  /** Batch ranking may keep a timed-out candidate as a low-scoring result. */
  requireBattleEnd?: boolean;
  onInitialSnapshot?(snapshot: WorldSnapshot): void;
  onEvents?(events: readonly SimulationEvent[]): void;
}

export interface HeadlessSeedSimulationResult {
  replay: ReplayData | null;
  endTick: number;
  checksum: string;
  battleEnded: boolean;
  finalSnapshot: WorldSnapshot;
}

export class SeedReplayGenerationError extends Error {
  constructor(
    message: string,
    readonly code: 'cancelled' | 'invalid-battle' | 'max-ticks'
  ) {
    super(message);
    this.name = 'SeedReplayGenerationError';
  }
}

/**
 * Runs the same fixed-step simulation/controller pipeline as an untouched live
 * battle, but without Pixi, React, audio, camera, or a visible battle runtime.
 * Replay recording is optional so Stage 8.11B can scan many seeds cheaply.
 */
export async function runHeadlessSeedSimulation(
  battle: BattleDefinition,
  options: HeadlessSeedSimulationOptions = {}
): Promise<HeadlessSeedSimulationResult> {
  validateBattleDefinition(battle);
  throwIfCancelled(options.signal);

  const workingBattle = structuredClone(battle);
  const hardExportLimit = VIDEO_EXPORT_MAX_DURATION_SECONDS * SIM_TICK_RATE;
  const battleLimit = positiveInteger(workingBattle.rules?.maxBattleTicks) ?? hardExportLimit;
  const requestedLimit = positiveInteger(options.maxTicks) ?? hardExportLimit;
  const maxTicks = Math.min(battleLimit, requestedLimit, hardExportLimit);
  const yieldIntervalTicks = Math.max(1, positiveInteger(options.yieldIntervalTicks) ?? DEFAULT_YIELD_INTERVAL_TICKS);
  const progressIntervalTicks = Math.max(1, positiveInteger(options.progressIntervalTicks) ?? DEFAULT_PROGRESS_INTERVAL_TICKS);
  const recordReplay = options.recordReplay ?? false;
  const requireBattleEnd = options.requireBattleEnd ?? true;

  let runner: LocalSimulationRunner;
  try {
    runner = new LocalSimulationRunner(workingBattle);
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : 'unknown simulation setup error';
    throw new SeedReplayGenerationError(`The configured battle cannot be simulated: ${detail}`, 'invalid-battle');
  }

  const ai = new AiController(false);
  const player = new PlayerController();
  const recorder = recordReplay ? new ReplayRecorder(workingBattle) : null;
  const initialSnapshot = runner.getRuntimeSnapshot();
  options.onInitialSnapshot?.(initialSnapshot);
  player.setControlledEntities(
    initialSnapshot.entities
      .filter((entity) => entity.controller === 'player')
      .map((entity) => entity.id)
  );

  report(options, {
    phase: 'preparing',
    simulatedTicks: 0,
    maxTicks,
    progress: 0,
    message: 'Preparing headless battle simulation.'
  });

  while (!runner.getRuntimeSnapshot().battleEnded && runner.tick < maxTicks) {
    throwIfCancelled(options.signal);
    const snapshot = runner.getRuntimeSnapshot();
    const commands = ai.commandsForTick(snapshot);
    commands.push(...player.commandsForTick(snapshot));
    recorder?.record(snapshot.tick, commands);
    const events = runner.step(commands);
    options.onEvents?.(events);

    if (runner.tick % progressIntervalTicks === 0 || runner.getRuntimeSnapshot().battleEnded) {
      report(options, {
        phase: 'simulating',
        simulatedTicks: runner.tick,
        maxTicks,
        progress: Math.min(0.999, runner.tick / maxTicks),
        message: `Simulating battle · ${runner.tick.toLocaleString()} / ${maxTicks.toLocaleString()} ticks`
      });
    }

    if (runner.tick % yieldIntervalTicks === 0) await yieldToHost();
  }

  throwIfCancelled(options.signal);
  const finalSnapshot = runner.getSnapshot();
  if (!finalSnapshot.battleEnded && requireBattleEnd) {
    throw new SeedReplayGenerationError(
      `The battle did not terminate within the ${maxTicks.toLocaleString()} tick safety limit.`,
      'max-ticks'
    );
  }

  report(options, {
    phase: 'complete',
    simulatedTicks: finalSnapshot.tick,
    maxTicks,
    progress: 1,
    message: finalSnapshot.battleEnded
      ? `Battle simulation complete · ${finalSnapshot.tick.toLocaleString()} ticks simulated.`
      : `Simulation safety limit reached · ${finalSnapshot.tick.toLocaleString()} ticks simulated.`
  });

  return {
    replay: recorder?.export() ?? null,
    endTick: finalSnapshot.tick,
    checksum: checksumSnapshot(finalSnapshot),
    battleEnded: finalSnapshot.battleEnded,
    finalSnapshot
  };
}

/**
 * Produces the normal ReplayExportSource consumed by Stage 8.10 video export.
 */
export async function generateSeedReplay(
  battle: BattleDefinition,
  options: SeedReplayGenerationOptions = {}
): Promise<ReplayExportSource> {
  const result = await runHeadlessSeedSimulation(battle, {
    ...options,
    recordReplay: true,
    requireBattleEnd: true
  });
  if (!result.replay) throw new Error('Seed replay recording unexpectedly produced no replay.');
  return {
    replay: result.replay,
    endTick: result.endTick,
    checksum: result.checksum,
    battleEnded: result.battleEnded
  };
}

function validateBattleDefinition(battle: BattleDefinition): void {
  if (!Number.isInteger(battle.seed) || battle.seed < 0) {
    throw new SeedReplayGenerationError('Seed-driven export requires a valid unsigned numeric seed.', 'invalid-battle');
  }
  if (!battle.arenaId || !battle.modeId) {
    throw new SeedReplayGenerationError('Seed-driven export requires an arena and game mode.', 'invalid-battle');
  }
  if (!Array.isArray(battle.participants) || battle.participants.length < 2) {
    throw new SeedReplayGenerationError('Seed-driven export requires at least two battle participants.', 'invalid-battle');
  }
}

function positiveInteger(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function report(options: SeedReplayGenerationOptions, progress: SeedReplayGenerationProgress): void {
  options.onProgress?.(progress);
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SeedReplayGenerationError('Seed replay generation was cancelled.', 'cancelled');
}

async function yieldToHost(): Promise<void> {
  const schedulerApi = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (schedulerApi?.yield) {
    await schedulerApi.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
