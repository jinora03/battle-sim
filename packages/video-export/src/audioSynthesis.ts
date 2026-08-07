import type { ReplayAudioCue } from './audioTimeline';

const TWO_PI = Math.PI * 2;

export class ReplayAudioSynthesizer {
  private readonly cues: readonly ReplayAudioCue[];

  constructor(
    cues: readonly ReplayAudioCue[],
    readonly sampleRate = 48_000,
    readonly channels = 2
  ) {
    if (channels !== 2) throw new Error('Replay audio synthesis currently supports stereo output only.');
    this.cues = cues.slice().sort((a, b) => a.startsAtSeconds - b.startsAtSeconds);
  }

  renderInterleaved(startFrame: number, frameCount: number): Float32Array {
    const output = new Float32Array(frameCount * this.channels);
    const chunkStart = startFrame / this.sampleRate;
    const chunkEnd = (startFrame + frameCount) / this.sampleRate;
    for (const cue of this.cues) {
      const cueEnd = cue.startsAtSeconds + cue.durationSeconds;
      if (cueEnd <= chunkStart) continue;
      if (cue.startsAtSeconds >= chunkEnd) break;
      this.mixCue(output, startFrame, frameCount, cue);
    }
    for (let index = 0; index < output.length; index += 1) {
      output[index] = Math.tanh(output[index]! * 0.86);
    }
    return output;
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
    for (let absoluteFrame = from; absoluteFrame < to; absoluteFrame += 1) {
      const localSeconds = (absoluteFrame - cueStartFrame) / this.sampleRate;
      const envelope = resolveEnvelope(localSeconds, cue.durationSeconds, cue.attackSeconds, cue.releaseSeconds);
      const value = cue.waveform === 'noise'
        ? deterministicNoise(cue.seed, absoluteFrame)
        : oscillatorValue(cue.waveform, cue.startFrequency, cue.endFrequency, localSeconds, cue.durationSeconds);
      const sample = value * cue.gain * envelope;
      const outputIndex = (absoluteFrame - startFrame) * 2;
      output[outputIndex] = (output[outputIndex] ?? 0) + sample * leftGain;
      output[outputIndex + 1] = (output[outputIndex + 1] ?? 0) + sample * rightGain;
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
