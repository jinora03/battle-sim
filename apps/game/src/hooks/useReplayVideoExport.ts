import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppSettings } from '@kinetic/platform';
import {
  ReplayVideoExporter,
  calculateCreatorIntroFrameCount,
  calculateKnockoutSlowMotionFrameCount,
  calculateReplayFrameCount,
  createStage810hExportSettings,
  detectVideoExportCapability,
  getCreatorExportPreset,
  type BroadcastLayoutId,
  type CreatorExportPresetId,
  type ReplayExportSource,
  type ReplayVideoExportProgress,
  type VideoExportCameraMode,
  type VideoExportCapability,
  type VideoExportFormat,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from '@kinetic/video-export';
import type { BattleRuntime } from '../runtime/BattleRuntime';
import {
  addReplayExportHistoryEntry,
  clearReplayExportHistory,
  readReplayExportHistory,
  type ReplayExportHistoryEntry
} from '../features/battle/replayExportHistory';

export interface ReplayVideoExportController {
  capability: VideoExportCapability | null;
  progress: ReplayVideoExportProgress;
  running: boolean;
  error: string | null;
  format: VideoExportFormat;
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  fps: VideoExportFrameRate;
  quality: VideoExportQuality;
  audioEnabled: boolean;
  cameraMode: VideoExportCameraMode;
  preset: CreatorExportPresetId;
  introEnabled: boolean;
  captionsEnabled: boolean;
  thumbnailEnabled: boolean;
  history: ReplayExportHistoryEntry[];
  setFormat(format: VideoExportFormat): void;
  setLayout(layout: BroadcastLayoutId): void;
  setResolution(resolution: VideoExportResolution): void;
  setFps(fps: VideoExportFrameRate): void;
  setQuality(quality: VideoExportQuality): void;
  setAudioEnabled(enabled: boolean): void;
  setCameraMode(mode: VideoExportCameraMode): void;
  applyPreset(preset: Exclude<CreatorExportPresetId, 'custom'>): void;
  setIntroEnabled(enabled: boolean): void;
  setCaptionsEnabled(enabled: boolean): void;
  setThumbnailEnabled(enabled: boolean): void;
  clearHistory(): void;
  start(): void;
  cancel(): void;
}

const INITIAL_PROGRESS: ReplayVideoExportProgress = {
  phase: 'idle',
  renderedFrames: 0,
  totalFrames: 0,
  progress: 0,
  elapsedMs: 0,
  estimatedRemainingMs: null,
  encodedBytes: 0,
  message: 'Ready to export the current replay as MP4 or WebM.'
};

export function useReplayVideoExport(
  runtimeRef: RefObject<BattleRuntime | null>,
  settings: AppSettings
): ReplayVideoExportController {
  const [format, setFormatState] = useState<VideoExportFormat>('auto');
  const [layout, setLayoutState] = useState<BroadcastLayoutId>('landscape');
  const [resolution, setResolutionState] = useState<VideoExportResolution>('1080p');
  const [fps, setFpsState] = useState<VideoExportFrameRate>(60);
  const [quality, setQualityState] = useState<VideoExportQuality>('high');
  const [audioEnabled, setAudioEnabledState] = useState(true);
  const [cameraMode, setCameraModeState] = useState<VideoExportCameraMode>('cinematic');
  const [preset, setPreset] = useState<CreatorExportPresetId>('youtube');
  const [introEnabled, setIntroEnabledState] = useState(true);
  const [captionsEnabled, setCaptionsEnabledState] = useState(true);
  const [thumbnailEnabled, setThumbnailEnabledState] = useState(true);
  const [history, setHistory] = useState<ReplayExportHistoryEntry[]>(readReplayExportHistory);
  const exportSettings = useMemo(() => createStage810hExportSettings(settings, {
    format, preset, layout, resolution, fps, quality, audio: audioEnabled, camera: cameraMode,
    intro: introEnabled, captions: captionsEnabled, thumbnail: thumbnailEnabled
  }), [audioEnabled, cameraMode, captionsEnabled, format, fps, introEnabled, layout, preset, quality, resolution, settings, thumbnailEnabled]);
  const exporterRef = useRef(new ReplayVideoExporter());
  const abortRef = useRef<AbortController | null>(null);
  const [capability, setCapability] = useState<VideoExportCapability | null>(null);
  const [progress, setProgress] = useState<ReplayVideoExportProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const running = progress.phase === 'preparing'
    || progress.phase === 'rendering'
    || progress.phase === 'audio'
    || progress.phase === 'muxing';

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
  const setCameraMode = useCallback((value: VideoExportCameraMode) => {
    setPreset('custom');
    setCameraModeState(value);
  }, []);
  const setIntroEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setIntroEnabledState(value);
  }, []);
  const setCaptionsEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setCaptionsEnabledState(value);
  }, []);
  const setThumbnailEnabled = useCallback((value: boolean) => {
    setPreset('custom');
    setThumbnailEnabledState(value);
  }, []);
  const applyPreset = useCallback((value: Exclude<CreatorExportPresetId, 'custom'>) => {
    const definition = getCreatorExportPreset(value);
    setPreset(value);
    setLayoutState(definition.layout);
    setResolutionState(definition.resolution);
    setFpsState(definition.fps);
    setQualityState(definition.quality);
    setAudioEnabledState(definition.audio);
    setCameraModeState(definition.camera);
    setIntroEnabledState(true);
    setCaptionsEnabledState(true);
    setThumbnailEnabledState(true);
  }, []);
  const clearHistory = useCallback(() => {
    setHistory(clearReplayExportHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCapability(null);
    setError(null);
    void detectVideoExportCapability(exportSettings).then((result) => {
      if (!cancelled) setCapability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [exportSettings]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (running || abortRef.current) return;
    const runtime = runtimeRef.current;
    if (!runtime) {
      setError('The battle runtime is not ready yet.');
      return;
    }
    if (!capability?.supported) {
      setError(capability?.reason ?? 'Video export support is still being checked.');
      return;
    }

    let source: ReplayExportSource;
    try {
      source = runtime.createReplayExportSource();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The replay is not ready for export.');
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    setError(null);
    const replayFrames = calculateReplayFrameCount(source.endTick, exportSettings.fps);
    const introFrames = calculateCreatorIntroFrameCount(exportSettings);
    const knockoutFrames = calculateKnockoutSlowMotionFrameCount(exportSettings, source.battleEnded);
    const holdFrames = source.battleEnded ? Math.round(exportSettings.resultHoldSeconds * exportSettings.fps) : 0;
    setProgress({
      ...INITIAL_PROGRESS,
      phase: 'preparing',
      totalFrames: introFrames + replayFrames + knockoutFrames + holdFrames,
      message: 'Preparing the dedicated video and audio renderer.'
    });

    void exporterRef.current.export(
      source,
      exportSettings,
      { onProgress: setProgress },
      abortController.signal
    ).then(async (result) => {
      const audioSuffix = result.audioCodec ? '-audio' : '-silent';
      const baseName = `kinetic-battle-${source.replay.battle.seed}-${result.layout}-${result.cameraMode}-${result.resolution}-${result.fps}fps${audioSuffix}`;
      const extension = result.container === 'mp4' ? 'mp4' : 'webm';
      const filename = `${baseName}.${extension}`;
      downloadBlob(result.blob, filename);
      if (result.thumbnailBlob) downloadBlob(result.thumbnailBlob, `${baseName}-thumbnail.png`);
      setHistory(addReplayExportHistoryEntry(result, filename));

      // Renderer recovery is a post-export lifecycle concern. A transient first
      // recovery attempt must not relabel an already downloaded video as a
      // failed export; retry once at the controller boundary after the runtime's
      // own fresh-context retries have been exhausted.
      let recoveryFailure: unknown = null;
      try {
        await runtime.restoreRendererAfterVideoExport();
      } catch (reason) {
        recoveryFailure = reason;
        try {
          await runtime.restoreRendererAfterVideoExport();
          recoveryFailure = null;
        } catch (retryReason) {
          recoveryFailure = retryReason;
        }
      }

      if (recoveryFailure) {
        const detail = recoveryFailure instanceof Error ? recoveryFailure.message : 'unknown renderer error';
        const message = `Video exported, but the battle renderer could not recover: ${detail}`;
        setError(message);
        setProgress((current) => ({ ...current, phase: 'error', progress: 1, estimatedRemainingMs: 0, message }));
        return;
      }

      setProgress((current) => ({
        ...current,
        phase: 'complete',
        progress: 1,
        estimatedRemainingMs: 0,
        message: 'Video export complete. Battle renderer restored.'
      }));
    }).catch(async (reason: unknown) => {
      try {
        await runtime.restoreRendererAfterVideoExport();
      } catch {
        // Preserve the original encoder/cancellation error. Renderer recovery is
        // retried automatically on the next export lifecycle.
      }
      const message = reason instanceof Error ? reason.message : 'Video export failed.';
      setError(message);
      setProgress((current) => ({
        ...current,
        phase: abortController.signal.aborted ? 'cancelled' : 'error',
        message
      }));
    }).finally(() => {
      if (abortRef.current === abortController) abortRef.current = null;
    });
  }, [capability, exportSettings, running, runtimeRef]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    capability,
    progress,
    running,
    error,
    format,
    layout,
    resolution,
    fps,
    quality,
    audioEnabled,
    cameraMode,
    preset,
    introEnabled,
    captionsEnabled,
    thumbnailEnabled,
    history,
    setFormat,
    setLayout,
    setResolution,
    setFps,
    setQuality,
    setAudioEnabled,
    setCameraMode,
    applyPreset,
    setIntroEnabled,
    setCaptionsEnabled,
    setThumbnailEnabled,
    clearHistory,
    start,
    cancel
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
