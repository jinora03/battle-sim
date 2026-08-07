import type { ReplayAudioExportSettings, ReplayVideoExportSettings } from './types';

export interface EncodedMp4VideoSample {
  timestampUs: number;
  durationUs: number;
  keyFrame: boolean;
  data: Uint8Array;
}

export interface EncodedMp4AudioSample {
  timestampUs: number;
  durationUs: number;
  data: Uint8Array;
}

export interface ResolvedH264EncoderConfig {
  config: VideoEncoderConfig;
  codecString: string;
  frameDurationUs: number;
}

export interface ResolvedAacEncoderConfig {
  config: AudioEncoderConfig;
  framesPerChunk: number;
  chunkDurationUs: number;
}

const HARDWARE_ACCELERATION_CANDIDATES = [
  'prefer-hardware',
  'no-preference'
] as const satisfies readonly NonNullable<VideoEncoderConfig['hardwareAcceleration']>[];

const AAC_FRAME_SIZE = 1024;

export async function resolveH264EncoderConfig(
  settings: ReplayVideoExportSettings
): Promise<ResolvedH264EncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const candidate of h264EncoderConfigCandidates(settings)) {
    const resolved = await resolveH264Candidate(candidate);
    if (resolved) return resolved;
  }
  return null;
}

function* h264EncoderConfigCandidates(settings: ReplayVideoExportSettings): Generator<ResolvedH264EncoderConfig> {
  const frameDurationUs = Math.round(1_000_000 / settings.fps);
  for (const hardwareAcceleration of HARDWARE_ACCELERATION_CANDIDATES) {
    for (const codecString of h264CodecCandidates(settings)) {
      yield {
        codecString,
        frameDurationUs,
        config: {
          codec: codecString,
          width: settings.width,
          height: settings.height,
          bitrate: settings.bitrate,
          framerate: settings.fps,
          hardwareAcceleration,
          latencyMode: 'realtime',
          avc: { format: 'avc' }
        }
      };
    }
  }
}

async function resolveH264Candidate(candidate: ResolvedH264EncoderConfig): Promise<ResolvedH264EncoderConfig | null> {
  try {
    const support = await VideoEncoder.isConfigSupported(candidate.config);
    if (!support.supported) return null;
    return { ...candidate, config: support.config ?? candidate.config };
  } catch {
    return null;
  }
}

export async function resolveAacEncoderConfig(
  settings: ReplayAudioExportSettings
): Promise<ResolvedAacEncoderConfig | null> {
  if (!settings.enabled || typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  const config: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    sampleRate: settings.sampleRate,
    numberOfChannels: settings.channels,
    bitrate: settings.bitrate
  };
  try {
    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported) return null;
    return {
      config: support.config ?? config,
      framesPerChunk: AAC_FRAME_SIZE,
      chunkDurationUs: Math.round(AAC_FRAME_SIZE * 1_000_000 / settings.sampleRate)
    };
  } catch {
    return null;
  }
}

function h264CodecCandidates(settings: ReplayVideoExportSettings): readonly string[] {
  const level = settings.resolution === '4k'
    ? settings.fps === 60 ? '34' : '33'
    : settings.fps === 60 ? '2a' : '28';
  return [
    `avc1.6400${level}`,
    `avc1.4d40${level}`,
    `avc1.42e0${level}`
  ];
}

export class WebCodecsH264Encoder {
  readonly codec = 'h264' as const;
  readonly codecString: string;

  private readonly encoder: VideoEncoder;
  private readonly outputQueue: EncodedMp4VideoSample[] = [];
  private failure: Error | null = null;
  private decoderConfigBytes: Uint8Array | null = null;

  private constructor(resolved: ResolvedH264EncoderConfig) {
    this.codecString = resolved.codecString;
    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.outputQueue.push({
          timestampUs: Math.max(0, chunk.timestamp),
          durationUs: chunk.duration ?? resolved.frameDurationUs,
          keyFrame: chunk.type === 'key',
          data
        });
        const description = metadata?.decoderConfig?.description;
        if (!this.decoderConfigBytes && description) this.decoderConfigBytes = copyBufferSource(description);
      },
      error: (reason) => {
        this.failure = reason instanceof Error ? reason : new Error(String(reason));
      }
    });
    this.encoder.configure(resolved.config);
  }

  static async create(settings: ReplayVideoExportSettings): Promise<WebCodecsH264Encoder | null> {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
    for (const candidate of h264EncoderConfigCandidates(settings)) {
      const resolved = await resolveH264Candidate(candidate);
      if (!resolved) continue;
      try {
        return new WebCodecsH264Encoder(resolved);
      } catch {
        // Drivers can reject configure() after isConfigSupported(); try the next profile/software path.
      }
    }
    return null;
  }

  get encodeQueueSize(): number {
    return this.encoder.encodeQueueSize;
  }

  get decoderConfig(): Uint8Array | null {
    return this.decoderConfigBytes ? this.decoderConfigBytes.slice() : null;
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

  drainSamples(): EncodedMp4VideoSample[] {
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
    try { this.encoder.close(); } catch { /* best-effort cleanup */ }
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}

export class WebCodecsAacEncoder {
  readonly codec = 'aac' as const;
  readonly framesPerChunk: number;
  readonly chunkDurationUs: number;

  private readonly encoder: AudioEncoder;
  private readonly outputQueue: EncodedMp4AudioSample[] = [];
  private failure: Error | null = null;
  private decoderConfigBytes: Uint8Array | null = null;

  private constructor(resolved: ResolvedAacEncoderConfig, private readonly settings: ReplayAudioExportSettings) {
    this.framesPerChunk = resolved.framesPerChunk;
    this.chunkDurationUs = resolved.chunkDurationUs;
    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.outputQueue.push({
          timestampUs: Math.max(0, chunk.timestamp),
          durationUs: chunk.duration ?? this.chunkDurationUs,
          data
        });
        const description = metadata?.decoderConfig?.description;
        if (!this.decoderConfigBytes && description) this.decoderConfigBytes = copyBufferSource(description);
      },
      error: (reason) => {
        this.failure = reason instanceof Error ? reason : new Error(String(reason));
      }
    });
    this.encoder.configure(resolved.config);
  }

  static async create(settings: ReplayAudioExportSettings): Promise<WebCodecsAacEncoder | null> {
    const resolved = await resolveAacEncoderConfig(settings);
    if (!resolved) return null;
    try {
      return new WebCodecsAacEncoder(resolved, settings);
    } catch {
      return null;
    }
  }

  get encodeQueueSize(): number {
    return this.encoder.encodeQueueSize;
  }

  get decoderConfig(): Uint8Array {
    return this.decoderConfigBytes?.slice() ?? aacAudioSpecificConfig(this.settings.sampleRate, this.settings.channels);
  }

  encode(interleaved: Float32Array, timestampUs: number, frameCount: number): void {
    this.throwIfFailed();
    const audioBuffer = new ArrayBuffer(interleaved.byteLength);
    new Float32Array(audioBuffer).set(interleaved);
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: this.settings.sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: this.settings.channels,
      timestamp: timestampUs,
      data: audioBuffer
    });
    try {
      this.encoder.encode(audioData);
    } finally {
      audioData.close();
    }
  }

  drainSamples(): EncodedMp4AudioSample[] {
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
    try { this.encoder.close(); } catch { /* best-effort cleanup */ }
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}

function aacAudioSpecificConfig(sampleRate: number, channels: number): Uint8Array {
  const frequencies = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const frequencyIndex = frequencies.indexOf(sampleRate);
  if (frequencyIndex < 0 || channels < 1 || channels > 7) {
    throw new Error(`AAC MP4 export does not support ${sampleRate} Hz / ${channels} channels.`);
  }
  const objectType = 2; // AAC-LC
  const bits = (objectType << 11) | (frequencyIndex << 7) | (channels << 3);
  return Uint8Array.of((bits >>> 8) & 0xff, bits & 0xff);
}

function copyBufferSource(source: AllowSharedBufferSource): Uint8Array {
  if (ArrayBuffer.isView(source)) {
    const output = new Uint8Array(source.byteLength);
    output.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
    return output;
  }
  return new Uint8Array(source.slice(0));
}
