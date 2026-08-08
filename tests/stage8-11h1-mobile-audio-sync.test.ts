import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeEncodedAudioTimeline } from '@kinetic/video-export';

describe('Stage 8.11H1 mobile export audio synchronization', () => {
  it('removes repeated encoder packets and follows packet timestamps instead of inflated durations', () => {
    const normalized = normalizeEncodedAudioTimeline([
      { timestampUs: 0, durationUs: 60_000, data: 'a' },
      { timestampUs: 20_000, durationUs: 60_000, data: 'b' },
      { timestampUs: 20_000, durationUs: 60_000, data: 'duplicate' },
      { timestampUs: 40_000, durationUs: 60_000, data: 'c' },
      { timestampUs: 60_000, durationUs: 20_000, data: 'past-end' }
    ], 60_000);

    expect(normalized.samples.map((sample) => [sample.timestampUs, sample.durationUs, sample.data])).toEqual([
      [0, 20_000, 'a'],
      [20_000, 20_000, 'b'],
      [40_000, 20_000, 'c']
    ]);
    expect(normalized.stats).toEqual({
      droppedDuplicatePackets: 1,
      droppedTrailingPackets: 1,
      correctedDurations: 3
    });
  });

  it('normalizes callback delivery order without forcing a late export retry', () => {
    const normalized = normalizeEncodedAudioTimeline([
      { timestampUs: 40_000, durationUs: 20_000, data: 'c' },
      { timestampUs: 0, durationUs: 20_000, data: 'a' },
      { timestampUs: 20_000, durationUs: 20_000, data: 'b' }
    ], 60_000);

    expect(normalized.samples.map((sample) => sample.data)).toEqual(['a', 'b', 'c']);
  });

  it('requests 20ms Opus packets while preserving the stable 8.11G audio backpressure path', () => {
    const opus = readFileSync(new URL('../packages/video-export/src/webCodecsAudio.ts', import.meta.url), 'utf8');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');

    expect(opus).toContain('opus: { frameDuration: OPUS_FRAME_DURATION_US }');
    expect(exporter).not.toContain('waitForAudioQueueDrain');
    expect(exporter).toContain('Audio encoder flush failed while draining queued samples.');
    expect(exporter.match(/media\.flushAudio\(\)/g)).toHaveLength(2);
  });
});
