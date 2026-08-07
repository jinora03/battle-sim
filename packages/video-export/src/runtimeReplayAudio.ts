import { BattleAudioEngine } from '@kinetic/audio';
import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';

const MASTER_LOW_PASS_HZ = 9_500;
const MASTER_MAKEUP_GAIN = 1.35;
const MASTER_OUTPUT_GAIN = 0.9;

export interface RuntimeReplayAudioRenderOptions {
  battle: BattleDefinition;
  initialSnapshot: WorldSnapshot;
  timeline: RuntimeReplayAudioTimeline;
  durationSeconds: number;
  startOffsetSeconds: number;
  resultDelaySeconds: number;
  sampleRate: number;
  channels: number;
}

interface RuntimeReplayAudioBatch {
  tick: number;
  events: readonly SimulationEvent[];
}

/**
 * Stores the real simulation events for offline export audio. Unlike the legacy
 * export tone approximation, these events are later fed through BattleAudioEngine
 * so exported combat uses the same weapon and intent recipes as live battles.
 */
export class RuntimeReplayAudioTimeline {
  private readonly eventsByTick = new Map<number, SimulationEvent[]>();

  addEvents(events: readonly SimulationEvent[]): void {
    for (const event of events) {
      const existing = this.eventsByTick.get(event.tick);
      if (existing) existing.push(event);
      else this.eventsByTick.set(event.tick, [event]);
    }
  }

  batches(): readonly RuntimeReplayAudioBatch[] {
    return [...this.eventsByTick.entries()]
      .sort(([left], [right]) => left - right)
      .map(([tick, events]) => ({ tick, events }));
  }
}

export class RuntimeReplayAudioBuffer {
  private filterLeft = 0;
  private filterRight = 0;
  private lastProcessedEndFrame = 0;

  constructor(
    private readonly buffer: AudioBuffer,
    readonly sampleRate: number,
    readonly channels: number
  ) {}

  renderInterleaved(startFrame: number, frameCount: number): Float32Array {
    if (startFrame !== this.lastProcessedEndFrame) {
      this.filterLeft = 0;
      this.filterRight = 0;
    }
    const output = new Float32Array(frameCount * 2);
    const left = this.buffer.getChannelData(0);
    const right = this.buffer.numberOfChannels > 1 ? this.buffer.getChannelData(1) : left;
    const alpha = 1 - Math.exp(-Math.PI * 2 * MASTER_LOW_PASS_HZ / this.sampleRate);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const sourceFrame = startFrame + frame;
      const rawLeft = sourceFrame < left.length ? left[sourceFrame] ?? 0 : 0;
      const rawRight = sourceFrame < right.length ? right[sourceFrame] ?? 0 : 0;
      this.filterLeft += alpha * (rawLeft - this.filterLeft);
      this.filterRight += alpha * (rawRight - this.filterRight);
      output[frame * 2] = Math.tanh(this.filterLeft * MASTER_MAKEUP_GAIN) * MASTER_OUTPUT_GAIN;
      output[frame * 2 + 1] = Math.tanh(this.filterRight * MASTER_MAKEUP_GAIN) * MASTER_OUTPUT_GAIN;
    }
    this.lastProcessedEndFrame = startFrame + frameCount;
    return output;
  }
}

export async function renderRuntimeReplayAudio(
  options: RuntimeReplayAudioRenderOptions
): Promise<RuntimeReplayAudioBuffer | null> {
  if (typeof OfflineAudioContext === 'undefined') return null;
  if (options.channels !== 2) throw new Error('Runtime replay audio currently supports stereo output only.');

  const totalFrames = Math.max(1, Math.ceil(options.durationSeconds * options.sampleRate));
  let context: OfflineAudioContext;
  try {
    context = new OfflineAudioContext(options.channels, totalFrames, options.sampleRate);
  } catch {
    return null;
  }

  const engine = new BattleAudioEngine({
    context,
    enabled: true,
    deterministicSeed: options.battle.seed,
    masterGain: 0.36
  });
  const focusEntityIds = options.initialSnapshot.entities
    .filter((entity) => entity.controller === 'player')
    .map((entity) => entity.id);
  const aiEntityIds = options.initialSnapshot.entities
    .filter((entity) => entity.controller === 'ai')
    .map((entity) => entity.id);
  const entityCount = options.initialSnapshot.entities.length;

  for (const batch of options.timeline.batches()) {
    const atSeconds = options.startOffsetSeconds + batch.tick / 60;
    engine.consumeAtTime(batch.events, atSeconds, entityCount, focusEntityIds, aiEntityIds);
    const battleEnded = batch.events.find((event) => event.type === 'battleEnded');
    if (battleEnded) scheduleResultAccent(context, atSeconds + options.resultDelaySeconds, battleEnded.winningTeam ?? 0);
  }

  const rendered = await context.startRendering();
  return new RuntimeReplayAudioBuffer(rendered, options.sampleRate, options.channels);
}

function scheduleResultAccent(context: OfflineAudioContext, startsAt: number, winningTeam: number): void {
  const start = Math.max(0, startsAt + 0.12);
  const frequencies = winningTeam === 0 ? [150, 92] : [180, 270];
  for (let index = 0; index < frequencies.length; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[index] ?? 160, start);
    oscillator.frequency.exponentialRampToValueAtTime(index === 0 ? 72 : 420, start + 0.48);
    gain.gain.setValueAtTime(index === 0 ? 0.035 : 0.018, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.52);
  }
}
