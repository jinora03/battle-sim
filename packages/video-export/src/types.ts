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

export type VideoExportCodec = 'h264' | 'vp9' | 'vp8';
export type VideoExportContainer = 'mp4' | 'webm';
export type VideoExportFormat = 'auto' | VideoExportContainer;
export type VideoExportAudioCodec = 'aac' | 'opus';
export type VideoExportAudioPreference = 'auto' | VideoExportAudioCodec;
export type VideoExportResolution = '1080p' | '4k';
export type VideoExportFrameRate = 30 | 60;
export type VideoExportQuality = 'balanced' | 'high' | 'maximum';
export type VideoExportCameraMode = 'broadcast' | 'cinematic';
export type CreatorExportPresetId = 'youtube' | 'shorts' | 'master' | 'quick' | 'custom';
export type VideoExportPhase = 'idle' | 'preparing' | 'rendering' | 'audio' | 'muxing' | 'complete' | 'cancelled' | 'error';

export interface CreatorBattleHighlight {
  tick: number;
  kind: 'ultimate' | 'heavy-hit' | 'knockout';
  title: string;
  detail: string | null;
}

export interface CreatorBattleSummary {
  winnerName: string;
  winningTeam: number | null;
  durationSeconds: number;
  remainingHp: number;
  remainingHpRatio: number;
  largestHit: {
    amount: number;
    tick: number;
    sourceName: string;
    targetName: string;
    abilityName: string | null;
  } | null;
  topAbility: {
    abilityId: string;
    abilityName: string;
    sourceName: string;
    totalDamage: number;
  } | null;
  highlight: CreatorBattleHighlight | null;
}

export interface ReplayExportSource {
  replay: ReplayData;
  endTick: number;
  checksum: string;
  battleEnded: boolean;
}

export interface ReplayAudioExportSettings {
  enabled: boolean;
  codec: VideoExportAudioPreference;
  sampleRate: 48_000;
  channels: 2;
  bitrate: number;
}

export interface ReplayVideoExportCameraSettings {
  mode: VideoExportCameraMode;
  maxZoom: number;
  knockoutSlowMotionSeconds: number;
}

export interface ReplayVideoCreatorSettings {
  preset: CreatorExportPresetId;
  introSeconds: number;
  captionsEnabled: boolean;
  thumbnailEnabled: boolean;
}

export interface ReplayVideoExportSettings {
  format: VideoExportFormat;
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
  camera: ReplayVideoExportCameraSettings;
  creator: ReplayVideoCreatorSettings;
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
  container: VideoExportContainer;
  codec: VideoExportCodec;
  audioCodec: VideoExportAudioCodec | null;
  mimeType: 'video/mp4' | 'video/webm';
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
  cameraMode: VideoExportCameraMode;
  creatorPreset: CreatorExportPresetId;
  summary: CreatorBattleSummary;
  thumbnailBlob: Blob | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
}

export interface VideoExportCapability {
  supported: boolean;
  requestedFormat: VideoExportFormat;
  container: VideoExportContainer | null;
  fallback: boolean;
  notice: string | null;
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
