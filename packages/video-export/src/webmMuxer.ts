import type { VideoExportCodec } from './types';

export interface EncodedVideoSample {
  timestampUs: number;
  durationUs: number;
  keyFrame: boolean;
  data: Uint8Array;
}

export interface WebmMuxerOptions {
  width: number;
  height: number;
  fps: number;
  codec: VideoExportCodec;
  maxEncodedBytes: number;
}

const IDS = {
  ebml: 0x1a45dfa3,
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  muxingApp: 0x4d80,
  writingApp: 0x5741,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackNumber: 0xd7,
  trackUid: 0x73c5,
  trackType: 0x83,
  flagLacing: 0x9c,
  codecId: 0x86,
  defaultDuration: 0x23e383,
  video: 0xe0,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  cluster: 0x1f43b675,
  timestamp: 0xe7,
  simpleBlock: 0xa3
} as const;

const SAMPLE_OVERHEAD_BYTES = 16;
const textEncoder = new TextEncoder();

export class WebmMuxer {
  private readonly samples: EncodedVideoSample[] = [];
  private encodedBytes = 0;

  constructor(private readonly options: WebmMuxerOptions) {}

  get byteLength(): number {
    return this.encodedBytes;
  }

  addSample(sample: EncodedVideoSample): void {
    const nextBytes = this.encodedBytes + sample.data.byteLength + SAMPLE_OVERHEAD_BYTES;
    if (nextBytes > this.options.maxEncodedBytes) {
      throw new Error('Encoded video exceeded the configured memory safeguard.');
    }
    this.encodedBytes = nextBytes;
    this.samples.push({
      timestampUs: sample.timestampUs,
      durationUs: sample.durationUs,
      keyFrame: sample.keyFrame,
      data: sample.data
    });
  }

  finalize(): Blob {
    if (this.samples.length === 0) throw new Error('Cannot create a WebM file without encoded frames.');
    this.samples.sort((a, b) => a.timestampUs - b.timestampUs);
    const durationMs = Math.max(...this.samples.map((sample) => (sample.timestampUs + sample.durationUs) / 1000));
    const info = element(IDS.info, concat(
      element(IDS.timecodeScale, unsigned(1_000_000)),
      element(IDS.duration, float64(durationMs)),
      element(IDS.muxingApp, text('Kinetic Battle Engine')),
      element(IDS.writingApp, text('Kinetic Stage 8.10A'))
    ));
    const tracks = element(IDS.tracks, element(IDS.trackEntry, concat(
      element(IDS.trackNumber, unsigned(1)),
      element(IDS.trackUid, unsigned(1)),
      element(IDS.trackType, unsigned(1)),
      element(IDS.flagLacing, unsigned(0)),
      element(IDS.codecId, text(this.options.codec === 'vp9' ? 'V_VP9' : 'V_VP8')),
      element(IDS.defaultDuration, unsigned(Math.round(1_000_000_000 / this.options.fps))),
      element(IDS.video, concat(
        element(IDS.pixelWidth, unsigned(this.options.width)),
        element(IDS.pixelHeight, unsigned(this.options.height))
      ))
    )));
    const clusters = this.createClusterParts();
    const segmentPayloadSize = info.byteLength + tracks.byteLength
      + clusters.reduce((total, cluster) => total + cluster.byteLength, 0);
    const parts: Uint8Array[] = [
      ebmlHeader(),
      idBytes(IDS.segment),
      vint(segmentPayloadSize),
      info,
      tracks
    ];
    for (const cluster of clusters) parts.push(...cluster.parts);

    const blob = new Blob(parts as unknown as BlobPart[], { type: 'video/webm' });
    this.samples.length = 0;
    this.encodedBytes = blob.size;
    return blob;
  }

  private createClusterParts(): ClusterParts[] {
    const clusters: ClusterParts[] = [];
    let clusterTimestampMs = -1;
    let blockParts: Uint8Array[] = [];
    let blockBytes = 0;

    const flush = () => {
      if (clusterTimestampMs < 0 || blockParts.length === 0) return;
      const timestamp = element(IDS.timestamp, unsigned(clusterTimestampMs));
      const payloadBytes = timestamp.byteLength + blockBytes;
      const header = [idBytes(IDS.cluster), vint(payloadBytes)];
      clusters.push({
        parts: [...header, timestamp, ...blockParts],
        byteLength: header[0]!.byteLength + header[1]!.byteLength + payloadBytes
      });
      blockParts = [];
      blockBytes = 0;
    };

    for (const sample of this.samples) {
      const timestampMs = Math.round(sample.timestampUs / 1000);
      const shouldStartCluster = clusterTimestampMs < 0
        || timestampMs - clusterTimestampMs > 30_000
        || (sample.keyFrame && blockParts.length > 0);
      if (shouldStartCluster) {
        flush();
        clusterTimestampMs = timestampMs;
      }
      const relativeTimestamp = timestampMs - clusterTimestampMs;
      const payloadHeader = simpleBlockHeader(relativeTimestamp, sample.keyFrame);
      const size = vint(payloadHeader.byteLength + sample.data.byteLength);
      const id = idBytes(IDS.simpleBlock);
      blockParts.push(id, size, payloadHeader, sample.data);
      blockBytes += id.byteLength + size.byteLength + payloadHeader.byteLength + sample.data.byteLength;
    }
    flush();
    return clusters;
  }
}

interface ClusterParts {
  parts: Uint8Array[];
  byteLength: number;
}

function ebmlHeader(): Uint8Array {
  return element(IDS.ebml, concat(
    element(0x4286, unsigned(1)),
    element(0x42f7, unsigned(1)),
    element(0x42f2, unsigned(4)),
    element(0x42f3, unsigned(8)),
    element(0x4282, text('webm')),
    element(0x4287, unsigned(2)),
    element(0x4285, unsigned(2))
  ));
}

function simpleBlockHeader(relativeTimestamp: number, keyFrame: boolean): Uint8Array {
  if (relativeTimestamp < -32768 || relativeTimestamp > 32767) {
    throw new Error(`WebM block timestamp ${relativeTimestamp}ms exceeds the signed 16-bit cluster range.`);
  }
  const header = new Uint8Array(4);
  header[0] = 0x81;
  new DataView(header.buffer).setInt16(1, relativeTimestamp);
  header[3] = keyFrame ? 0x80 : 0;
  return header;
}

function element(id: number, payload: Uint8Array): Uint8Array {
  return concat(idBytes(id), vint(payload.byteLength), payload);
}

function idBytes(id: number): Uint8Array {
  const bytes: number[] = [];
  let value = id;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value = Math.floor(value / 256);
  }
  return Uint8Array.from(bytes);
}

function vint(value: number): Uint8Array {
  for (let length = 1; length <= 8; length += 1) {
    const max = 2 ** (7 * length) - 2;
    if (value > max) continue;
    const bytes = new Uint8Array(length);
    let remaining = value;
    for (let index = length - 1; index >= 0; index -= 1) {
      bytes[index] = remaining & 0xff;
      remaining = Math.floor(remaining / 256);
    }
    bytes[0] = (bytes[0] ?? 0) | (1 << (8 - length));
    return bytes;
  }
  throw new Error(`EBML payload is too large: ${value}`);
}

function unsigned(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid unsigned EBML value: ${value}`);
  if (value === 0) return Uint8Array.of(0);
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Uint8Array.from(bytes);
}

function float64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value);
  return bytes;
}

function text(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}
