import type { ReplayVideoExportSettings, VideoExportCapability, VideoExportCodec } from './types';
import type { EncodedVideoSample } from './webmMuxer';

interface ResolvedEncoderConfig {
  codec: VideoExportCodec;
  config: VideoEncoderConfig;
  frameDurationUs: number;
}

const CODEC_CANDIDATES: readonly { codec: VideoExportCodec; codecString: string }[] = [
  { codec: 'vp9', codecString: 'vp09.00.10.08' },
  { codec: 'vp8', codecString: 'vp8' }
];

const HARDWARE_ACCELERATION_CANDIDATES = [
  'prefer-hardware',
  'no-preference'
] as const satisfies readonly NonNullable<VideoEncoderConfig['hardwareAcceleration']>[];

export async function detectVideoExportCapability(
  settings: ReplayVideoExportSettings
): Promise<VideoExportCapability> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return {
      supported: false,
      codec: null,
      reason: 'This browser does not expose the WebCodecs video encoder required for fixed-frame export.'
    };
  }
  const resolved = await resolveEncoderConfig(settings);
  return resolved
    ? { supported: true, codec: resolved.codec, reason: null }
    : { supported: false, codec: null, reason: 'This browser cannot encode 1080p60 VP9 or VP8 WebM video.' };
}

export async function resolveEncoderConfig(
  settings: ReplayVideoExportSettings
): Promise<ResolvedEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const candidate of encoderConfigCandidates(settings)) {
    const resolved = await resolveCandidate(candidate);
    if (resolved) return resolved;
  }
  return null;
}

interface EncoderConfigCandidate {
  codec: VideoExportCodec;
  config: VideoEncoderConfig;
  frameDurationUs: number;
}

function* encoderConfigCandidates(settings: ReplayVideoExportSettings): Generator<EncoderConfigCandidate> {
  for (const hardwareAcceleration of HARDWARE_ACCELERATION_CANDIDATES) {
    for (const candidate of CODEC_CANDIDATES) {
      yield {
        codec: candidate.codec,
        config: {
          codec: candidate.codecString,
          width: settings.width,
          height: settings.height,
          bitrate: settings.bitrate,
          framerate: settings.fps,
          hardwareAcceleration
        },
        frameDurationUs: Math.round(1_000_000 / settings.fps)
      };
    }
  }
}

async function resolveCandidate(candidate: EncoderConfigCandidate): Promise<ResolvedEncoderConfig | null> {
  try {
    const support = await VideoEncoder.isConfigSupported(candidate.config);
    if (!support.supported) return null;
    return {
      codec: candidate.codec,
      config: support.config ?? candidate.config,
      frameDurationUs: candidate.frameDurationUs
    };
  } catch {
    return null;
  }
}

export class WebCodecsFrameEncoder {
  readonly codec: VideoExportCodec;

  private readonly encoder: VideoEncoder;
  private readonly outputQueue: EncodedVideoSample[] = [];
  private failure: Error | null = null;

  private constructor(resolved: ResolvedEncoderConfig) {
    this.codec = resolved.codec;
    this.encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.outputQueue.push({
          timestampUs: chunk.timestamp,
          durationUs: chunk.duration ?? resolved.frameDurationUs,
          keyFrame: chunk.type === 'key',
          data
        });
      },
      error: (reason) => {
        this.failure = reason instanceof Error ? reason : new Error(String(reason));
      }
    });
    try {
      this.encoder.configure(resolved.config);
    } catch (reason) {
      this.encoder.close();
      throw reason;
    }
  }

  static async create(settings: ReplayVideoExportSettings): Promise<WebCodecsFrameEncoder | null> {
    if (typeof VideoEncoder === 'undefined') return null;
    for (const candidate of encoderConfigCandidates(settings)) {
      const resolved = await resolveCandidate(candidate);
      if (!resolved) continue;
      try {
        return new WebCodecsFrameEncoder(resolved);
      } catch {
        // A driver may reject configure() after capability detection; continue to software fallback.
      }
    }
    return null;
  }

  get encodeQueueSize(): number {
    return this.encoder.encodeQueueSize;
  }

  encode(canvas: HTMLCanvasElement, timestampUs: number, durationUs: number, keyFrame: boolean): void {
    this.throwIfFailed();
    const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: durationUs });
    try {
      this.encoder.encode(frame, { keyFrame });
    } finally {
      frame.close();
    }
  }

  drainSamples(): EncodedVideoSample[] {
    if (this.outputQueue.length === 0) return [];
    return this.outputQueue.splice(0, this.outputQueue.length);
  }

  async flush(): Promise<void> {
    this.throwIfFailed();
    await this.encoder.flush();
    this.throwIfFailed();
  }

  close(): void {
    if (this.encoder.state === 'closed') return;
    try {
      this.encoder.close();
    } catch {
      // Cleanup is best effort after encoder errors or cancellation.
    }
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}
