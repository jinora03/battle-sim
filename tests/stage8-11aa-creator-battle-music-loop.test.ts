import { describe, expect, it } from 'vitest';
import {
  CreatorBackgroundMusicMixer,
  createStage810hExportSettings
} from '@kinetic/video-export';

function renderMusic(seed = 81011, seconds = 10): Float32Array {
  const sampleRate = 48_000;
  const output = new Float32Array(sampleRate * seconds * 2);
  new CreatorBackgroundMusicMixer({
    seed,
    sampleRate,
    channels: 2,
    volume: 0.15,
    durationSeconds: seconds,
    introSeconds: 0,
    resultHoldSeconds: 0
  }).mixIntoInterleaved(output, 0, sampleRate * seconds);
  return output;
}

function rmsRange(samples: Float32Array, startFrame: number, frameCount: number): number {
  let energy = 0;
  let count = 0;
  const start = startFrame * 2;
  const end = Math.min(samples.length, (startFrame + frameCount) * 2);
  for (let index = start; index < end; index += 1) {
    const sample = samples[index] ?? 0;
    energy += sample * sample;
    count += 1;
  }
  return count > 0 ? Math.sqrt(energy / count) : 0;
}

describe('Stage 8.11AA creator battle music loop', () => {
  it('keeps creator music enabled at a subtle default level', () => {
    const settings = createStage810hExportSettings();
    expect(settings.creator.backgroundMusicEnabled).toBe(true);
    expect(settings.creator.backgroundMusicVolume).toBe(0.15);
  });

  it('renders deterministic music with meaningful low-mid energy instead of a near-silent drone', () => {
    const first = renderMusic(81011, 2);
    const second = renderMusic(81011, 2);
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i += 97) {
      expect(first[i]).toBe(second[i]);
    }

    let peak = 0;
    let energy = 0;
    for (const sample of first) {
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / first.length);
    expect(rms).toBeGreaterThan(0.002);
    expect(peak).toBeGreaterThan(0.006);
    expect(peak).toBeLessThan(0.04);
  });

  it('has rhythmic dynamics instead of a flat ambience bed', () => {
    const sampleRate = 48_000;
    const music = renderMusic(81011, 4);
    const beatFrames = Math.round(sampleRate * (60 / 104));
    const thirdBeatStart = beatFrames * 2;
    const earlyBeat = rmsRange(music, thirdBeatStart + Math.round(beatFrames * 0.05), Math.round(beatFrames * 0.14));
    const lateBeat = rmsRange(music, thirdBeatStart + Math.round(beatFrames * 0.60), Math.round(beatFrames * 0.14));
    expect(earlyBeat).toBeGreaterThan(lateBeat * 1.1);
  });

  it('varies musical content by battle seed while remaining deterministic per seed', () => {
    expect(renderMusic(81011, 2)).not.toEqual(renderMusic(81012, 2));
  });
});
