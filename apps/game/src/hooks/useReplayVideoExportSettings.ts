import { useCallback, useMemo, useState } from 'react';
import type { AppSettings } from '@kinetic/platform';
import {
  createStage810hExportSettings,
  getCreatorExportPreset,
  type BroadcastLayoutId,
  type CreatorExportPresetId,
  type ReplayVideoExportSettings,
  type VideoExportCameraMode,
  type VideoExportFormat,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from '@kinetic/video-export';
import { DEFAULT_REPLAY_VIDEO_EXPORT_SELECTIONS } from './replayVideoExportModel';

export interface ReplayVideoExportSettingsController {
  exportSettings: ReplayVideoExportSettings;
  format: VideoExportFormat;
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  fps: VideoExportFrameRate;
  quality: VideoExportQuality;
  audioEnabled: boolean;
  backgroundMusicEnabled: boolean;
  backgroundMusicVolume: number;
  cameraMode: VideoExportCameraMode;
  cameraShakeEnabled: boolean;
  screenFlashEnabled: boolean;
  preset: CreatorExportPresetId;
  introEnabled: boolean;
  highlightsEnabled: boolean;
  captionsEnabled: boolean;
  thumbnailEnabled: boolean;
  fighterNameplatesEnabled: boolean;
  setFormat(value: VideoExportFormat): void;
  setLayout(value: BroadcastLayoutId): void;
  setResolution(value: VideoExportResolution): void;
  setFps(value: VideoExportFrameRate): void;
  setQuality(value: VideoExportQuality): void;
  setAudioEnabled(value: boolean): void;
  setBackgroundMusicEnabled(value: boolean): void;
  setBackgroundMusicVolume(value: number): void;
  setCameraMode(value: VideoExportCameraMode): void;
  setCameraShakeEnabled(value: boolean): void;
  setScreenFlashEnabled(value: boolean): void;
  applyPreset(value: Exclude<CreatorExportPresetId, 'custom'>): void;
  setIntroEnabled(value: boolean): void;
  setHighlightsEnabled(value: boolean): void;
  setCaptionsEnabled(value: boolean): void;
  setThumbnailEnabled(value: boolean): void;
  setFighterNameplatesEnabled(value: boolean): void;
}

/** Owns creator-export selections and derives the immutable exporter settings snapshot. */
export function useReplayVideoExportSettings(settings: AppSettings): ReplayVideoExportSettingsController {
  const defaults = DEFAULT_REPLAY_VIDEO_EXPORT_SELECTIONS;
  const [format, setFormatState] = useState<VideoExportFormat>(defaults.format);
  const [layout, setLayoutState] = useState<BroadcastLayoutId>(defaults.layout);
  const [resolution, setResolutionState] = useState<VideoExportResolution>(defaults.resolution);
  const [fps, setFpsState] = useState<VideoExportFrameRate>(defaults.fps);
  const [quality, setQualityState] = useState<VideoExportQuality>(defaults.quality);
  const [audioEnabled, setAudioEnabledState] = useState(defaults.audioEnabled);
  const [backgroundMusicEnabled, setBackgroundMusicEnabledState] = useState(defaults.backgroundMusicEnabled);
  const [backgroundMusicVolume, setBackgroundMusicVolumeState] = useState(defaults.backgroundMusicVolume);
  const [cameraMode, setCameraModeState] = useState<VideoExportCameraMode>(defaults.cameraMode);
  const [cameraShakeEnabled, setCameraShakeEnabledState] = useState(defaults.cameraShakeEnabled);
  const [screenFlashEnabled, setScreenFlashEnabledState] = useState(defaults.screenFlashEnabled);
  const [preset, setPreset] = useState<CreatorExportPresetId>(defaults.preset);
  const [introEnabled, setIntroEnabledState] = useState(defaults.introEnabled);
  const [highlightsEnabled, setHighlightsEnabledState] = useState(defaults.highlightsEnabled);
  const [captionsEnabled, setCaptionsEnabledState] = useState(defaults.captionsEnabled);
  const [thumbnailEnabled, setThumbnailEnabledState] = useState(defaults.thumbnailEnabled);
  const [fighterNameplatesEnabled, setFighterNameplatesEnabledState] = useState(defaults.fighterNameplatesEnabled);

  const exportSettings = useMemo(() => createStage810hExportSettings(settings, {
    format,
    preset,
    layout,
    resolution,
    fps,
    quality,
    audio: audioEnabled,
    camera: cameraMode,
    intro: introEnabled,
    highlights: highlightsEnabled,
    captions: captionsEnabled,
    thumbnail: thumbnailEnabled,
    fighterNameplates: fighterNameplatesEnabled,
    backgroundMusic: backgroundMusicEnabled,
    backgroundMusicVolume,
    cameraShake: cameraShakeEnabled,
    screenFlash: screenFlashEnabled
  }), [
    audioEnabled,
    backgroundMusicEnabled,
    backgroundMusicVolume,
    cameraMode,
    cameraShakeEnabled,
    captionsEnabled,
    fighterNameplatesEnabled,
    format,
    fps,
    highlightsEnabled,
    introEnabled,
    layout,
    preset,
    quality,
    resolution,
    screenFlashEnabled,
    settings,
    thumbnailEnabled
  ]);

  const setFormat = useCallback((value: VideoExportFormat) => {
    setFormatState(value);
  }, []);
  const setLayout = useCallback((value: BroadcastLayoutId) => {
    setPreset('custom');
    setLayoutState(value);
  }, []);
  const setResolution = useCallback((value: VideoExportResolution) => {
    setPreset('custom');
    setResolutionState(value);
  }, []);
  const setFps = useCallback((value: VideoExportFrameRate) => {
    setPreset('custom');
    setFpsState(value);
  }, []);
  const setQuality = useCallback((value: VideoExportQuality) => {
    setPreset('custom');
    setQualityState(value);
  }, []);
  const setAudioEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setAudioEnabledState(value);
  }, []);
  const setBackgroundMusicEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setBackgroundMusicEnabledState(value);
  }, []);
  const setBackgroundMusicVolume = useCallback((value: number) => {
    setPreset('custom');
    setBackgroundMusicVolumeState(Math.max(0, Math.min(0.3, value)));
  }, []);
  const setCameraMode = useCallback((value: VideoExportCameraMode) => {
    setPreset('custom');
    setCameraModeState(value);
  }, []);
  const setCameraShakeEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setCameraShakeEnabledState(value);
  }, []);
  const setScreenFlashEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setScreenFlashEnabledState(value);
  }, []);
  const setIntroEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setIntroEnabledState(value);
  }, []);
  const setHighlightsEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setHighlightsEnabledState(value);
  }, []);
  const setCaptionsEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setCaptionsEnabledState(value);
  }, []);
  const setThumbnailEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setThumbnailEnabledState(value);
  }, []);
  const setFighterNameplatesEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setFighterNameplatesEnabledState(value);
  }, []);
  const applyPreset = useCallback((value: Exclude<CreatorExportPresetId, 'custom'>) => {
    const definition = getCreatorExportPreset(value);
    setPreset(value);
    setLayoutState(definition.layout);
    setResolutionState(definition.resolution);
    setFpsState(definition.fps);
    setQualityState(definition.quality);
    setAudioEnabledState(definition.audio);
    setBackgroundMusicEnabledState(true);
    setBackgroundMusicVolumeState(0.15);
    setCameraModeState(definition.camera);
    setCameraShakeEnabledState(true);
    setScreenFlashEnabledState(true);
    setIntroEnabledState(true);
    setHighlightsEnabledState(true);
    setCaptionsEnabledState(true);
    setThumbnailEnabledState(true);
    setFighterNameplatesEnabledState(true);
  }, []);

  return {
    exportSettings,
    format,
    layout,
    resolution,
    fps,
    quality,
    audioEnabled,
    backgroundMusicEnabled,
    backgroundMusicVolume,
    cameraMode,
    cameraShakeEnabled,
    screenFlashEnabled,
    preset,
    introEnabled,
    highlightsEnabled,
    captionsEnabled,
    thumbnailEnabled,
    fighterNameplatesEnabled,
    setFormat,
    setLayout,
    setResolution,
    setFps,
    setQuality,
    setAudioEnabled,
    setBackgroundMusicEnabled,
    setBackgroundMusicVolume,
    setCameraMode,
    setCameraShakeEnabled,
    setScreenFlashEnabled,
    applyPreset,
    setIntroEnabled,
    setHighlightsEnabled,
    setCaptionsEnabled,
    setThumbnailEnabled,
    setFighterNameplatesEnabled
  };
}
