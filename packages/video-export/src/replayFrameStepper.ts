import { ReplayController } from '@kinetic/controllers';
import type { ReplayData, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner, SIM_TICK_RATE } from '@kinetic/simulation';
import type { VideoExportFrameRate } from './types';

export interface ReplayExportFrame {
  frameIndex: number;
  timestampUs: number;
  durationUs: number;
  snapshot: WorldSnapshot;
  events: readonly SimulationEvent[];
}

export class ReplayFrameStepper {
  readonly totalFrames: number;

  private readonly runner: LocalSimulationRunner;
  private readonly controller: ReplayController;
  private readonly ticksPerFrame: number;
  private frameIndex = 0;

  constructor(
    replay: ReplayData,
    private readonly endTick: number,
    private readonly fps: VideoExportFrameRate = 60
  ) {
    if (SIM_TICK_RATE % fps !== 0) throw new Error(`Replay export FPS must divide the ${SIM_TICK_RATE} Hz simulation rate.`);
    if (!Number.isInteger(endTick) || endTick <= 0) throw new Error('Replay endTick must be a positive integer.');
    this.ticksPerFrame = SIM_TICK_RATE / fps;
    this.totalFrames = Math.ceil(endTick / this.ticksPerFrame);
    this.runner = new LocalSimulationRunner(structuredClone(replay.battle));
    this.controller = new ReplayController(replay);
  }

  get done(): boolean {
    return this.runner.tick >= this.endTick;
  }

  get currentTick(): number {
    return this.runner.tick;
  }

  next(): ReplayExportFrame | null {
    if (this.done) return null;
    const events: SimulationEvent[] = [];
    for (let tickOffset = 0; tickOffset < this.ticksPerFrame && this.runner.tick < this.endTick; tickOffset += 1) {
      const before = this.runner.getRuntimeSnapshot();
      const commands = this.controller.commandsForTick(before);
      events.push(...this.runner.step(commands));
    }
    const snapshot = this.runner.getSnapshot();
    const frameIndex = this.frameIndex;
    const durationUs = Math.round(1_000_000 / this.fps);
    this.frameIndex += 1;
    return {
      frameIndex,
      timestampUs: Math.round(frameIndex * 1_000_000 / this.fps),
      durationUs,
      snapshot,
      events
    };
  }

  finalSnapshot(): WorldSnapshot {
    return this.runner.getSnapshot();
  }
}
