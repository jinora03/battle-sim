import { defaultPresentationSettings, type PresentationSettings } from '@kinetic/visual-engine';
import {
  VIDEO_EXPORT_FPS,
  VIDEO_EXPORT_HEIGHT,
  VIDEO_EXPORT_MAX_DURATION_SECONDS,
  VIDEO_EXPORT_MAX_ENCODED_BYTES,
  VIDEO_EXPORT_WIDTH,
  type ReplayVideoExportSettings
} from './types';

const DEFAULT_BITRATE = 12_000_000;

export function createStage810aExportSettings(
  presentation: Partial<PresentationSettings> = {}
): ReplayVideoExportSettings {
  return {
    width: VIDEO_EXPORT_WIDTH,
    height: VIDEO_EXPORT_HEIGHT,
    fps: VIDEO_EXPORT_FPS,
    bitrate: DEFAULT_BITRATE,
    maxDurationSeconds: VIDEO_EXPORT_MAX_DURATION_SECONDS,
    maxEncodedBytes: VIDEO_EXPORT_MAX_ENCODED_BYTES,
    presentation: {
      ...defaultPresentationSettings,
      ...presentation,
      renderProfile: 'standard',
      audio: false,
      maxDevicePixelRatio: 1,
      renderScale: 1,
      targetRenderFps: VIDEO_EXPORT_FPS,
      adaptiveQuality: false,
      reducedMotion: false
    }
  };
}

export function estimateEncodedBytes(settings: ReplayVideoExportSettings, frameCount: number): number {
  const durationSeconds = frameCount / settings.fps;
  const mediaBytes = settings.bitrate / 8 * durationSeconds;
  return Math.ceil(mediaBytes * 1.08 + 256 * 1024);
}

export function validateExportPlan(settings: ReplayVideoExportSettings, frameCount: number): void {
  if (!Number.isInteger(frameCount) || frameCount <= 0) throw new Error('Replay export requires at least one frame.');
  const durationSeconds = frameCount / settings.fps;
  if (durationSeconds > settings.maxDurationSeconds) {
    throw new Error(`Replay duration ${durationSeconds.toFixed(1)}s exceeds the ${settings.maxDurationSeconds}s export limit.`);
  }
  const estimatedBytes = estimateEncodedBytes(settings, frameCount);
  if (estimatedBytes > settings.maxEncodedBytes) {
    throw new Error(`Estimated export size ${formatBytes(estimatedBytes)} exceeds the ${formatBytes(settings.maxEncodedBytes)} memory safeguard.`);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
