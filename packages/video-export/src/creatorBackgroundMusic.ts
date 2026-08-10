const PCM_PEAK_LIMIT = 0.98;
const DEFAULT_ROOT_FREQUENCIES = [43.65, 49, 55, 61.74] as const;
const MINOR_THIRD_RATIO = 2 ** (3 / 12);
const PERFECT_FIFTH_RATIO = 2 ** (7 / 12);
const CREATOR_BATTLE_MUSIC_BPM = 104;
const BEATS_PER_BAR = 4;
const LOOP_BARS = 4;
const CHORD_OFFSETS_SEMITONES = [0, -4, 3, -2] as const;

export const DEFAULT_CREATOR_BACKGROUND_MUSIC_VOLUME = 0.15;
export const MAX_CREATOR_BACKGROUND_MUSIC_VOLUME = 0.3;

export interface CreatorBackgroundMusicOptions {
  seed: number;
  sampleRate: number;
  channels: number;
  volume: number;
  durationSeconds: number;
  introSeconds: number;
  resultHoldSeconds: number;
}

/**
 * Creator/export-only deterministic battle music.
 *
 * This is an actual minimal musical loop rather than an ambience drone: a
 * four-bar minor progression, restrained low percussion and a pulsing bass.
 * The arrangement intentionally lives mostly below ~450 Hz so combat SFX stay
 * in front and the music does not add another bright ringing layer. It mixes
 * into final export PCM only and never touches BattleAudioEngine.
 */
export class CreatorBackgroundMusicMixer {
  private readonly rootFrequency: number;
  private readonly phaseA: number;
  private readonly phaseB: number;
  private readonly phaseC: number;
  private readonly volume: number;

  constructor(private readonly options: CreatorBackgroundMusicOptions) {
    if (options.channels !== 2) {
      throw new Error('Creator background music currently supports stereo export only.');
    }
    if (!Number.isFinite(options.sampleRate) || options.sampleRate <= 0) {
      throw new Error('Creator background music requires a positive sample rate.');
    }
    const seed = options.seed >>> 0;
    this.rootFrequency = DEFAULT_ROOT_FREQUENCIES[seed % DEFAULT_ROOT_FREQUENCIES.length] ?? 55;
    this.phaseA = hashUnit(seed ^ 0x9e3779b9) * Math.PI * 2;
    this.phaseB = hashUnit(seed ^ 0x85ebca6b) * Math.PI * 2;
    this.phaseC = hashUnit(seed ^ 0xc2b2ae35) * Math.PI * 2;
    this.volume = Math.max(0, Math.min(MAX_CREATOR_BACKGROUND_MUSIC_VOLUME, options.volume));
  }

  mixIntoInterleaved(output: Float32Array, startFrame: number, frameCount: number): void {
    if (this.volume <= 0 || frameCount <= 0) return;
    const requiredSamples = frameCount * this.options.channels;
    if (output.length < requiredSamples) {
      throw new Error('Creator background music output buffer is smaller than the requested frame count.');
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      const absoluteFrame = startFrame + frame;
      const time = absoluteFrame / this.options.sampleRate;
      const fade = this.fadeEnvelope(time);
      if (fade <= 0) continue;

      const sectionGain = this.sectionGain(time);
      const baseGain = this.volume * fade * sectionGain;
      const beatPeriod = 60 / CREATOR_BATTLE_MUSIC_BPM;
      const barDuration = beatPeriod * BEATS_PER_BAR;
      const loopDuration = barDuration * LOOP_BARS;
      const loopTime = positiveModulo(time, loopDuration);
      const barIndex = Math.min(LOOP_BARS - 1, Math.floor(loopTime / barDuration));
      const barTime = loopTime - barIndex * barDuration;
      const beatTime = positiveModulo(barTime, beatPeriod);
      const beatIndex = Math.min(BEATS_PER_BAR - 1, Math.floor(barTime / beatPeriod));
      const chordRoot = normalizeBassFrequency(
        this.rootFrequency * 2 ** ((CHORD_OFFSETS_SEMITONES[barIndex] ?? 0) / 12)
      );

      const padEnvelope = this.padEnvelope(barTime, barDuration);
      const leftPad = this.chordPad(time, chordRoot, this.phaseA, this.phaseB, this.phaseC) * padEnvelope;
      const rightPad = this.chordPad(
        time,
        chordRoot,
        this.phaseA + 0.09,
        this.phaseB - 0.07,
        this.phaseC + 0.11
      ) * padEnvelope;

      const beatEnvelope = Math.exp(-beatTime * 7.2);
      const downbeatWeight = beatIndex === 0 ? 1 : beatIndex === 2 ? 0.82 : 0.55;
      const bass = this.bassPulse(time, chordRoot, beatEnvelope * downbeatWeight);
      const kick = this.kickPulse(time, beatTime, beatIndex);
      const percussion = this.lowPercussion(time, beatTime, beatIndex);

      const left = (leftPad + bass + kick + percussion * 0.92) * baseGain;
      const right = (rightPad + bass + kick + percussion) * baseGain;
      const sampleIndex = frame * 2;
      output[sampleIndex] = limitPcmPeak((output[sampleIndex] ?? 0) + left);
      output[sampleIndex + 1] = limitPcmPeak((output[sampleIndex + 1] ?? 0) + right);
    }
  }

  private chordPad(
    time: number,
    chordRoot: number,
    phaseRoot: number,
    phaseThird: number,
    phaseFifth: number
  ): number {
    const padRoot = chordRoot * 2;
    const minorThird = padRoot * MINOR_THIRD_RATIO;
    const fifth = padRoot * PERFECT_FIFTH_RATIO;
    const slowMovement = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * 0.075 * time + phaseThird));
    return (
      Math.sin(Math.PI * 2 * padRoot * time + phaseRoot) * 0.026
      + Math.sin(Math.PI * 2 * minorThird * time + phaseThird) * 0.017
      + Math.sin(Math.PI * 2 * fifth * time + phaseFifth) * 0.014
      + Math.sin(Math.PI * 2 * padRoot * 2 * time + phaseRoot + 0.18) * 0.007
      + Math.sin(Math.PI * 2 * fifth * 2 * time + phaseFifth - 0.14) * 0.004
    ) * slowMovement;
  }

  private bassPulse(time: number, chordRoot: number, envelope: number): number {
    const fundamental = Math.sin(Math.PI * 2 * chordRoot * time + this.phaseA) * 0.032;
    const harmonic = Math.sin(Math.PI * 2 * chordRoot * 2 * time + this.phaseB) * 0.014;
    return (fundamental + harmonic) * envelope;
  }

  private kickPulse(time: number, beatTime: number, beatIndex: number): number {
    if (beatIndex !== 0 && beatIndex !== 2) return 0;
    const envelope = Math.exp(-beatTime * 18);
    const body = Math.sin(Math.PI * 2 * 62 * time + this.phaseB) * 0.050;
    const knock = Math.sin(Math.PI * 2 * 124 * time + this.phaseC) * 0.018;
    return (body + knock) * envelope;
  }

  private lowPercussion(time: number, beatTime: number, beatIndex: number): number {
    if (beatIndex !== 1 && beatIndex !== 3) return 0;
    const delayed = beatTime - (60 / CREATOR_BATTLE_MUSIC_BPM) * 0.5;
    if (delayed < 0) return 0;
    const envelope = Math.exp(-delayed * 28);
    const tone = Math.sin(Math.PI * 2 * 210 * time + this.phaseC) * 0.018;
    return tone * envelope;
  }

  private padEnvelope(barTime: number, barDuration: number): number {
    const attack = smoothstep01(barTime / 0.12);
    const release = smoothstep01((barDuration - barTime) / 0.18);
    return Math.min(attack, release);
  }

  private fadeEnvelope(time: number): number {
    const duration = Math.max(0, this.options.durationSeconds);
    const fadeSeconds = Math.min(0.65, Math.max(0.15, duration * 0.08));
    const fadeIn = Math.min(1, Math.max(0, time / fadeSeconds));
    const remaining = Math.max(0, duration - time);
    const fadeOut = Math.min(1, remaining / fadeSeconds);
    return Math.min(fadeIn, fadeOut);
  }

  private sectionGain(time: number): number {
    if (this.options.introSeconds > 0 && time < this.options.introSeconds) return 1.08;
    const resultStart = Math.max(0, this.options.durationSeconds - this.options.resultHoldSeconds);
    if (this.options.resultHoldSeconds > 0 && time >= resultStart) return 1.12;
    return 1;
  }
}

function normalizeBassFrequency(value: number): number {
  let frequency = value;
  while (frequency < 40) frequency *= 2;
  while (frequency > 78) frequency *= 0.5;
  return frequency;
}

function smoothstep01(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashUnit(seed: number): number {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

function limitPcmPeak(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  return Math.max(-PCM_PEAK_LIMIT, Math.min(PCM_PEAK_LIMIT, sample));
}
