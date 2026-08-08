import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppSettings } from '@kinetic/platform';
import {
  ReplayVideoExporter,
  calculateCreatorIntroFrameCount,
  calculateKnockoutSlowMotionFrameCount,
  calculateReplayFrameCount,
  createReplayExportArchive,
  createStage810hExportSettings,
  detectReliableVideoExportCapability,
  detectVideoExportDeviceProfile,
  calculateReliabilityFrameCount,
  exportReplayWithReliability,
  forecastVideoExportMemory,
  generateSeedReplay,
  getCreatorExportPreset,
  rankBattleSeeds,
  runReplayExportQueue,
  type BroadcastLayoutId,
  type CreatorExportPresetId,
  type ReplayExportSource,
  type RankedSeedBattle,
  type ReplayVideoExportProgress,
  type ReplayVideoExportResult,
  type ReplayVideoExportSettings,
  type SeedBatchProgress,
  type SeedBatchSize,
  type SeedReplayGenerationProgress,
  type VideoExportCameraMode,
  type VideoExportCapability,
  type VideoExportDeviceProfile,
  type VideoExportMemoryForecast,
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
export type ReplayVideoQueueItemStatus = 'queued' | 'preparing' | 'rendering' | 'complete' | 'error' | 'cancelled';

export interface ReplayVideoQueueItem {
  id: string;
  sourceKey: string;
  sourceLabel: string;
  seed: number;
  settings: ReplayVideoExportSettings;
  settingsKey: string;
  status: ReplayVideoQueueItemStatus;
  progress: number;
  message: string;
  filename: string | null;
  thumbnailFilename: string | null;
  encodedBytes: number;
  error: string | null;
}

export type ReplayDirectDownloadStatus = 'idle' | 'ready' | 'requesting' | 'requested';

export interface ReplayDirectDownloadState {
  status: ReplayDirectDownloadStatus;
  filename: string | null;
  thumbnailFilename: string | null;
  encodedBytes: number;
  message: string;
}

export interface ReplayVideoExportController {
  capability: VideoExportCapability | null;
  deviceProfile: VideoExportDeviceProfile;
  memoryForecast: VideoExportMemoryForecast | null;
  progress: ReplayVideoExportProgress;
  seedProgress: SeedReplayGenerationProgress | null;
  batchProgress: SeedBatchProgress | null;
  batchSearching: boolean;
  batchSize: SeedBatchSize;
  batchResults: RankedSeedBattle[];
  queueItems: ReplayVideoQueueItem[];
  queueRunning: boolean;
  queuePackaging: boolean;
  queueMessage: string | null;
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
  cameraShakeEnabled: boolean;
  screenFlashEnabled: boolean;
  preset: CreatorExportPresetId;
  introEnabled: boolean;
  highlightsEnabled: boolean;
  captionsEnabled: boolean;
  thumbnailEnabled: boolean;
  autoDownloadEnabled: boolean;
  directDownload: ReplayDirectDownloadState;
  history: ReplayExportHistoryEntry[];
  setSourceMode(mode: ReplayVideoSourceMode): void;
  setGenerationSeedText(value: string): void;
  randomizeSeed(): void;
  reuseCurrentSeed(): void;
  setBatchSize(size: SeedBatchSize): void;
  searchSeeds(): void;
  selectRankedSeed(seed: number): void;
  addToQueue(): void;
  queueTopRankedSeeds(): void;
  startQueue(): void;
  removeQueueItem(id: string): void;
  retryQueueItem(id: string): void;
  downloadQueueItem(id: string): void;
  downloadQueueArchive(): void;
  clearQueue(): void;
  setFormat(format: VideoExportFormat): void;
  setLayout(layout: BroadcastLayoutId): void;
  setResolution(resolution: VideoExportResolution): void;
  setFps(fps: VideoExportFrameRate): void;
  setQuality(quality: VideoExportQuality): void;
  setAudioEnabled(enabled: boolean): void;
  setCameraMode(mode: VideoExportCameraMode): void;
  setCameraShakeEnabled(enabled: boolean): void;
  setScreenFlashEnabled(enabled: boolean): void;
  applyPreset(preset: Exclude<CreatorExportPresetId, 'custom'>): void;
  setIntroEnabled(enabled: boolean): void;
  setHighlightsEnabled(enabled: boolean): void;
  setCaptionsEnabled(enabled: boolean): void;
  setThumbnailEnabled(enabled: boolean): void;
  setAutoDownloadEnabled(enabled: boolean): void;
  downloadLatest(): void;
  downloadLatestThumbnail(): void;
  clearHistory(): void;
  start(mode?: ReplayVideoSourceMode): void;
  cancel(): void;
}

const MAX_EXPORT_QUEUE_ITEMS = 8;
const AUTO_DOWNLOAD_STORAGE_KEY = 'kinetic.replay-video.auto-download.v1';

type ConfiguredBattle = ReturnType<typeof createBattleDefinition>;

type ReplayQueueSourceDescriptor =
  | { key: string; kind: 'replay'; label: string; seed: number; source: ReplayExportSource }
  | { key: string; kind: 'setup'; label: string; seed: number; battleKey: string; battle: ConfiguredBattle };

interface ReplayQueueFileSet {
  video: { filename: string; blob: Blob };
  thumbnail: { filename: string; blob: Blob } | null;
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

const INITIAL_DIRECT_DOWNLOAD: ReplayDirectDownloadState = {
  status: 'idle',
  filename: null,
  thumbnailFilename: null,
  encodedBytes: 0,
  message: 'No completed single export is waiting for download.'
};

export function useReplayVideoExport(
  runtimeRef: RefObject<BattleRuntime | null>,
  settings: AppSettings,
  setup: BattleSetup,
  currentSeed: number,
  currentReplayTick: number
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
  const [cameraShakeEnabled, setCameraShakeEnabledState] = useState(true);
  const [screenFlashEnabled, setScreenFlashEnabledState] = useState(true);
  const [preset, setPreset] = useState<CreatorExportPresetId>('youtube');
  const [introEnabled, setIntroEnabledState] = useState(true);
  const [highlightsEnabled, setHighlightsEnabledState] = useState(true);
  const [captionsEnabled, setCaptionsEnabledState] = useState(true);
  const [thumbnailEnabled, setThumbnailEnabledState] = useState(true);
  const [autoDownloadEnabled, setAutoDownloadEnabledState] = useState(readAutoDownloadPreference);
  const [directDownload, setDirectDownload] = useState<ReplayDirectDownloadState>(INITIAL_DIRECT_DOWNLOAD);
  const [history, setHistory] = useState<ReplayExportHistoryEntry[]>(readReplayExportHistory);
  const [batchSize, setBatchSize] = useState<SeedBatchSize>(10);
  const [batchResults, setBatchResults] = useState<RankedSeedBattle[]>([]);
  const [batchProgress, setBatchProgress] = useState<SeedBatchProgress | null>(null);
  const [batchSearching, setBatchSearching] = useState(false);
  const [queueItems, setQueueItems] = useState<ReplayVideoQueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queuePackaging, setQueuePackaging] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const exportSettings = useMemo(() => createStage810hExportSettings(settings, {
    format, preset, layout, resolution, fps, quality, audio: audioEnabled, camera: cameraMode,
    intro: introEnabled, highlights: highlightsEnabled, captions: captionsEnabled, thumbnail: thumbnailEnabled,
    cameraShake: cameraShakeEnabled, screenFlash: screenFlashEnabled
  }), [audioEnabled, cameraMode, cameraShakeEnabled, captionsEnabled, format, fps, highlightsEnabled, introEnabled, layout, preset, quality, resolution, screenFlashEnabled, settings, thumbnailEnabled]);
  const exporterRef = useRef(new ReplayVideoExporter());
  const abortRef = useRef<AbortController | null>(null);
  const preparedSourceRef = useRef<{ key: string; source: ReplayExportSource } | null>(null);
  const queueSourcesRef = useRef(new Map<string, ReplayQueueSourceDescriptor>());
  const queuePreparedSourcesRef = useRef(new Map<string, ReplayExportSource>());
  const queueFilesRef = useRef(new Map<string, ReplayQueueFileSet>());
  const directFilesRef = useRef<ReplayQueueFileSet | null>(null);
  const queueCounterRef = useRef(0);
  const [preparedSourceKey, setPreparedSourceKey] = useState<string | null>(null);
  const [capability, setCapability] = useState<VideoExportCapability | null>(null);
  const deviceProfile = useMemo(() => detectVideoExportDeviceProfile(), []);
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
  const configuredSetupKey = useMemo(() => JSON.stringify(setup), [setup]);
  const preparedReplayTick = preparedSourceKey === configuredBattleKey
    ? preparedSourceRef.current?.source.endTick ?? null
    : null;
  const reliabilityTick = sourceMode === 'current-replay' ? currentReplayTick : preparedReplayTick;
  const memoryForecast = useMemo(() => {
    if (!reliabilityTick || reliabilityTick <= 0) return null;
    const frameCount = calculateReliabilityFrameCount(
      { endTick: reliabilityTick, battleEnded: true },
      exportSettings
    );
    return forecastVideoExportMemory(exportSettings, frameCount, deviceProfile);
  }, [deviceProfile, exportSettings, reliabilityTick]);
  const running = batchSearching
    || queueRunning
    || queuePackaging
    || preparingReplay
    || progress.phase === 'preparing'
    || progress.phase === 'rendering'
    || progress.phase === 'audio'
    || progress.phase === 'finalizing'
    || progress.phase === 'muxing'
    || progress.phase === 'downloading';

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
  const selectRankedSeed = useCallback((seed: number) => {
    setGenerationSeedTextState(String(normalizeBattleSeed(seed)));
  }, []);
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
  const setAutoDownloadEnabled = useCallback((value: boolean) => {
    setAutoDownloadEnabledState(value);
    writeAutoDownloadPreference(value);
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
    setCameraShakeEnabledState(true);
    setScreenFlashEnabledState(true);
    setIntroEnabledState(true);
    setHighlightsEnabledState(true);
    setCaptionsEnabledState(true);
    setThumbnailEnabledState(true);
  }, []);
  const clearHistory = useCallback(() => {
    setHistory(clearReplayExportHistory());
  }, []);

  const handoffDirectDownload = useCallback(async (files: ReplayQueueFileSet): Promise<boolean> => {
    setDirectDownload({
      status: 'requesting',
      filename: files.video.filename,
      thumbnailFilename: files.thumbnail?.filename ?? null,
      encodedBytes: files.video.blob.size,
      message: 'Sending the completed video to your browser…'
    });
    await waitForBrowserPaint();
    try {
      downloadBlob(files.video.blob, files.video.filename);
      if (files.thumbnail) downloadBlob(files.thumbnail.blob, files.thumbnail.filename);
      setDirectDownload({
        status: 'requested',
        filename: files.video.filename,
        thumbnailFilename: files.thumbnail?.filename ?? null,
        encodedBytes: files.video.blob.size,
        message: files.thumbnail
          ? 'Video and thumbnail sent to your browser. Large files may take a moment to appear.'
          : 'Video sent to your browser. Large files may take a moment to appear.'
      });
      return true;
    } catch {
      setDirectDownload({
        status: 'ready',
        filename: files.video.filename,
        thumbnailFilename: files.thumbnail?.filename ?? null,
        encodedBytes: files.video.blob.size,
        message: 'The export is ready, but the browser did not accept the automatic download. Use Download video.'
      });
      return false;
    }
  }, []);

  const downloadLatest = useCallback(() => {
    const files = directFilesRef.current;
    if (!files) {
      setError('No completed single export is ready to download yet.');
      return;
    }
    setError(null);
    void handoffDirectDownload(files);
  }, [handoffDirectDownload]);

  const downloadLatestThumbnail = useCallback(() => {
    const thumbnail = directFilesRef.current?.thumbnail;
    if (!thumbnail) {
      setError('This export does not have a generated thumbnail.');
      return;
    }
    setError(null);
    downloadBlob(thumbnail.blob, thumbnail.filename);
  }, []);

  const addToQueue = useCallback(() => {
    if (running) return;
    if (capability?.supported !== true) {
      setError(capability?.reason ?? 'Video export support is still being checked.');
      return;
    }
    if (queueItems.length >= MAX_EXPORT_QUEUE_ITEMS) {
      setError(`The export queue is limited to ${MAX_EXPORT_QUEUE_ITEMS} items.`);
      return;
    }

    let descriptor: ReplayQueueSourceDescriptor;
    if (sourceMode === 'current-replay') {
      const runtime = runtimeRef.current;
      if (!runtime) {
        setError('The battle runtime is not ready yet.');
        return;
      }
      let source: ReplayExportSource;
      try {
        source = runtime.createReplayExportSource();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The current replay is not ready yet.');
        return;
      }
      if (source.endTick <= 0) {
        setError('Run a battle before adding the current replay to the export queue.');
        return;
      }
      if (!source.battleEnded) {
        setError('The current arena battle is still recording. Finish the battle before queueing its replay.');
        return;
      }
      const seed = source.replay.battle.seed >>> 0;
      const replayHash = hashReplayData(source.replay);
      const key = `replay:${seed}:${source.endTick}:${source.checksum}:${replayHash}`;
      descriptor = { key, kind: 'replay', label: `Replay seed ${seed}`, seed, source };
    } else {
      const seed = configuredBattle.seed >>> 0;
      const key = `setup:${configuredBattleKey}`;
      descriptor = {
        key,
        kind: 'setup',
        label: `Setup seed ${seed}`,
        seed,
        battleKey: configuredBattleKey,
        battle: structuredClone(configuredBattle)
      };
    }

    const settingsSnapshot = structuredClone(exportSettings);
    const settingsKey = JSON.stringify(settingsSnapshot);
    if (queueItems.some((item) => item.sourceKey === descriptor.key && item.settingsKey === settingsKey)) {
      setError('That source and export setting combination is already in the queue.');
      return;
    }

    queueSourcesRef.current.set(descriptor.key, descriptor);
    queueCounterRef.current += 1;
    const id = `export-${Date.now().toString(36)}-${queueCounterRef.current}`;
    setQueueItems((current) => [...current, {
      id,
      sourceKey: descriptor.key,
      sourceLabel: descriptor.label,
      seed: descriptor.seed,
      settings: settingsSnapshot,
      settingsKey,
      status: 'queued',
      progress: 0,
      message: 'Waiting in export queue.',
      filename: null,
      thumbnailFilename: null,
      encodedBytes: 0,
      error: null
    }]);
    setQueueMessage('Added current source and settings to the export queue.');
    setError(null);
  }, [capability, configuredBattle, configuredBattleKey, exportSettings, queueItems, running, runtimeRef, sourceMode]);

  const queueTopRankedSeeds = useCallback(() => {
    if (running) return;
    if (capability?.supported !== true) {
      setError(capability?.reason ?? 'Video export support is still being checked.');
      return;
    }
    const availableSlots = MAX_EXPORT_QUEUE_ITEMS - queueItems.length;
    if (availableSlots <= 0) {
      setError(`The export queue is limited to ${MAX_EXPORT_QUEUE_ITEMS} items.`);
      return;
    }
    const candidates = batchResults.slice(0, Math.min(3, availableSlots));
    if (candidates.length === 0) {
      setError('Run a seed search before queueing ranked battles.');
      return;
    }

    const additions: ReplayVideoQueueItem[] = [];
    for (const ranked of candidates) {
      const battle = createBattleDefinition(setup, normalizeBattleSeed(ranked.seed));
      const battleKey = JSON.stringify(battle);
      const sourceKey = `setup:${battleKey}`;
      const settingsSnapshot = structuredClone(exportSettings);
      const settingsKey = JSON.stringify(settingsSnapshot);
      const duplicate = queueItems.some((item) => item.sourceKey === sourceKey && item.settingsKey === settingsKey)
        || additions.some((item) => item.sourceKey === sourceKey && item.settingsKey === settingsKey);
      if (duplicate) continue;

      queueSourcesRef.current.set(sourceKey, {
        key: sourceKey,
        kind: 'setup',
        label: `Rank #${ranked.rank} · seed ${ranked.seed}`,
        seed: ranked.seed >>> 0,
        battleKey,
        battle
      });
      queueCounterRef.current += 1;
      additions.push({
        id: `export-${Date.now().toString(36)}-${queueCounterRef.current}`,
        sourceKey,
        sourceLabel: `Rank #${ranked.rank} · seed ${ranked.seed}`,
        seed: ranked.seed >>> 0,
        settings: settingsSnapshot,
        settingsKey,
        status: 'queued',
        progress: 0,
        message: 'Waiting in export queue.',
        filename: null,
        thumbnailFilename: null,
        encodedBytes: 0,
        error: null
      });
    }

    if (additions.length === 0) {
      setError('The top ranked battles with these settings are already queued.');
      return;
    }
    setQueueItems((current) => [...current, ...additions]);
    setQueueMessage(`Queued ${additions.length} ranked battle${additions.length === 1 ? '' : 's'} for sequential export.`);
    setError(null);
  }, [batchResults, capability, exportSettings, queueItems, running, setup]);

  const removeQueueItem = useCallback((id: string) => {
    if (running) return;
    setQueueItems((current) => current.filter((item) => item.id !== id));
    queueFilesRef.current.delete(id);
  }, [running]);

  const retryQueueItem = useCallback((id: string) => {
    if (running) return;
    queueFilesRef.current.delete(id);
    setQueueItems((current) => current.map((item) => item.id === id && (item.status === 'error' || item.status === 'cancelled')
      ? { ...item, status: 'queued', progress: 0, message: 'Waiting in export queue.', error: null, filename: null, thumbnailFilename: null, encodedBytes: 0 }
      : item));
    setQueueMessage('Queued item ready to retry.');
    setError(null);
  }, [running]);

  const downloadQueueItem = useCallback((id: string) => {
    const files = queueFilesRef.current.get(id);
    if (!files) {
      setError('That queued export has not completed yet.');
      return;
    }
    downloadBlob(files.video.blob, files.video.filename);
    if (files.thumbnail) downloadBlob(files.thumbnail.blob, files.thumbnail.filename);
  }, []);

  const clearQueue = useCallback(() => {
    if (running) return;
    setQueueItems([]);
    setQueueMessage(null);
    queueSourcesRef.current.clear();
    queuePreparedSourcesRef.current.clear();
    queueFilesRef.current.clear();
  }, [running]);

  const downloadQueueArchive = useCallback(() => {
    if (running || abortRef.current) return;
    const archiveEntries = queueItems.flatMap((item) => {
      if (item.status !== 'complete') return [];
      const files = queueFilesRef.current.get(item.id);
      if (!files) return [];
      return files.thumbnail ? [files.video, files.thumbnail] : [files.video];
    });
    if (archiveEntries.length === 0) {
      setError('Complete at least one queued export before creating a ZIP download.');
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    setQueuePackaging(true);
    setQueueMessage(`Packaging ${archiveEntries.length} completed file${archiveEntries.length === 1 ? '' : 's'}…`);
    setError(null);

    void createReplayExportArchive(archiveEntries, { signal: abortController.signal }).then((archive) => {
      downloadBlob(archive, createArchiveFilename());
      setQueueMessage(`ZIP ready with ${archiveEntries.length} completed file${archiveEntries.length === 1 ? '' : 's'}.`);
    }).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : 'Could not package completed exports.';
      if (!abortController.signal.aborted) setError(message);
      setQueueMessage(abortController.signal.aborted ? 'ZIP packaging cancelled.' : 'ZIP packaging failed.');
    }).finally(() => {
      setQueuePackaging(false);
      if (abortRef.current === abortController) abortRef.current = null;
    });
  }, [queueItems, running]);

  useEffect(() => {
    let cancelled = false;
    setCapability(null);
    setError(null);
    void detectReliableVideoExportCapability(exportSettings).then((result) => {
      if (!cancelled) setCapability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [exportSettings]);

  useEffect(() => {
    setBatchResults([]);
    setBatchProgress(null);
  }, [configuredSetupKey]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const searchSeeds = useCallback(() => {
    if (running || abortRef.current) return;

    const abortController = new AbortController();
    abortRef.current = abortController;
    setError(null);
    setBatchResults([]);
    setBatchProgress(null);
    setBatchSearching(true);

    const run = async () => {
      const results = await rankBattleSeeds(configuredBattle, {
        count: batchSize,
        startSeed: generationSeed,
        signal: abortController.signal,
        onProgress: setBatchProgress
      });
      setBatchResults(results);
      if (results[0]) setGenerationSeedTextState(String(results[0].seed));
    };

    void run().catch((reason: unknown) => {
      if (abortController.signal.aborted) {
        setBatchProgress((current) => current ? {
          ...current,
          phase: 'cancelled',
          message: 'Seed search cancelled.'
        } : null);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Seed search failed.');
    }).finally(() => {
      setBatchSearching(false);
      if (abortRef.current === abortController) abortRef.current = null;
    });
  }, [batchSize, configuredBattle, generationSeed, running]);

  const startQueue = useCallback(() => {
    if (running || abortRef.current) return;
    const pendingItems = queueItems.filter((item) => item.status === 'queued');
    if (pendingItems.length === 0) {
      setError('Add an export to the queue, or retry a failed item, before running the queue.');
      return;
    }

    const abortController = new AbortController();
    let activeItemId: string | null = null;
    let videoRenderingStarted = false;
    abortRef.current = abortController;
    setQueueRunning(true);
    setQueueMessage(`Starting ${pendingItems.length} queued export${pendingItems.length === 1 ? '' : 's'}…`);
    setError(null);

    const requests = pendingItems.map((item) => ({
      id: item.id,
      sourceKey: item.sourceKey,
      settings: item.settings
    }));

    const run = async () => {
      const runtime = runtimeRef.current;
      try {
        const outcomes = await runReplayExportQueue(requests, {
          resolveSource: async (request, signal) => {
            const descriptor = queueSourcesRef.current.get(request.sourceKey);
            if (!descriptor) throw new Error('The queued replay source is no longer available.');
            if (descriptor.kind === 'replay') return descriptor.source;

            const cached = queuePreparedSourcesRef.current.get(request.sourceKey);
            if (cached) return cached;
            const currentPrepared = preparedSourceRef.current;
            if (currentPrepared?.key === descriptor.battleKey) {
              queuePreparedSourcesRef.current.set(request.sourceKey, currentPrepared.source);
              return currentPrepared.source;
            }

            const source = await generateSeedReplay(descriptor.battle, {
              ...(signal ? { signal } : {}),
              onProgress: (generationProgress) => {
                setQueueItems((current) => current.map((item) => item.id === request.id ? {
                  ...item,
                  status: 'preparing',
                  progress: 0,
                  message: `${generationProgress.message} ${Math.round(generationProgress.progress * 100)}%`
                } : item));
              }
            });
            queuePreparedSourcesRef.current.set(request.sourceKey, source);
            if (descriptor.battleKey === configuredBattleKey) {
              preparedSourceRef.current = { key: descriptor.battleKey, source };
              setPreparedSourceKey(descriptor.battleKey);
            }
            return source;
          },
          exportReplay: async (source, itemSettings, onProgress, signal) => {
            videoRenderingStarted = true;
            const itemId = activeItemId;
            const reliable = await exportReplayWithReliability(
              exporterRef.current,
              source,
              itemSettings,
              {
                onProgress,
                onAttempt: (attempt) => {
                  if (!itemId || attempt.kind === 'requested') return;
                  const label = attempt.kind === 'retry' ? 'Retrying encoder' : 'Trying safer fallback';
                  setQueueItems((current) => current.map((item) => item.id === itemId ? {
                    ...item,
                    status: 'preparing',
                    message: `${label}: ${attempt.settings.resolution} · ${attempt.settings.fps} FPS · ${attempt.settings.quality} · ${attempt.settings.format.toUpperCase()}`
                  } : item));
                }
              },
              signal
            );
            return reliable.result;
          },
          onItemStart: (request, index, total) => {
            activeItemId = request.id;
            setQueueMessage(`Exporting ${index + 1} of ${total}.`);
            setQueueItems((current) => current.map((item) => item.id === request.id ? {
              ...item,
              status: 'preparing',
              progress: 0,
              message: `Preparing export ${index + 1} of ${total}.`,
              error: null
            } : item));
          },
          onItemProgress: (request, itemProgress, index, total) => {
            setQueueMessage(`Exporting ${index + 1} of ${total} · ${Math.round(itemProgress.progress * 100)}%`);
            setQueueItems((current) => current.map((item) => item.id === request.id ? {
              ...item,
              status: 'rendering',
              progress: itemProgress.progress,
              message: itemProgress.message,
              encodedBytes: itemProgress.encodedBytes
            } : item));
          },
          onItemComplete: (request, result, index, total) => {
            const descriptor = queueSourcesRef.current.get(request.sourceKey);
            const files = createQueueFileSet(descriptor?.seed ?? 0, result);
            queueFilesRef.current.set(request.id, files);
            setQueueItems((current) => current.map((item) => item.id === request.id ? {
              ...item,
              status: 'complete',
              progress: 1,
              message: queueCompletionMessage(request.settings, result, index, total),
              filename: files.video.filename,
              thumbnailFilename: files.thumbnail?.filename ?? null,
              encodedBytes: result.encodedBytes,
              error: null
            } : item));
            setHistory(addReplayExportHistoryEntry(result, files.video.filename));
          },
          onItemError: (request, itemError) => {
            setQueueItems((current) => current.map((item) => item.id === request.id ? {
              ...item,
              status: 'error',
              message: itemError.message,
              error: itemError.message
            } : item));
          }
        }, abortController.signal);

        const completed = outcomes.filter((outcome) => outcome.status === 'complete').length;
        const failed = outcomes.length - completed;
        setQueueMessage(failed > 0
          ? `Queue finished: ${completed} completed, ${failed} failed.`
          : `Queue complete: ${completed} export${completed === 1 ? '' : 's'} ready to download.`);
      } catch (reason) {
        if (abortController.signal.aborted) {
          if (activeItemId) {
            setQueueItems((current) => current.map((item) => item.id === activeItemId && item.status !== 'complete' && item.status !== 'error'
              ? { ...item, status: 'cancelled', message: 'Cancelled. Retry when ready.', error: null }
              : item));
          }
          setQueueMessage('Export queue cancelled. Unstarted items remain queued.');
        } else {
          throw reason;
        }
      } finally {
        if (runtime && videoRenderingStarted) {
          const recoveryFailure = await recoverLiveRenderer(runtime);
          if (recoveryFailure) {
            const detail = recoveryFailure instanceof Error ? recoveryFailure.message : 'unknown renderer error';
            setError(`Export queue finished, but the battle renderer could not recover: ${detail}`);
          }
        }
      }
    };

    void run().catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : 'Export queue failed.';
      setError(message);
      setQueueMessage('Export queue stopped because of an unexpected error.');
    }).finally(() => {
      setQueueRunning(false);
      if (abortRef.current === abortController) abortRef.current = null;
    });
  }, [configuredBattleKey, queueItems, running, runtimeRef]);

  const start = useCallback((requestedMode?: ReplayVideoSourceMode) => {
    if (running || abortRef.current) return;
    const activeSourceMode = requestedMode ?? sourceMode;
    if (!capability?.supported) {
      setError(capability?.reason ?? 'Video export support is still being checked.');
      return;
    }

    const abortController = new AbortController();
    let videoRenderingStarted = false;
    abortRef.current = abortController;
    setError(null);
    setSeedProgress(null);
    directFilesRef.current = null;
    setDirectDownload(INITIAL_DIRECT_DOWNLOAD);
    setProgress(INITIAL_PROGRESS);

    const run = async () => {
      const runtime = runtimeRef.current;
      let source: ReplayExportSource;

      if (activeSourceMode === 'setup-seed') {
        const cached = preparedSourceRef.current;
        const queuedCached = queuePreparedSourcesRef.current.get(`setup:${configuredBattleKey}`);
        if (cached?.key === configuredBattleKey) {
          source = cached.source;
        } else if (queuedCached) {
          source = queuedCached;
          preparedSourceRef.current = { key: configuredBattleKey, source };
          setPreparedSourceKey(configuredBattleKey);
        } else {
          setPreparingReplay(true);
          try {
            source = await generateSeedReplay(configuredBattle, {
              signal: abortController.signal,
              onProgress: setSeedProgress
            });
            preparedSourceRef.current = { key: configuredBattleKey, source };
            queuePreparedSourcesRef.current.set(`setup:${configuredBattleKey}`, source);
            setPreparedSourceKey(configuredBattleKey);
          } finally {
            setPreparingReplay(false);
          }
        }
      } else {
        if (!runtime) throw new Error('The battle runtime is not ready yet.');
        source = runtime.createReplayExportSource();
        if (!source.battleEnded) {
          throw new Error('The current arena battle is still recording. Wait for the result before exporting this replay, or use Setup + seed to generate a separate completed battle.');
        }
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
        message: activeSourceMode === 'setup-seed'
          ? 'Generated replay ready. Preparing the dedicated video and audio renderer.'
          : 'Completed arena replay ready. Preparing the dedicated video and audio renderer.'
      });

      videoRenderingStarted = true;
      const reliable = await exportReplayWithReliability(
        exporterRef.current,
        source,
        exportSettings,
        {
          onProgress: setProgress,
          onAttempt: (attempt) => {
            if (attempt.kind === 'requested') return;
            const action = attempt.kind === 'retry' ? 'Retrying the encoder' : 'Recovering with safer export settings';
            setProgress((current) => ({
              ...current,
              phase: 'preparing',
              progress: 0,
              renderedFrames: 0,
              encodedBytes: 0,
              estimatedRemainingMs: null,
              message: `${action}: ${attempt.settings.resolution} · ${attempt.settings.fps} FPS · ${attempt.settings.quality} · ${attempt.settings.format.toUpperCase()}.`
            }));
          }
        },
        abortController.signal
      );
      const result = reliable.result;
      const files = createQueueFileSet(source.replay.battle.seed, result);
      directFilesRef.current = files;
      setDirectDownload({
        status: 'ready',
        filename: files.video.filename,
        thumbnailFilename: files.thumbnail?.filename ?? null,
        encodedBytes: files.video.blob.size,
        message: autoDownloadEnabled
          ? 'Export file ready. Preparing browser download…'
          : 'Export complete. Ready for manual download.'
      });
      setHistory(addReplayExportHistoryEntry(result, files.video.filename));

      let downloadAccepted: boolean | null = null;
      if (autoDownloadEnabled) {
        setProgress((current) => ({
          ...current,
          phase: 'downloading',
          progress: 1,
          estimatedRemainingMs: null,
          message: 'Encoding complete. Sending the finished file to the browser download manager.'
        }));
        downloadAccepted = await handoffDirectDownload(files);
      }
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
        message: [
          reliable.notice,
          autoDownloadEnabled
            ? downloadAccepted
              ? 'Export complete. Download was handed to the browser.'
              : 'Export complete. Use Download video to save the file manually.'
            : 'Export complete. File is ready for manual download.',
          runtime ? 'Battle renderer restored.' : null
        ].filter(Boolean).join(' ')
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
  }, [autoDownloadEnabled, capability, configuredBattle, configuredBattleKey, exportSettings, handoffDirectDownload, running, runtimeRef, sourceMode]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    capability,
    deviceProfile,
    memoryForecast,
    progress,
    seedProgress,
    batchProgress,
    batchSearching,
    batchSize,
    batchResults,
    queueItems,
    queueRunning,
    queuePackaging,
    queueMessage,
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
    cameraShakeEnabled,
    screenFlashEnabled,
    preset,
    introEnabled,
    highlightsEnabled,
    captionsEnabled,
    thumbnailEnabled,
    autoDownloadEnabled,
    directDownload,
    history,
    setSourceMode,
    setGenerationSeedText,
    randomizeSeed,
    reuseCurrentSeed,
    setBatchSize,
    searchSeeds,
    selectRankedSeed,
    addToQueue,
    queueTopRankedSeeds,
    startQueue,
    removeQueueItem,
    retryQueueItem,
    downloadQueueItem,
    downloadQueueArchive,
    clearQueue,
    setFormat,
    setLayout,
    setResolution,
    setFps,
    setQuality,
    setAudioEnabled,
    setCameraMode,
    setCameraShakeEnabled,
    setScreenFlashEnabled,
    applyPreset,
    setIntroEnabled,
    setHighlightsEnabled,
    setCaptionsEnabled,
    setThumbnailEnabled,
    setAutoDownloadEnabled,
    downloadLatest,
    downloadLatestThumbnail,
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


function queueCompletionMessage(
  requested: ReplayVideoExportSettings,
  result: ReplayVideoExportResult,
  index: number,
  total: number
): string {
  const explicitContainerChanged = requested.format !== 'auto' && requested.format !== result.container;
  const recovered = requested.resolution !== result.resolution
    || requested.fps !== result.fps
    || requested.quality !== result.quality
    || explicitContainerChanged;
  return recovered
    ? `Completed ${index + 1} of ${total} with reliability fallback: ${result.resolution} · ${result.fps} FPS · ${result.quality} · ${result.container.toUpperCase()}.`
    : `Completed ${index + 1} of ${total}.`;
}

function generateRandomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

function hashReplayData(replay: ReplayExportSource['replay']): string {
  const text = JSON.stringify(replay);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createQueueFileSet(seed: number, result: ReplayVideoExportResult): ReplayQueueFileSet {
  const audioSuffix = result.audioCodec ? '-audio' : '-silent';
  const baseName = `kinetic-battle-${seed >>> 0}-${result.layout}-${result.cameraMode}-${result.resolution}-${result.fps}fps${audioSuffix}`;
  const extension = result.container === 'mp4' ? 'mp4' : 'webm';
  return {
    video: { filename: `${baseName}.${extension}`, blob: result.blob },
    thumbnail: result.thumbnailBlob ? { filename: `${baseName}-thumbnail.png`, blob: result.thumbnailBlob } : null
  };
}

function createArchiveFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `kinetic-battle-exports-${stamp}.zip`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Large Blob downloads can be claimed by the browser download manager after
  // the click task has returned. Revoking too aggressively can race that handoff.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function readAutoDownloadPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(AUTO_DOWNLOAD_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeAutoDownloadPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage can be unavailable in private/sandboxed contexts; keep the in-memory preference.
  }
}

function waitForBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}
