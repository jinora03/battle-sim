import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createReplayExportArchive,
  runReplayExportQueue,
  type ReplayExportSource,
  type ReplayVideoExportProgress,
  type ReplayVideoExportResult,
  type ReplayVideoExportSettings
} from '@kinetic/video-export';

const settings = {} as ReplayVideoExportSettings;
const source = {} as ReplayExportSource;
const idleProgress: ReplayVideoExportProgress = {
  phase: 'rendering',
  renderedFrames: 1,
  totalFrames: 2,
  progress: 0.5,
  elapsedMs: 10,
  estimatedRemainingMs: 10,
  encodedBytes: 128,
  message: 'Rendering.'
};

describe('Stage 8.11D export queue and batch download', () => {
  it('encodes queued outputs sequentially and reuses one resolved replay per source key', async () => {
    let activeEncodes = 0;
    let maxActiveEncodes = 0;
    let sourceResolutions = 0;
    const order: string[] = [];

    const outcomes = await runReplayExportQueue([
      { id: 'vertical', sourceKey: 'seed-123', settings },
      { id: 'landscape', sourceKey: 'seed-123', settings },
      { id: 'webm', sourceKey: 'seed-123', settings }
    ], {
      resolveSource: async () => {
        sourceResolutions += 1;
        return source;
      },
      exportReplay: async (_source, _settings, onProgress) => {
        activeEncodes += 1;
        maxActiveEncodes = Math.max(maxActiveEncodes, activeEncodes);
        onProgress(idleProgress);
        order.push(`start-${order.length}`);
        await Promise.resolve();
        activeEncodes -= 1;
        return createFakeResult();
      }
    });

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['complete', 'complete', 'complete']);
    expect(sourceResolutions).toBe(1);
    expect(maxActiveEncodes).toBe(1);
    expect(order).toHaveLength(3);
  });

  it('caches each unique replay independently while allowing mixed queued sources', async () => {
    const resolved: string[] = [];
    await runReplayExportQueue([
      { id: 'a1', sourceKey: 'seed-a', settings },
      { id: 'b1', sourceKey: 'seed-b', settings },
      { id: 'a2', sourceKey: 'seed-a', settings }
    ], {
      resolveSource: async (request) => {
        resolved.push(request.sourceKey);
        return source;
      },
      exportReplay: async () => createFakeResult()
    });

    expect(resolved).toEqual(['seed-a', 'seed-b']);
  });

  it('keeps a failed queue item isolated and continues with later exports', async () => {
    let attempt = 0;
    const outcomes = await runReplayExportQueue([
      { id: 'bad', sourceKey: 'seed-1', settings },
      { id: 'good', sourceKey: 'seed-1', settings }
    ], {
      resolveSource: async () => source,
      exportReplay: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('Synthetic encoder failure.');
        return createFakeResult();
      }
    });

    expect(outcomes[0]).toMatchObject({ id: 'bad', status: 'error' });
    expect(outcomes[1]).toMatchObject({ id: 'good', status: 'complete' });
  });

  it('cancels the active queue without starting later queued encodes', async () => {
    const abort = new AbortController();
    let encodesStarted = 0;

    await expect(runReplayExportQueue([
      { id: 'first', sourceKey: 'seed-1', settings },
      { id: 'second', sourceKey: 'seed-1', settings }
    ], {
      resolveSource: async () => source,
      exportReplay: async (_source, _settings, onProgress, signal) => {
        encodesStarted += 1;
        onProgress(idleProgress);
        abort.abort();
        if (signal?.aborted) throw new Error('cancelled by test');
        return createFakeResult();
      }
    }, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });

    expect(encodesStarted).toBe(1);
  });

  it('packages multiple completed blobs into a standard dependency-free ZIP', async () => {
    const archive = await createReplayExportArchive([
      { filename: 'battle-a.mp4', blob: new Blob(['video-a']), modifiedAt: new Date('2026-08-08T00:00:00Z') },
      { filename: 'battle-b.webm', blob: new Blob(['video-b']), modifiedAt: new Date('2026-08-08T00:00:00Z') },
      { filename: 'battle-a.mp4', blob: new Blob(['duplicate-name']), modifiedAt: new Date('2026-08-08T00:00:00Z') }
    ]);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = new TextDecoder().decode(bytes);

    expect(archive.type).toBe('application/zip');
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(findSignature(bytes, 0x02014b50)).toBeGreaterThan(0);
    expect(text).toContain('battle-a.mp4');
    expect(text).toContain('battle-b.webm');
    expect(text).toContain('battle-a-2.mp4');
  });

  it('keeps queue orchestration outside simulation and snapshots current export settings', () => {
    const queue = readFileSync(new URL('../packages/video-export/src/exportQueue.ts', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(queue).toContain('const sourceCache = new Map<string, ReplayExportSource>();');
    expect(queue).not.toContain('@kinetic/simulation');
    expect(queue).not.toContain('LocalSimulationRunner');
    expect(hook).toContain('const settingsSnapshot = structuredClone(exportSettings);');
    expect(hook).toContain('const MAX_EXPORT_QUEUE_ITEMS = 8;');
    expect(hook).toContain('queuePreparedSourcesRef.current');
    expect(hook).toContain('const replayHash = hashReplayData(source.replay);');
  });

  it('stores queue results for explicit individual/ZIP download instead of auto-downloading every queue item', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(hook).toContain('queueFilesRef.current.set(request.id, files);');
    expect(hook).toContain('const downloadQueueItem = useCallback');
    expect(hook).toContain('const downloadQueueArchive = useCallback');
    expect(hook).toContain('createReplayExportArchive(archiveEntries');
    expect(panel).toContain('Add current settings');
    expect(panel).toContain('Run queue');
    expect(panel).toContain('Download ZIP');
    expect(panel).toContain('Queue top 3 for export');
    expect(panel).toContain('queueItems.map');
  });

  it('preserves the existing direct single-export path alongside the queue', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    expect(hook).toContain('const start = useCallback((requestedMode?: ReplayVideoSourceMode) => {'); 
    expect(hook).toContain('const activeSourceMode = requestedMode ?? sourceMode;');
    expect(hook).toContain('downloadBlob(files.video.blob, files.video.filename);');
    expect(hook).toContain('startQueue,');
  });
});

function createFakeResult(): ReplayVideoExportResult {
  return {
    blob: new Blob(['video']),
    container: 'webm',
    codec: 'vp9',
    audioCodec: 'opus',
    mimeType: 'video/webm',
    width: 1920,
    height: 1080,
    fps: 60,
    frameCount: 120,
    durationSeconds: 2,
    encodedBytes: 5,
    sourceChecksum: 'queue-test',
    layout: 'landscape',
    resolution: '1080p',
    quality: 'high',
    cameraMode: 'cinematic',
    creatorPreset: 'youtube',
    summary: {
      winnerName: 'Pyro',
      winningTeam: 1,
      durationSeconds: 2,
      remainingHp: 500,
      remainingHpRatio: 0.5,
      largestHit: null,
      topAbility: null,
      highlight: null
    },
    thumbnailBlob: null,
    thumbnailWidth: null,
    thumbnailHeight: null
  };
}

function findSignature(bytes: Uint8Array, signature: number): number {
  for (let index = 0; index <= bytes.length - 4; index += 1) {
    const value = bytes[index]! | (bytes[index + 1]! << 8) | (bytes[index + 2]! << 16) | (bytes[index + 3]! << 24);
    if ((value >>> 0) === signature) return index;
  }
  return -1;
}
