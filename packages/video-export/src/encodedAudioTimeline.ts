export interface EncodedAudioTimingSample {
  timestampUs: number;
  durationUs: number;
}

export interface EncodedAudioTimelineStats {
  droppedDuplicatePackets: number;
  droppedTrailingPackets: number;
  correctedDurations: number;
}

export interface NormalizedEncodedAudioTimeline<T extends EncodedAudioTimingSample> {
  samples: T[];
  stats: EncodedAudioTimelineStats;
}

/**
 * Hardens browser-provided encoded-audio timing before muxing.
 *
 * Mobile WebCodecs implementations can differ in packetization and, on broken
 * boundaries, may emit repeated timestamps or packet durations that do not
 * match the next packet timestamp. The muxed track must follow one monotonic
 * presentation timeline and must never extend beyond the rendered video.
 */
export function normalizeEncodedAudioTimeline<T extends EncodedAudioTimingSample>(
  samples: readonly T[],
  trackEndUs: number
): NormalizedEncodedAudioTimeline<T> {
  const safeTrackEndUs = Math.round(trackEndUs);
  if (!Number.isFinite(safeTrackEndUs) || safeTrackEndUs <= 0) {
    throw new Error(`Encoded audio track end must be a positive timestamp (${trackEndUs}).`);
  }
  const accepted: T[] = [];
  let previousTimestampUs: number | null = null;
  let droppedDuplicatePackets = 0;
  let droppedTrailingPackets = 0;
  let correctedDurations = 0;

  // The muxers already present audio in timestamp order. Normalize in that same
  // order so callback delivery quirks cannot turn a completed video render into
  // a late encoder failure that triggers a full reliability re-export.
  const orderedSamples = samples
    .map((sample, index) => ({ sample, index, timestampUs: Math.round(sample.timestampUs) }))
    .sort((a, b) => a.timestampUs - b.timestampUs || a.index - b.index);

  for (const entry of orderedSamples) {
    const { sample, timestampUs } = entry;
    if (!Number.isFinite(timestampUs) || timestampUs < 0) {
      throw new Error(`Audio encoder produced an invalid timestamp (${sample.timestampUs}).`);
    }
    if (previousTimestampUs !== null && timestampUs === previousTimestampUs) {
      droppedDuplicatePackets += 1;
      continue;
    }
    previousTimestampUs = timestampUs;

    if (timestampUs >= safeTrackEndUs) {
      droppedTrailingPackets += 1;
      continue;
    }

    const durationUs = Math.round(sample.durationUs);
    if (!Number.isFinite(durationUs) || durationUs <= 0) {
      throw new Error(`Audio encoder produced an invalid duration (${sample.durationUs}).`);
    }
    accepted.push({ ...sample, timestampUs, durationUs });
  }

  for (let index = 0; index < accepted.length; index += 1) {
    const sample = accepted[index]!;
    const next = accepted[index + 1];
    const maxRemainingUs = Math.max(1, safeTrackEndUs - sample.timestampUs);
    const timelineDurationUs = next
      ? Math.max(1, next.timestampUs - sample.timestampUs)
      : Math.min(sample.durationUs, maxRemainingUs);
    const correctedDurationUs = Math.min(timelineDurationUs, maxRemainingUs);
    if (correctedDurationUs !== sample.durationUs) correctedDurations += 1;
    sample.durationUs = correctedDurationUs;
  }

  return {
    samples: accepted,
    stats: {
      droppedDuplicatePackets,
      droppedTrailingPackets,
      correctedDurations
    }
  };
}
