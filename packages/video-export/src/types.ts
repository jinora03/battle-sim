import type { ReplayData } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';
import type { BroadcastLayoutId } from './broadcastLayout';

export const VIDEO_EXPORT_WIDTH = 1920;
export const VIDEO_EXPORT_HEIGHT = 1080;
export const VIDEO_EXPORT_FPS = 60;
export const VIDEO_EXPORT_MAX_DURATION_SECONDS = 180;
export const VIDEO_EXPORT_MAX_ENCODED_BYTES = 1024 * 1024 * 1024;
export const VIDEO_EXPORT_AUDIO_SAMPLE_RATE = 48_000;
export const VIDEO_EXPORT_AUDIO_CHANNELS = 2;

export type VideoExportCodec = 'vp9' | 'vp8';
export type VideoExportAudioCodec = 'opus';
export type VideoExportResolution = '1080p' | '4k';
export type VideoExportFrameRate = 30 | 60;
export type VideoExportQuality = 'balanced' | 'high' | 'maximum';
export type VideoExportPhase = 'idle' | 'preparing' | 'rendering' | 'audio' | 'muxing' | 'complete' | 'cancelled' | 'error';

export interface ReplayExportSource {
  replay: ReplayData;
  endTick: number;
  checksum: string;
  battleEnded: boolean;
}

export interface ReplayAudioExportSettings {
  enabled: boolean;
  codec: VideoExportAudioCodec;
  sampleRate: 48_000;
  channels: 2;
  bitrate: number;
}

export interface ReplayVideoExportSettings {
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  quality: VideoExportQuality;
  width: number;
  height: number;
  fps: VideoExportFrameRate;
  bitrate: number;
  maxDurationSeconds: number;
  maxEncodedBytes: number;
  resultHoldSeconds: number;
  audio: ReplayAudioExportSettings;
  presentation: PresentationSettings;
}

export interface ReplayVideoExportProgress {
  phase: VideoExportPhase;
  renderedFrames: number;
  totalFrames: number;
  progress: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  encodedBytes: number;
  message: string;
}

export interface ReplayVideoExportResult {
  blob: Blob;
  codec: VideoExportCodec;
  audioCodec: VideoExportAudioCodec | null;
  mimeType: 'video/webm';
  width: number;
  height: number;
  fps: VideoExportFrameRate;
  frameCount: number;
  durationSeconds: number;
  encodedBytes: number;
  sourceChecksum: string;
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  quality: VideoExportQuality;
}

export interface VideoExportCapability {
  supported: boolean;
  codec: VideoExportCodec | null;
  audioSupported: boolean;
  audioCodec: VideoExportAudioCodec | null;
  reason: string | null;
}

export interface ReplayVideoExporterCallbacks {
  onProgress?(progress: ReplayVideoExportProgress): void;
}

export class ReplayVideoExportError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported'
      | 'invalid-source'
      | 'duration-limit'
      | 'memory-limit'
      | 'encoder-failure'
      | 'cancelled'
  ) {
    super(message);
    this.name = 'ReplayVideoExportError';
  }
}
