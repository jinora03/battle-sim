import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RuntimeReplayAudioBuffer } from '@kinetic/video-export';

function fakeAudioBuffer(left: number[], right: number[] = left): AudioBuffer {
  const channels = [Float32Array.from(left), Float32Array.from(right)];
  return {
    numberOfChannels: channels.length,
    getChannelData(channel: number) {
      return channels[channel] ?? channels[0]!;
    }
  } as AudioBuffer;
}

function expectSamplesCloseTo(actual: Float32Array, expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((sample, index) => expect(actual[index]).toBeCloseTo(sample, 6));
}

describe('Stage 8.11H3 export audio parity', () => {
  it('preserves normal offline PCM samples without export-only filtering or saturation', () => {
    const buffer = new RuntimeReplayAudioBuffer(
      fakeAudioBuffer([0, 0.1, -0.25, 0.5], [0, -0.1, 0.25, -0.5]),
      48_000,
      2
    );

    expectSamplesCloseTo(buffer.renderInterleaved(0, 4), [
      0, 0,
      0.1, -0.1,
      -0.25, 0.25,
      0.5, -0.5
    ]);
  });

  it('only clamps true out-of-range peaks instead of coloring the whole mix', () => {
    const buffer = new RuntimeReplayAudioBuffer(
      fakeAudioBuffer([1.25, -1.1], [-1.5, 1.4]),
      48_000,
      2
    );

    expectSamplesCloseTo(buffer.renderInterleaved(0, 2), [
      0.98, -0.98,
      -0.98, 0.98
    ]);
  });

  it('uses live-equivalent mastering and removes the old export-only harmonic processing', () => {
    const runtimeAudio = readFileSync(
      new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url),
      'utf8'
    );
    const liveAudio = readFileSync(
      new URL('../packages/audio/src/index.ts', import.meta.url),
      'utf8'
    );

    expect(liveAudio).toContain('options.masterGain ?? 0.32');
    expect(runtimeAudio).toContain('const EXPORT_MASTER_GAIN = 0.32;');
    expect(runtimeAudio).toContain('masterGain: EXPORT_MASTER_GAIN');
    expect(runtimeAudio).not.toContain('MASTER_LOW_PASS_HZ');
    expect(runtimeAudio).not.toContain('MASTER_MAKEUP_GAIN');
    expect(runtimeAudio).not.toContain('Math.tanh(');
  });
});
