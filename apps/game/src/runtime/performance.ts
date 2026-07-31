export type PerformancePressure = 'healthy' | 'busy' | 'strained' | 'critical';
export type PerformanceBottleneck = 'simulation' | 'render' | 'balanced';

export interface PerformanceWindowSummary {
  simulationP95Ms: number;
  renderP95Ms: number;
  frameP95Ms: number;
  pressure: PerformancePressure;
  bottleneck: PerformanceBottleneck;
  longFrameStreak: number;
  droppedSimulationTicks: number;
  sampleCount: number;
}

export interface PerformanceSample {
  simulationMs: number;
  renderMs: number;
  frameMs: number;
}

const WINDOW_SIZE = 120;
const PERCENTILE_REFRESH_INTERVAL = 12;

/**
 * UI diagnostics do not need to update at the 60 Hz simulation cadence.
 * Larger battles publish less often to reduce checksum, aggregation and React work.
 */
export function diagnosticsIntervalForEntityCount(entityCount: number): number {
  if (entityCount <= 24) return 6;   // 10 Hz
  if (entityCount <= 48) return 15;  // 4 Hz
  if (entityCount <= 100) return 60; // 1 Hz
  return 90;                         // ~0.67 Hz
}

/** Achievement/stat evaluation can be batched without changing simulation results. */
export function metaEvaluationIntervalForEntityCount(entityCount: number): number {
  if (entityCount <= 24) return 1;
  if (entityCount <= 48) return 4;
  if (entityCount <= 100) return 12;
  return 20;
}

export function classifyPerformancePressure(frameP95Ms: number, budgetMs: number, longFrameStreak: number): PerformancePressure {
  if (longFrameStreak >= 18 || frameP95Ms > budgetMs * 1.55) return 'critical';
  if (longFrameStreak >= 8 || frameP95Ms > budgetMs * 1.12) return 'strained';
  if (frameP95Ms > budgetMs * 0.78) return 'busy';
  return 'healthy';
}

export function identifyPerformanceBottleneck(simulationP95Ms: number, renderP95Ms: number): PerformanceBottleneck {
  if (simulationP95Ms > renderP95Ms * 1.2) return 'simulation';
  if (renderP95Ms > simulationP95Ms * 1.2) return 'render';
  return 'balanced';
}

/** Fixed-capacity profiler used by the browser runtime. */
export class RuntimePerformanceProfiler {
  private readonly simulationSamples = new Float32Array(WINDOW_SIZE);
  private readonly renderSamples = new Float32Array(WINDOW_SIZE);
  private readonly frameSamples = new Float32Array(WINDOW_SIZE);
  private readonly scratch = new Float32Array(WINDOW_SIZE);
  private cursor = 0;
  private count = 0;
  private recordsSinceRefresh = PERCENTILE_REFRESH_INTERVAL;
  private longFrameStreak = 0;
  private droppedSimulationTicks = 0;
  private summary: PerformanceWindowSummary = {
    simulationP95Ms: 0,
    renderP95Ms: 0,
    frameP95Ms: 0,
    pressure: 'healthy',
    bottleneck: 'balanced',
    longFrameStreak: 0,
    droppedSimulationTicks: 0,
    sampleCount: 0
  };

  record(sample: PerformanceSample, budgetMs: number): PerformanceWindowSummary {
    this.simulationSamples[this.cursor] = Math.max(0, sample.simulationMs);
    this.renderSamples[this.cursor] = Math.max(0, sample.renderMs);
    this.frameSamples[this.cursor] = Math.max(0, sample.frameMs);
    this.cursor = (this.cursor + 1) % WINDOW_SIZE;
    this.count = Math.min(WINDOW_SIZE, this.count + 1);
    this.recordsSinceRefresh += 1;
    this.longFrameStreak = sample.frameMs > budgetMs * 1.12 ? this.longFrameStreak + 1 : Math.max(0, this.longFrameStreak - 2);

    if (this.recordsSinceRefresh >= PERCENTILE_REFRESH_INTERVAL || this.count <= 2) {
      this.recordsSinceRefresh = 0;
      const simulationP95Ms = this.percentile95(this.simulationSamples);
      const renderP95Ms = this.percentile95(this.renderSamples);
      const frameP95Ms = this.percentile95(this.frameSamples);
      this.summary = {
        simulationP95Ms,
        renderP95Ms,
        frameP95Ms,
        pressure: classifyPerformancePressure(frameP95Ms, budgetMs, this.longFrameStreak),
        bottleneck: identifyPerformanceBottleneck(simulationP95Ms, renderP95Ms),
        longFrameStreak: this.longFrameStreak,
        droppedSimulationTicks: this.droppedSimulationTicks,
        sampleCount: this.count
      };
    } else {
      this.summary = {
        ...this.summary,
        longFrameStreak: this.longFrameStreak,
        droppedSimulationTicks: this.droppedSimulationTicks,
        sampleCount: this.count
      };
    }
    return this.getSummary();
  }

  addDroppedSimulationTicks(count: number): void {
    if (count <= 0) return;
    this.droppedSimulationTicks += Math.floor(count);
    this.summary = { ...this.summary, droppedSimulationTicks: this.droppedSimulationTicks };
  }

  getSummary(): PerformanceWindowSummary {
    return { ...this.summary };
  }

  reset(): void {
    this.simulationSamples.fill(0);
    this.renderSamples.fill(0);
    this.frameSamples.fill(0);
    this.cursor = 0;
    this.count = 0;
    this.recordsSinceRefresh = PERCENTILE_REFRESH_INTERVAL;
    this.longFrameStreak = 0;
    this.droppedSimulationTicks = 0;
    this.summary = {
      simulationP95Ms: 0,
      renderP95Ms: 0,
      frameP95Ms: 0,
      pressure: 'healthy',
      bottleneck: 'balanced',
      longFrameStreak: 0,
      droppedSimulationTicks: 0,
      sampleCount: 0
    };
  }

  private percentile95(samples: Float32Array): number {
    for (let index = 0; index < this.count; index += 1) this.scratch[index] = samples[index] ?? 0;
    const sorted = this.scratch.subarray(0, this.count);
    sorted.sort();
    const percentileIndex = Math.max(0, Math.ceil(this.count * 0.95) - 1);
    return sorted[percentileIndex] ?? 0;
  }
}
