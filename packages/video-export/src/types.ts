import type { ReplayData } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';

export const VIDEO_EXPORT_WIDTH = 1920;
export const VIDEO_EXPORT_HEIGHT = 1080;
export const VIDEO_EXPORT_FPS = 60;
export const VIDEO_EXPORT_MAX_DURATION_SECONDS = 180;
export const VIDEO_EXPORT_MAX_ENCODED_BYTES = 512 * 1024 * 1024;

export type VideoExportCodec = 'vp9' | 'vp8';
export type VideoExportPhase = 'idle' | 'preparing' | 'rendering' | 'muxing' | 'complete' | 'cancelled' | 'error';

export interface ReplayExportSource {
  replay: ReplayData;
  endTick: number;
  checksum: string;
}

export interface ReplayVideoExportSettings {
  width: number;
  height: number;
  fps: 60;
  bitrate: number;
  maxDurationSeconds: number;
  maxEncodedBytes: number;
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
  mimeType: 'video/webm';
  width: number;
  height: number;
  fps: 60;
  frameCount: number;
  durationSeconds: number;
  encodedBytes: number;
  sourceChecksum: string;
}

export interface VideoExportCapability {
  supported: boolean;
  codec: VideoExportCodec | null;
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
