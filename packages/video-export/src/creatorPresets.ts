import type {
  CreatorExportPresetId,
  VideoExportCameraMode,
  VideoExportFrameRate,
  VideoExportQuality,
  VideoExportResolution
} from './types';
import type { BroadcastLayoutId } from './broadcastLayout';

export interface CreatorExportPresetDefinition {
  id: Exclude<CreatorExportPresetId, 'custom'>;
  name: string;
  detail: string;
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  fps: VideoExportFrameRate;
  quality: VideoExportQuality;
  audio: boolean;
  camera: VideoExportCameraMode;
}

const PRESETS: readonly CreatorExportPresetDefinition[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    detail: '1080p60 landscape',
    layout: 'landscape',
    resolution: '1080p',
    fps: 60,
    quality: 'high',
    audio: true,
    camera: 'cinematic'
  },
  {
    id: 'shorts',
    name: 'Shorts / Reels',
    detail: '1080p60 vertical',
    layout: 'vertical',
    resolution: '1080p',
    fps: 60,
    quality: 'high',
    audio: true,
    camera: 'cinematic'
  },
  {
    id: 'master',
    name: '4K Master',
    detail: '4K60 maximum',
    layout: 'landscape',
    resolution: '4k',
    fps: 60,
    quality: 'maximum',
    audio: true,
    camera: 'cinematic'
  },
  {
    id: 'quick',
    name: 'Quick Draft',
    detail: '1080p30 balanced',
    layout: 'landscape',
    resolution: '1080p',
    fps: 30,
    quality: 'balanced',
    audio: true,
    camera: 'broadcast'
  }
];

export function listCreatorExportPresets(): readonly CreatorExportPresetDefinition[] {
  return PRESETS;
}

export function getCreatorExportPreset(
  id: Exclude<CreatorExportPresetId, 'custom'>
): CreatorExportPresetDefinition {
  const preset = PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown creator export preset: ${id}`);
  return preset;
}
