import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppSettings } from '@kinetic/platform';
import {
  ReplayVideoExporter,
  calculateCreatorIntroFrameCount,
  calculateKnockoutSlowMotionFrameCount,
  calculateReplayFrameCount,
  createStage810hExportSettings,
  detectVideoExportCapability,
  generateSeedReplay,
  getCreatorExportPreset,
  type BroadcastLayoutId,
  type CreatorExportPresetId,
  type ReplayExportSource,
  type ReplayVideoExportProgress,
  type SeedReplayGenerationProgress,
  type VideoExportCameraMode,
  type VideoExportCapability,
  type VideoExportFormat,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from '@kinetic/video-export';
import type { BattleRuntime } from '../runtime/BattleRuntime';
import type { BattleSetup } from '../runtime/BattleSetup';
import { createBattleDefinition, normalizeBattleSeed } from '../runtime/createBattleDefinition';
import {
  addReplayExportHistoryEntry,
  clearReplayExportHistory,
  readReplayExportHistory,
  type ReplayExportHistoryEntry
} from '../features/battle/replayExportHistory';

export type ReplayVideoSourceMode = 'current-replay' | 'setup-seed';

export interface ReplayVideoExportController {
  capability: VideoExportCapability | null;
  progress: ReplayVideoExportProgress;
  seedProgress: SeedReplayGenerationProgress | null;
  preparingReplay: boolean;
  running: boolean;
  error: string | null;
  sourceMode: ReplayVideoSourceMode;
  generationSeedText: string;
  preparedReplayTick: number | null;
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
  setSourceMode(mode: ReplayVideoSourceMode): void;
  setGenerationSeedText(value: string): void;
  randomizeSeed(): void;
  reuseCurrentSeed(): void;
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
  settings: AppSettings,
  setup: BattleSetup,
  currentSeed: number
): ReplayVideoExportController {
  const [sourceMode, setSourceMode] = useState<ReplayVideoSourceMode>('current-replay');
  const [generationSeedText, setGenerationSeedTextState] = useState(() => String(normalizeBattleSeed(currentSeed)));
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
  const preparedSourceRef = useRef<{ key: string; source: ReplayExportSource } | null>(null);
  const [preparedSourceKey, setPreparedSourceKey] = useState<string | null>(null);
  const [capability, setCapability] = useState<VideoExportCapability | null>(null);
  const [progress, setProgress] = useState<ReplayVideoExportProgress>(INITIAL_PROGRESS);
  const [seedProgress, setSeedProgress] = useState<SeedReplayGenerationProgress | null>(null);
  const [preparingReplay, setPreparingReplay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generationSeed = normalizeBattleSeed(Number(generationSeedText) || 1);
  const configuredBattle = useMemo(
    () => createBattleDefinition(setup, generationSeed),
    [generationSeed, setup]
  );
  const configuredBattleKey = useMemo(() => JSON.stringify(configuredBattle), [configuredBattle]);
  const preparedReplayTick = preparedSourceKey === configuredBattleKey
    ? preparedSourceRef.current?.source.endTick ?? null
    : null;
  const running = preparingReplay
    || progress.phase === 'preparing'
    || progress.phase === 'rendering'
    || progress.phase === 'audio'
    || progress.phase === 'muxing';

  const setGenerationSeedText = useCallback((value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setGenerationSeedTextState(digitsOnly);
  }, []);
  const randomizeSeed = useCallback(() => {
    setGenerationSeedTextState(String(generateRandomSeed()));
  }, []);
  const reuseCurrentSeed = useCallback(() => {
    setGenerationSeedTextState(String(normalizeBattleSeed(currentSeed)));
  }, [currentSeed]);
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
    if (!capability?.supported) {
      setError(capability?.reason ?? 'Video export support is still being checked.');
      return;
    }

    const abortController = new AbortController();
    let videoRenderingStarted = false;
    abortRef.current = abortController;
    setError(null);
    setSeedProgress(null);
    setProgress(INITIAL_PROGRESS);

    const run = async () => {
      const runtime = runtimeRef.current;
      let source: ReplayExportSource;

      if (sourceMode === 'setup-seed') {
        const cached = preparedSourceRef.current;
        if (cached?.key === configuredBattleKey) {
          source = cached.source;
        } else {
          setPreparingReplay(true);
          try {
            source = await generateSeedReplay(configuredBattle, {
              signal: abortController.signal,
              onProgress: setSeedProgress
            });
            preparedSourceRef.current = { key: configuredBattleKey, source };
            setPreparedSourceKey(configuredBattleKey);
          } finally {
            setPreparingReplay(false);
          }
        }
      } else {
        if (!runtime) throw new Error('The battle runtime is not ready yet.');
        source = runtime.createReplayExportSource();
      }

      if (abortController.signal.aborted) throw new Error('Video export was cancelled.');
      const replayFrames = calculateReplayFrameCount(source.endTick, exportSettings.fps);
      const introFrames = calculateCreatorIntroFrameCount(exportSettings);
      const knockoutFrames = calculateKnockoutSlowMotionFrameCount(exportSettings, source.battleEnded);
      const holdFrames = source.battleEnded ? Math.round(exportSettings.resultHoldSeconds * exportSettings.fps) : 0;
      setProgress({
        ...INITIAL_PROGRESS,
        phase: 'preparing',
        totalFrames: introFrames + replayFrames + knockoutFrames + holdFrames,
        message: sourceMode === 'setup-seed'
          ? 'Replay ready. Preparing the dedicated video and audio renderer.'
          : 'Preparing the dedicated video and audio renderer.'
      });

      videoRenderingStarted = true;
      const result = await exporterRef.current.export(
        source,
        exportSettings,
        { onProgress: setProgress },
        abortController.signal
      );
      const audioSuffix = result.audioCodec ? '-audio' : '-silent';
      const baseName = `kinetic-battle-${source.replay.battle.seed}-${result.layout}-${result.cameraMode}-${result.resolution}-${result.fps}fps${audioSuffix}`;
      const extension = result.container === 'mp4' ? 'mp4' : 'webm';
      const filename = `${baseName}.${extension}`;
      downloadBlob(result.blob, filename);
      if (result.thumbnailBlob) downloadBlob(result.thumbnailBlob, `${baseName}-thumbnail.png`);
      setHistory(addReplayExportHistoryEntry(result, filename));

      const recoveryFailure = runtime ? await recoverLiveRenderer(runtime) : null;
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
        message: runtime ? 'Video export complete. Battle renderer restored.' : 'Video export complete.'
      }));
    };

    void run().catch(async (reason: unknown) => {
      setPreparingReplay(false);
      const runtime = runtimeRef.current;
      if (runtime && videoRenderingStarted) {
        try {
          await runtime.restoreRendererAfterVideoExport();
        } catch {
          // Preserve the original simulation/encoder/cancellation error.
        }
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
  }, [capability, configuredBattle, configuredBattleKey, exportSettings, running, runtimeRef, sourceMode]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    capability,
    progress,
    seedProgress,
    preparingReplay,
    running,
    error,
    sourceMode,
    generationSeedText,
    preparedReplayTick,
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
    setSourceMode,
    setGenerationSeedText,
    randomizeSeed,
    reuseCurrentSeed,
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

async function recoverLiveRenderer(runtime: BattleRuntime): Promise<unknown | null> {
  try {
    await runtime.restoreRendererAfterVideoExport();
    return null;
  } catch (reason) {
    try {
      await runtime.restoreRendererAfterVideoExport();
      return null;
    } catch (retryReason) {
      return retryReason ?? reason;
    }
  }
}

function generateRandomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
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
