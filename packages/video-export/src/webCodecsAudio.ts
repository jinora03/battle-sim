import type { ReplayAudioExportSettings } from './types';
import type { EncodedAudioSample } from './webmMuxer';

const OPUS_FRAME_DURATION_MS = 20;

export interface ResolvedAudioEncoderConfig {
  config: AudioEncoderConfig;
  framesPerChunk: number;
  chunkDurationUs: number;
}

export async function resolveAudioEncoderConfig(
  settings: ReplayAudioExportSettings
): Promise<ResolvedAudioEncoderConfig | null> {
  if (!settings.enabled) return null;
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  const config: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate: settings.sampleRate,
    numberOfChannels: settings.channels,
    bitrate: settings.bitrate
  };
  try {
    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported) return null;
    const framesPerChunk = Math.round(settings.sampleRate * OPUS_FRAME_DURATION_MS / 1000);
    return {
      config: support.config ?? config,
      framesPerChunk,
      chunkDurationUs: OPUS_FRAME_DURATION_MS * 1000
    };
  } catch {
    return null;
  }
}

export class WebCodecsAudioEncoder {
  readonly codec = "opus" as const;
  readonly framesPerChunk: number;
  readonly chunkDurationUs: number;

  private readonly encoder: AudioEncoder;
  private readonly outputQueue: EncodedAudioSample[] = [];
  private failure: Error | null = null;

  private constructor(resolved: ResolvedAudioEncoderConfig) {
    this.framesPerChunk = resolved.framesPerChunk;
    this.chunkDurationUs = resolved.chunkDurationUs;
    this.encoder = new AudioEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.outputQueue.push({
          timestampUs: Math.max(0, chunk.timestamp),
          durationUs: chunk.duration ?? this.chunkDurationUs,
          data,
        });
      },
      error: (reason) => {
        this.failure =
          reason instanceof Error ? reason : new Error(String(reason));
      },
    });
    this.encoder.configure(resolved.config);
  }

  static async create(
    settings: ReplayAudioExportSettings,
  ): Promise<WebCodecsAudioEncoder | null> {
    const resolved = await resolveAudioEncoderConfig(settings);
    if (!resolved) return null;
    try {
      return new WebCodecsAudioEncoder(resolved);
    } catch {
      return null;
    }
  }

  get encodeQueueSize(): number {
    return this.encoder.encodeQueueSize;
  }

  encode(
    interleaved: Float32Array,
    timestampUs: number,
    frameCount: number,
  ): void {
    this.throwIfFailed();

    // AudioData requires an ArrayBuffer-backed BufferSource.
    // Copying also prevents the encoder from referencing a reused synthesis buffer.
    const audioBuffer = new ArrayBuffer(interleaved.byteLength);
    new Float32Array(audioBuffer).set(interleaved);

    const audioData = new AudioData({
      format: "f32",
      sampleRate: 48_000,
      numberOfFrames: frameCount,
      numberOfChannels: 2,
      timestamp: timestampUs,
      data: audioBuffer,
    });

    try {
      this.encoder.encode(audioData);
    } finally {
      audioData.close();
    }
  }

  drainSamples(): EncodedAudioSample[] {
    if (this.outputQueue.length === 0) return [];
    return this.outputQueue.splice(0, this.outputQueue.length);
  }

  async flush(): Promise<void> {
    this.throwIfFailed();
    await this.encoder.flush();
    this.throwIfFailed();
  }

  close(): void {
    if (this.encoder.state === "closed") return;
    try {
      this.encoder.close();
    } catch {
      // Cleanup is best effort after cancellation or codec failure.
    }
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}
