import type {
  ReplayVideoExportSettings,
  VideoExportAudioCodec,
  VideoExportCodec,
  VideoExportContainer
} from './types';
import { WebCodecsFrameEncoder } from './webCodecs';
import { WebCodecsAudioEncoder } from './webCodecsAudio';
import { WebCodecsAacEncoder, WebCodecsH264Encoder } from './mp4Codecs';
import { Mp4Muxer } from './mp4Muxer';
import { WebmMuxer } from './webmMuxer';

export interface ExportMediaPipeline {
  readonly container: VideoExportContainer;
  readonly videoCodec: VideoExportCodec;
  readonly audioCodec: VideoExportAudioCodec | null;
  readonly videoQueueSize: number;
  readonly audioQueueSize: number;
  readonly audioFramesPerChunk: number;
  readonly byteLength: number;
  encodeVideo(canvas: HTMLCanvasElement, timestampUs: number, durationUs: number, keyFrame: boolean): void;
  flushVideo(): Promise<void>;
  encodeAudio(interleaved: Float32Array, timestampUs: number, frameCount: number): void;
  flushAudio(): Promise<void>;
  finalize(): Blob;
  close(): void;
}

export async function createExportMediaPipeline(
  settings: ReplayVideoExportSettings
): Promise<ExportMediaPipeline | null> {
  if (settings.format !== 'webm') {
    const mp4 = await createMp4Pipeline(settings);
    if (mp4) return mp4;
    if (settings.format === 'mp4') return null;
  }
  return createWebmPipeline(settings);
}

async function createWebmPipeline(settings: ReplayVideoExportSettings): Promise<ExportMediaPipeline | null> {
  const video = await WebCodecsFrameEncoder.create(settings);
  if (!video) return null;
  const audio = settings.audio.enabled
    ? await WebCodecsAudioEncoder.create({ ...settings.audio, codec: 'opus' })
    : null;
  if (settings.audio.enabled && !audio) {
    video.close();
    return null;
  }
  return new WebmExportMediaPipeline(settings, video, audio);
}

async function createMp4Pipeline(settings: ReplayVideoExportSettings): Promise<ExportMediaPipeline | null> {
  const video = await WebCodecsH264Encoder.create(settings);
  if (!video) return null;
  const audio = settings.audio.enabled
    ? await WebCodecsAacEncoder.create({ ...settings.audio, codec: 'aac' })
    : null;
  if (settings.audio.enabled && !audio) {
    video.close();
    return null;
  }
  return new Mp4ExportMediaPipeline(settings, video, audio);
}

class WebmExportMediaPipeline implements ExportMediaPipeline {
  readonly container = 'webm' as const;
  readonly videoCodec: VideoExportCodec;
  readonly audioCodec: VideoExportAudioCodec | null;
  private readonly muxer: WebmMuxer;

  constructor(
    settings: ReplayVideoExportSettings,
    private readonly video: WebCodecsFrameEncoder,
    private readonly audio: WebCodecsAudioEncoder | null
  ) {
    this.videoCodec = video.codec;
    this.audioCodec = audio?.codec ?? null;
    this.muxer = new WebmMuxer({
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      codec: video.codec,
      maxEncodedBytes: settings.maxEncodedBytes,
      ...(audio ? {
        audio: { codec: 'opus', sampleRate: settings.audio.sampleRate, channels: settings.audio.channels }
      } : {})
    });
  }

  get videoQueueSize(): number { return this.video.encodeQueueSize; }
  get audioQueueSize(): number { return this.audio?.encodeQueueSize ?? 0; }
  get audioFramesPerChunk(): number { return this.audio?.framesPerChunk ?? 0; }
  get byteLength(): number { return this.muxer.byteLength; }

  encodeVideo(canvas: HTMLCanvasElement, timestampUs: number, durationUs: number, keyFrame: boolean): void {
    this.video.encode(canvas, timestampUs, durationUs, keyFrame);
    this.drainVideo();
  }

  async flushVideo(): Promise<void> {
    await this.video.flush();
    this.drainVideo();
  }

  encodeAudio(interleaved: Float32Array, timestampUs: number, frameCount: number): void {
    if (!this.audio) return;
    this.audio.encode(interleaved, timestampUs, frameCount);
    this.drainAudio();
  }

  async flushAudio(): Promise<void> {
    if (!this.audio) return;
    await this.audio.flush();
    this.drainAudio();
  }

  finalize(): Blob { return this.muxer.finalize(); }
  close(): void { this.video.close(); this.audio?.close(); }

  private drainVideo(): void {
    for (const sample of this.video.drainSamples()) this.muxer.addVideoSample(sample);
  }

  private drainAudio(): void {
    if (!this.audio) return;
    for (const sample of this.audio.drainSamples()) this.muxer.addAudioSample(sample);
  }
}

class Mp4ExportMediaPipeline implements ExportMediaPipeline {
  readonly container = 'mp4' as const;
  readonly videoCodec = 'h264' as const;
  readonly audioCodec: VideoExportAudioCodec | null;
  private readonly muxer: Mp4Muxer;

  constructor(
    settings: ReplayVideoExportSettings,
    private readonly video: WebCodecsH264Encoder,
    private readonly audio: WebCodecsAacEncoder | null
  ) {
    this.audioCodec = audio?.codec ?? null;
    this.muxer = new Mp4Muxer({
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      sampleRate: settings.audio.sampleRate,
      channels: settings.audio.channels,
      audioBitrate: settings.audio.bitrate,
      maxEncodedBytes: settings.maxEncodedBytes,
      audioEnabled: audio !== null
    });
  }

  get videoQueueSize(): number { return this.video.encodeQueueSize; }
  get audioQueueSize(): number { return this.audio?.encodeQueueSize ?? 0; }
  get audioFramesPerChunk(): number { return this.audio?.framesPerChunk ?? 0; }
  get byteLength(): number { return this.muxer.byteLength; }

  encodeVideo(canvas: HTMLCanvasElement, timestampUs: number, durationUs: number, keyFrame: boolean): void {
    this.video.encode(canvas, timestampUs, durationUs, keyFrame);
    this.drainVideo();
  }

  async flushVideo(): Promise<void> {
    await this.video.flush();
    this.drainVideo();
    this.muxer.setVideoDecoderConfig(this.video.decoderConfig);
  }

  encodeAudio(interleaved: Float32Array, timestampUs: number, frameCount: number): void {
    if (!this.audio || frameCount <= 0) return;

    // AAC-LC is most reliable when each submitted AudioData block contains a complete
    // 1024-sample access unit. Pad only the final short block with deterministic silence.
    const targetFrames = this.audio.framesPerChunk;
    if (frameCount < targetFrames) {
      const channels = Math.max(1, Math.round(interleaved.length / frameCount));
      const padded = new Float32Array(targetFrames * channels);
      padded.set(interleaved.subarray(0, padded.length));
      this.audio.encode(padded, timestampUs, targetFrames);
    } else {
      this.audio.encode(interleaved, timestampUs, frameCount);
    }
    this.drainAudio();
  }

  async flushAudio(): Promise<void> {
    if (!this.audio) return;
    await this.audio.flush();
    this.drainAudio();
    this.muxer.setAudioDecoderConfig(this.audio.decoderConfig);
  }

  finalize(): Blob {
    this.muxer.setVideoDecoderConfig(this.video.decoderConfig);
    if (this.audio) this.muxer.setAudioDecoderConfig(this.audio.decoderConfig);
    return this.muxer.finalize();
  }

  close(): void { this.video.close(); this.audio?.close(); }

  private drainVideo(): void {
    for (const sample of this.video.drainSamples()) this.muxer.addVideoSample(sample);
    this.muxer.setVideoDecoderConfig(this.video.decoderConfig);
  }

  private drainAudio(): void {
    if (!this.audio) return;
    for (const sample of this.audio.drainSamples()) this.muxer.addAudioSample(sample);
    this.muxer.setAudioDecoderConfig(this.audio.decoderConfig);
  }
}
