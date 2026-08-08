import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ReplayVideoExportError,
  buildVideoExportFallbacks,
  calculateReliabilityFrameCount,
  createStage810hExportSettings,
  exportReplayWithReliability,
  forecastVideoExportMemory,
  reconfigureReplayVideoExportSettings,
  type ReplayExportSource,
  type ReplayVideoExportProgress,
  type ReplayVideoExportResult,
  type ReplayVideoExporterCallbacks,
  type ReplayVideoExportSettings
} from '@kinetic/video-export';

const originalVideoEncoder = globalThis.VideoEncoder;
const originalVideoFrame = globalThis.VideoFrame;

const progress = (value: number): ReplayVideoExportProgress => ({
  phase: 'rendering',
  renderedFrames: Math.round(value * 100),
  totalFrames: 100,
  progress: value,
  elapsedMs: 100,
  estimatedRemainingMs: 100,
  encodedBytes: 1024,
  message: 'Rendering.'
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'VideoEncoder', { configurable: true, writable: true, value: originalVideoEncoder });
  Object.defineProperty(globalThis, 'VideoFrame', { configurable: true, writable: true, value: originalVideoFrame });
});

describe('Stage 8.11E export reliability', () => {
  it('forecasts encoded, render-surface and offline-audio working memory before export', () => {
    const settings = createStage810hExportSettings({}, {
      resolution: '4k', fps: 60, quality: 'maximum', audio: true, camera: 'cinematic'
    });
    const frames = calculateReliabilityFrameCount({ endTick: 3600, battleEnded: true }, settings);
    const lowMemory = forecastVideoExportMemory(settings, frames, {
      deviceMemoryGiB: 2,
      hardwareConcurrency: 4,
      mobileLike: true,
      webCodecs: true,
      offlineAudio: true
    });
    const roomy = forecastVideoExportMemory(settings, frames, {
      deviceMemoryGiB: 16,
      hardwareConcurrency: 16,
      mobileLike: false,
      webCodecs: true,
      offlineAudio: true
    });

    expect(lowMemory.encodedBytes).toBeGreaterThan(0);
    expect(lowMemory.renderSurfaceBytes).toBeGreaterThan(100 * 1024 * 1024);
    expect(lowMemory.audioWorkingBytes).toBeGreaterThan(0);
    expect(lowMemory.estimatedPeakBytes).toBeGreaterThan(lowMemory.encodedBytes);
    expect(lowMemory.risk).toBe('high');
    expect(roomy.estimatedPeakBytes).toBe(lowMemory.estimatedPeakBytes);
    expect(roomy.deviceBudgetBytes).toBeGreaterThan(lowMemory.deviceBudgetBytes!);
  });

  it('reconfigures quality, fps and resolution with matching bitrate/canvas settings', () => {
    const original = createStage810hExportSettings({}, {
      resolution: '4k', fps: 60, quality: 'maximum', audio: true
    });
    const safer = reconfigureReplayVideoExportSettings(original, {
      resolution: '1080p', fps: 30, quality: 'balanced', format: 'auto'
    });

    expect(safer.width).toBe(original.width / 2);
    expect(safer.height).toBe(original.height / 2);
    expect(safer.fps).toBe(30);
    expect(safer.quality).toBe('balanced');
    expect(safer.bitrate).toBeLessThan(original.bitrate);
    expect(safer.audio.bitrate).toBeLessThan(original.audio.bitrate);
    expect(safer.presentation.targetRenderFps).toBe(30);
  });

  it('builds ordered codec/quality/fps/resolution fallbacks without mutating creator presentation', () => {
    const requested = createStage810hExportSettings({}, {
      format: 'mp4', resolution: '4k', fps: 60, quality: 'maximum', audio: true, camera: 'cinematic'
    });
    const fallbacks = buildVideoExportFallbacks(requested);

    expect(fallbacks.length).toBeGreaterThanOrEqual(5);
    expect(fallbacks[0]).toMatchObject({ format: 'webm', resolution: '4k', fps: 60, quality: 'maximum' });
    expect(fallbacks.some((item) => item.quality === 'balanced')).toBe(true);
    expect(fallbacks.some((item) => item.fps === 30)).toBe(true);
    expect(fallbacks.some((item) => item.resolution === '1080p')).toBe(true);
    expect(fallbacks.at(-1)?.audio.enabled).toBe(false);
    expect(fallbacks.every((item) => item.layout === requested.layout)).toBe(true);
    expect(fallbacks.every((item) => item.camera.mode === requested.camera.mode)).toBe(true);
    expect(fallbacks.every((item) => item.creator.introSeconds === requested.creator.introSeconds)).toBe(true);
  });

  it('retries an early transient encoder failure once without changing the requested settings', async () => {
    installWebmCapabilityStub();
    const settings = createStage810hExportSettings({}, { format: 'webm', audio: false });
    const attempts: string[] = [];
    let exports = 0;
    const exporter = {
      export: async (_source: ReplayExportSource, active: ReplayVideoExportSettings, callbacks?: ReplayVideoExporterCallbacks) => {
        exports += 1;
        callbacks?.onProgress?.(progress(0.1));
        if (exports === 1) throw new ReplayVideoExportError('Synthetic driver reset.', 'encoder-failure');
        return fakeResult(active);
      }
    };

    const recovered = await exportReplayWithReliability(exporter, {} as ReplayExportSource, settings, {
      onAttempt: (attempt) => attempts.push(attempt.kind)
    });

    expect(exports).toBe(2);
    expect(attempts).toEqual(['requested', 'retry']);
    expect(recovered.fallbackApplied).toBe(false);
    expect(recovered.notice).toContain('recovered after retrying');
  });

  it('does not repeat most of a long failed export and moves directly to safer settings', async () => {
    installWebmCapabilityStub();
    const settings = createStage810hExportSettings({}, { format: 'webm', quality: 'maximum', audio: false });
    const seen: ReplayVideoExportSettings[] = [];
    const kinds: string[] = [];
    const exporter = {
      export: async (_source: ReplayExportSource, active: ReplayVideoExportSettings, callbacks?: ReplayVideoExporterCallbacks) => {
        seen.push(active);
        callbacks?.onProgress?.(progress(seen.length === 1 ? 0.72 : 0.1));
        if (seen.length === 1) throw new ReplayVideoExportError('Synthetic late encoder failure.', 'encoder-failure');
        return fakeResult(active);
      }
    };

    const recovered = await exportReplayWithReliability(exporter, {} as ReplayExportSource, settings, {
      onAttempt: (attempt) => kinds.push(attempt.kind)
    });

    expect(seen).toHaveLength(2);
    expect(kinds).toEqual(['requested', 'fallback']);
    expect(recovered.fallbackApplied).toBe(true);
    expect(recovered.effectiveSettings.format).toBe('mp4');
  });

  it('never retries cancellation or deterministic replay/source errors', async () => {
    installWebmCapabilityStub();
    const settings = createStage810hExportSettings({}, { format: 'webm', audio: false });
    for (const code of ['cancelled', 'invalid-source', 'duration-limit'] as const) {
      let attempts = 0;
      const exporter = {
        export: async () => {
          attempts += 1;
          throw new ReplayVideoExportError(`Synthetic ${code}.`, code);
        }
      };
      await expect(exportReplayWithReliability(exporter, {} as ReplayExportSource, settings)).rejects.toMatchObject({ code });
      expect(attempts).toBe(1);
    }
  });

  it('keeps reliability around the exporter and never mutates simulation/replay generation', () => {
    const reliability = readFileSync(new URL('../packages/video-export/src/exportReliability.ts', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(reliability).not.toContain('@kinetic/simulation');
    expect(reliability).not.toContain('LocalSimulationRunner');
    expect(reliability).not.toContain('ReplayRecorder');
    expect(hook).toContain('exportReplayWithReliability');
    expect(hook).toContain('queueCompletionMessage');
    expect(panel).toContain('Memory forecast');
    expect(panel).toContain('Device budget');
    expect(panel).toContain('failed encodes can automatically retry or fall back without resimulating');
  });
});

function installWebmCapabilityStub(): void {
  class FakeVideoEncoder {
    static async isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> {
      return { supported: true, config };
    }
  }
  class FakeVideoFrame {}
  Object.defineProperty(globalThis, 'VideoEncoder', { configurable: true, writable: true, value: FakeVideoEncoder });
  Object.defineProperty(globalThis, 'VideoFrame', { configurable: true, writable: true, value: FakeVideoFrame });
}

function fakeResult(settings: ReplayVideoExportSettings): ReplayVideoExportResult {
  const container = settings.format === 'mp4' ? 'mp4' : 'webm';
  return {
    blob: new Blob(['recovered-video']),
    container,
    codec: container === 'mp4' ? 'h264' : 'vp9',
    audioCodec: settings.audio.enabled ? (container === 'mp4' ? 'aac' : 'opus') : null,
    mimeType: container === 'mp4' ? 'video/mp4' : 'video/webm',
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    frameCount: 120,
    durationSeconds: 2,
    encodedBytes: 15,
    sourceChecksum: 'stage8-11e',
    layout: settings.layout,
    resolution: settings.resolution,
    quality: settings.quality,
    cameraMode: settings.camera.mode,
    creatorPreset: settings.creator.preset,
    summary: {
      winnerName: 'Pyro', winningTeam: 1, durationSeconds: 2, remainingHp: 500, remainingHpRatio: 0.5,
      largestHit: null, topAbility: null, highlight: null
    },
    thumbnailBlob: null,
    thumbnailWidth: null,
    thumbnailHeight: null
  };
}
