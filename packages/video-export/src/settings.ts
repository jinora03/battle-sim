import { defaultPresentationSettings, type PresentationSettings } from '@kinetic/visual-engine';
import { getBroadcastLayout, type BroadcastLayoutId } from './broadcastLayout';
import { getCreatorExportPreset } from './creatorPresets';
import {
  VIDEO_EXPORT_AUDIO_CHANNELS,
  VIDEO_EXPORT_AUDIO_SAMPLE_RATE,
  VIDEO_EXPORT_FPS,
  VIDEO_EXPORT_MAX_DURATION_SECONDS,
  VIDEO_EXPORT_MAX_ENCODED_BYTES,
  type ReplayVideoExportSettings,
  type CreatorExportPresetId,
  type VideoExportCameraMode,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from './types';

export interface Stage810cExportOptions {
  layout?: BroadcastLayoutId;
  resolution?: VideoExportResolution;
  fps?: VideoExportFrameRate;
  quality?: VideoExportQuality;
  audio?: boolean;
}

export interface Stage810dExportOptions extends Stage810cExportOptions {
  camera?: VideoExportCameraMode;
}

export interface Stage810eExportOptions extends Stage810dExportOptions {
  preset?: CreatorExportPresetId;
  intro?: boolean;
  captions?: boolean;
  thumbnail?: boolean;
}

const VIDEO_BITRATES: Readonly<Record<VideoExportResolution, Readonly<Record<VideoExportFrameRate, Readonly<Record<VideoExportQuality, number>>>>>> = {
  '1080p': {
    30: { balanced: 7_000_000, high: 10_000_000, maximum: 14_000_000 },
    60: { balanced: 12_000_000, high: 18_000_000, maximum: 24_000_000 }
  },
  '4k': {
    30: { balanced: 20_000_000, high: 28_000_000, maximum: 36_000_000 },
    60: { balanced: 24_000_000, high: 32_000_000, maximum: 40_000_000 }
  }
};

const AUDIO_BITRATES: Readonly<Record<VideoExportQuality, number>> = {
  balanced: 128_000,
  high: 160_000,
  maximum: 192_000
};

export function createStage810aExportSettings(
  presentation: Partial<PresentationSettings> = {}
): ReplayVideoExportSettings {
  return createExportSettings(presentation, {
    layout: 'landscape', resolution: '1080p', fps: 60, quality: 'balanced', audio: false
  }, 0, 'broadcast', 0);
}

export function createStage810bExportSettings(
  presentation: Partial<PresentationSettings> = {},
  layoutId: BroadcastLayoutId = 'landscape'
): ReplayVideoExportSettings {
  return createExportSettings(presentation, {
    layout: layoutId, resolution: '1080p', fps: 60, quality: 'balanced', audio: false
  }, 2, 'broadcast', 0);
}

export function createStage810cExportSettings(
  presentation: Partial<PresentationSettings> = {},
  options: Stage810cExportOptions = {}
): ReplayVideoExportSettings {
  return createExportSettings(presentation, {
    layout: options.layout ?? 'landscape',
    resolution: options.resolution ?? '1080p',
    fps: options.fps ?? VIDEO_EXPORT_FPS,
    quality: options.quality ?? 'high',
    audio: options.audio ?? true
  }, 2, 'broadcast', 0);
}

export function createStage810dExportSettings(
  presentation: Partial<PresentationSettings> = {},
  options: Stage810dExportOptions = {}
): ReplayVideoExportSettings {
  return createExportSettings(presentation, {
    layout: options.layout ?? 'landscape',
    resolution: options.resolution ?? '1080p',
    fps: options.fps ?? VIDEO_EXPORT_FPS,
    quality: options.quality ?? 'high',
    audio: options.audio ?? true
  }, 2, options.camera ?? 'cinematic', options.camera === 'broadcast' ? 0 : 0.45);
}

export function createStage810eExportSettings(
  presentation: Partial<PresentationSettings> = {},
  options: Stage810eExportOptions = {}
): ReplayVideoExportSettings {
  const presetId = options.preset ?? 'youtube';
  const preset = presetId === 'custom' ? getCreatorExportPreset('youtube') : getCreatorExportPreset(presetId);
  const settings = createExportSettings(presentation, {
    layout: options.layout ?? preset.layout,
    resolution: options.resolution ?? preset.resolution,
    fps: options.fps ?? preset.fps,
    quality: options.quality ?? preset.quality,
    audio: options.audio ?? preset.audio
  }, 2.8, options.camera ?? preset.camera, (options.camera ?? preset.camera) === 'broadcast' ? 0 : 0.45);
  return {
    ...settings,
    creator: {
      preset: presetId,
      introSeconds: options.intro === false ? 0 : 3,
      captionsEnabled: options.captions ?? true,
      thumbnailEnabled: options.thumbnail ?? true
    }
  };
}

function createExportSettings(
  presentation: Partial<PresentationSettings>,
  options: Required<Stage810cExportOptions>,
  resultHoldSeconds: number,
  cameraMode: VideoExportCameraMode,
  knockoutSlowMotionSeconds: number
): ReplayVideoExportSettings {
  const scale = options.resolution === '4k' ? 2 : 1;
  const layout = getBroadcastLayout(options.layout, scale);
  return {
    layout: layout.id,
    resolution: options.resolution,
    quality: options.quality,
    width: layout.width,
    height: layout.height,
    fps: options.fps,
    bitrate: VIDEO_BITRATES[options.resolution][options.fps][options.quality],
    maxDurationSeconds: VIDEO_EXPORT_MAX_DURATION_SECONDS,
    maxEncodedBytes: VIDEO_EXPORT_MAX_ENCODED_BYTES,
    resultHoldSeconds,
    camera: {
      mode: cameraMode,
      maxZoom: cameraMode === 'cinematic' ? 1.28 : 1,
      knockoutSlowMotionSeconds
    },
    creator: {
      preset: 'custom',
      introSeconds: 0,
      captionsEnabled: true,
      thumbnailEnabled: false
    },
    audio: {
      enabled: options.audio,
      codec: 'opus',
      sampleRate: VIDEO_EXPORT_AUDIO_SAMPLE_RATE,
      channels: VIDEO_EXPORT_AUDIO_CHANNELS,
      bitrate: AUDIO_BITRATES[options.quality]
    },
    presentation: {
      ...defaultPresentationSettings,
      ...presentation,
      renderProfile: 'standard',
      audio: false,
      maxDevicePixelRatio: 1,
      renderScale: 1,
      targetRenderFps: options.fps,
      adaptiveQuality: false,
      reducedMotion: false,
      cameraFollow: false,
      // The Pixi camera uses live random shake; export applies seeded shake while compositing.
      cameraShake: false,
      impactFreeze: cameraMode === 'cinematic'
    }
  };
}

export function calculateCreatorIntroFrameCount(settings: ReplayVideoExportSettings): number {
  return Math.max(0, Math.round(settings.creator.introSeconds * settings.fps));
}


export function calculateKnockoutSlowMotionFrameCount(
  settings: ReplayVideoExportSettings,
  battleEnded: boolean
): number {
  if (!battleEnded || settings.camera.mode !== 'cinematic') return 0;
  return Math.max(0, Math.round(settings.camera.knockoutSlowMotionSeconds * settings.fps));
}

export function calculateReplayFrameCount(endTick: number, fps: VideoExportFrameRate): number {
  if (!Number.isInteger(endTick) || endTick <= 0) return 0;
  return Math.ceil(endTick * fps / 60);
}

export function estimateEncodedBytes(settings: ReplayVideoExportSettings, frameCount: number): number {
  const durationSeconds = frameCount / settings.fps;
  const videoBytes = settings.bitrate / 8 * durationSeconds;
  const audioBytes = settings.audio.enabled ? settings.audio.bitrate / 8 * durationSeconds : 0;
  return Math.ceil((videoBytes + audioBytes) * 1.08 + 512 * 1024);
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
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
