import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppSettings } from '@kinetic/platform';
import {
  ReplayVideoExporter,
  createStage810aExportSettings,
  detectVideoExportCapability,
  type ReplayExportSource,
  type ReplayVideoExportProgress,
  type VideoExportCapability
} from '@kinetic/video-export';
import type { BattleRuntime } from '../runtime/BattleRuntime';

export interface ReplayVideoExportController {
  capability: VideoExportCapability | null;
  progress: ReplayVideoExportProgress;
  running: boolean;
  error: string | null;
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
  message: 'Ready to export the current replay as 1080p60 WebM.'
};

export function useReplayVideoExport(
  runtimeRef: RefObject<BattleRuntime | null>,
  settings: AppSettings
): ReplayVideoExportController {
  const exportSettings = useMemo(() => createStage810aExportSettings(settings), [settings]);
  const exporterRef = useRef(new ReplayVideoExporter());
  const abortRef = useRef<AbortController | null>(null);
  const [capability, setCapability] = useState<VideoExportCapability | null>(null);
  const [progress, setProgress] = useState<ReplayVideoExportProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const running = progress.phase === 'preparing'
    || progress.phase === 'rendering'
    || progress.phase === 'muxing';

  useEffect(() => {
    let cancelled = false;
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
    setProgress({
      ...INITIAL_PROGRESS,
      phase: 'preparing',
      totalFrames: source.endTick,
      message: 'Preparing the dedicated video renderer.'
    });

    void exporterRef.current.export(
      source,
      exportSettings,
      { onProgress: setProgress },
      abortController.signal
    ).then((result) => {
      downloadBlob(result.blob, `kinetic-battle-${source.replay.battle.seed}-1080p60.webm`);
    }).catch((reason: unknown) => {
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

  return { capability, progress, running, error, start, cancel };
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
