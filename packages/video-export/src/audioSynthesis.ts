import type { ReplayAudioCue, ReplayAudioPriority } from './audioTimeline';

const TWO_PI = Math.PI * 2;
const OUTPUT_GAIN = 0.78;
const LOW_PASS_HZ = 6_200;

const PRIORITY_GAIN: Readonly<Record<ReplayAudioPriority, number>> = {
  detail: 0.68,
  attack: 0.82,
  ability: 0.96,
  impact: 0.9,
  hero: 1
};

/**
 * Deterministic offline mix for exported replay audio. The post-mix filter and
 * hierarchy ducking intentionally favor body/impact over sharp transient detail.
 */
export class ReplayAudioSynthesizer {
  private readonly cues: readonly ReplayAudioCue[];
  private readonly mixGainById = new Map<string, number>();
  private filterLeft = 0;
  private filterRight = 0;
  private lastProcessedEndFrame = 0;

  constructor(
    cues: readonly ReplayAudioCue[],
    readonly sampleRate = 48_000,
    readonly channels = 2
  ) {
    if (channels !== 2) throw new Error('Replay audio synthesis currently supports stereo output only.');
    this.cues = cues.slice().sort((a, b) => a.startsAtSeconds - b.startsAtSeconds);
    this.prepareHierarchyMix();
  }

  renderInterleaved(startFrame: number, frameCount: number): Float32Array {
    if (startFrame !== this.lastProcessedEndFrame) {
      this.filterLeft = 0;
      this.filterRight = 0;
    }
    const output = new Float32Array(frameCount * this.channels);
    const chunkStart = startFrame / this.sampleRate;
    const chunkEnd = (startFrame + frameCount) / this.sampleRate;
    for (const cue of this.cues) {
      const cueEnd = cue.startsAtSeconds + cue.durationSeconds;
      if (cueEnd <= chunkStart) continue;
      if (cue.startsAtSeconds >= chunkEnd) break;
      this.mixCue(output, startFrame, frameCount, cue);
    }
    this.postProcess(output);
    this.lastProcessedEndFrame = startFrame + frameCount;
    return output;
  }

  private prepareHierarchyMix(): void {
    const heroCues = this.cues.filter((cue) => cue.priority === 'hero');
    for (const cue of this.cues) {
      let gain = PRIORITY_GAIN[cue.priority];
      if (cue.priority !== 'hero') {
        const cueEnd = cue.startsAtSeconds + cue.durationSeconds;
        for (const hero of heroCues) {
          if (hero.startsAtSeconds > cueEnd + 0.04) break;
          const heroEnd = hero.startsAtSeconds + hero.durationSeconds;
          if (heroEnd + 0.04 < cue.startsAtSeconds) continue;
          gain *= cue.priority === 'detail' ? 0.34 : cue.priority === 'attack' ? 0.48 : 0.72;
          break;
        }
      }
      this.mixGainById.set(cue.id, gain);
    }
  }

  private mixCue(output: Float32Array, startFrame: number, frameCount: number, cue: ReplayAudioCue): void {
    const cueStartFrame = Math.round(cue.startsAtSeconds * this.sampleRate);
    const cueEndFrame = Math.round((cue.startsAtSeconds + cue.durationSeconds) * this.sampleRate);
    const from = Math.max(startFrame, cueStartFrame);
    const to = Math.min(startFrame + frameCount, cueEndFrame);
    if (to <= from) return;
    const panAngle = (cue.pan + 1) * Math.PI / 4;
    const leftGain = Math.cos(panAngle);
    const rightGain = Math.sin(panAngle);
    const mixGain = this.mixGainById.get(cue.id) ?? 1;
    for (let absoluteFrame = from; absoluteFrame < to; absoluteFrame += 1) {
      const localSeconds = (absoluteFrame - cueStartFrame) / this.sampleRate;
      const envelope = resolveEnvelope(localSeconds, cue.durationSeconds, cue.attackSeconds, cue.releaseSeconds);
      const value = cue.waveform === 'noise'
        ? deterministicNoise(cue.seed, absoluteFrame)
        : oscillatorValue(cue.waveform, cue.startFrequency, cue.endFrequency, localSeconds, cue.durationSeconds);
      const sample = value * cue.gain * mixGain * envelope;
      const outputIndex = (absoluteFrame - startFrame) * 2;
      output[outputIndex] = (output[outputIndex] ?? 0) + sample * leftGain;
      output[outputIndex + 1] = (output[outputIndex + 1] ?? 0) + sample * rightGain;
    }
  }

  private postProcess(output: Float32Array): void {
    const alpha = 1 - Math.exp(-TWO_PI * LOW_PASS_HZ / this.sampleRate);
    for (let index = 0; index < output.length; index += 2) {
      this.filterLeft += alpha * ((output[index] ?? 0) - this.filterLeft);
      this.filterRight += alpha * ((output[index + 1] ?? 0) - this.filterRight);
      output[index] = Math.tanh(this.filterLeft * 0.92) * OUTPUT_GAIN;
      output[index + 1] = Math.tanh(this.filterRight * 0.92) * OUTPUT_GAIN;
    }
  }
}

function resolveEnvelope(time: number, duration: number, attack: number, release: number): number {
  const attackGain = attack > 0 ? Math.min(1, time / attack) : 1;
  const remaining = duration - time;
  const releaseGain = release > 0 ? Math.min(1, remaining / release) : 1;
  return Math.max(0, Math.min(attackGain, releaseGain));
}

function oscillatorValue(
  waveform: Exclude<ReplayAudioCue['waveform'], 'noise'>,
  startFrequency: number,
  endFrequency: number,
  time: number,
  duration: number
): number {
  const sweep = (endFrequency - startFrequency) / Math.max(0.001, duration);
  const phase = TWO_PI * (startFrequency * time + 0.5 * sweep * time * time);
  if (waveform === 'sine') return Math.sin(phase);
  const cycle = phase / TWO_PI;
  const fractional = cycle - Math.floor(cycle);
  if (waveform === 'square') return fractional < 0.5 ? 1 : -1;
  if (waveform === 'sawtooth') return fractional * 2 - 1;
  return 1 - 4 * Math.abs(fractional - 0.5);
}

function deterministicNoise(seed: number, sampleIndex: number): number {
  let value = (seed ^ Math.imul(sampleIndex + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value / 0xffffffff) * 2 - 1;
}
