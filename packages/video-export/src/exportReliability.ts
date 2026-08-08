import { detectVideoExportCapability } from './webCodecs';
import {
  calculateCreatorIntroFrameCount,
  calculateKnockoutSlowMotionFrameCount,
  calculateReplayFrameCount,
  estimateEncodedBytes,
  formatBytes,
  reconfigureReplayVideoExportSettings
} from './settings';
import {
  ReplayVideoExportError,
  type ReplayExportSource,
  type ReplayVideoExporterCallbacks,
  type ReplayVideoExportResult,
  type ReplayVideoExportSettings,
  type VideoExportCapability
} from './types';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const MAX_TRANSIENT_RETRIES = 1;
const RENDER_SURFACE_COUNT = 4;
const CINEMATIC_RENDER_SURFACE_COUNT = 5;

export type VideoExportReliabilityRisk = 'low' | 'moderate' | 'high';

export interface VideoExportDeviceProfile {
  deviceMemoryGiB: number | null;
  hardwareConcurrency: number | null;
  mobileLike: boolean;
  webCodecs: boolean;
  offlineAudio: boolean;
}

export interface VideoExportMemoryForecast {
  frameCount: number;
  durationSeconds: number;
  encodedBytes: number;
  renderSurfaceBytes: number;
  audioWorkingBytes: number;
  estimatedPeakBytes: number;
  deviceBudgetBytes: number | null;
  risk: VideoExportReliabilityRisk;
  notice: string;
}

export interface VideoExportReliabilityAssessment {
  capability: VideoExportCapability;
  device: VideoExportDeviceProfile;
  memory: VideoExportMemoryForecast;
}

export interface ReplayVideoReliabilityAttempt {
  index: number;
  settings: ReplayVideoExportSettings;
  kind: 'requested' | 'retry' | 'fallback';
  reason: string | null;
}

export interface ReliableReplayVideoExportResult {
  result: ReplayVideoExportResult;
  requestedSettings: ReplayVideoExportSettings;
  effectiveSettings: ReplayVideoExportSettings;
  attempts: readonly ReplayVideoReliabilityAttempt[];
  fallbackApplied: boolean;
  notice: string | null;
}

export interface ReliableReplayVideoExportCallbacks extends ReplayVideoExporterCallbacks {
  onAttempt?(attempt: ReplayVideoReliabilityAttempt): void;
}

export interface ReliableReplayVideoExporter {
  export(
    source: ReplayExportSource,
    settings: ReplayVideoExportSettings,
    callbacks?: ReplayVideoExporterCallbacks,
    signal?: AbortSignal
  ): Promise<ReplayVideoExportResult>;
}

export function detectVideoExportDeviceProfile(): VideoExportDeviceProfile {
  const globalNavigator = typeof navigator === 'undefined' ? null : navigator;
  const memory = globalNavigator
    ? (globalNavigator as Navigator & { deviceMemory?: number }).deviceMemory
    : undefined;
  const userAgent = globalNavigator?.userAgent ?? '';
  return {
    deviceMemoryGiB: typeof memory === 'number' && Number.isFinite(memory) && memory > 0 ? memory : null,
    hardwareConcurrency: typeof globalNavigator?.hardwareConcurrency === 'number' && globalNavigator.hardwareConcurrency > 0
      ? globalNavigator.hardwareConcurrency
      : null,
    mobileLike: /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent),
    webCodecs: typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined',
    offlineAudio: typeof OfflineAudioContext !== 'undefined'
  };
}

export function calculateReliabilityFrameCount(
  source: Pick<ReplayExportSource, 'endTick' | 'battleEnded'>,
  settings: ReplayVideoExportSettings
): number {
  const replayFrames = calculateReplayFrameCount(source.endTick, settings.fps);
  const introFrames = calculateCreatorIntroFrameCount(settings);
  const knockoutFrames = calculateKnockoutSlowMotionFrameCount(settings, source.battleEnded);
  const resultFrames = source.battleEnded ? Math.round(settings.resultHoldSeconds * settings.fps) : 0;
  const highlightFrames = settings.camera.mode === 'cinematic'
    ? Math.max(0, settings.camera.maxHighlightSlowMotionMoments)
      * Math.max(0, Math.round(settings.camera.highlightSlowMotionSeconds * settings.fps))
    : 0;
  return replayFrames + introFrames + knockoutFrames + resultFrames + highlightFrames;
}

export function forecastVideoExportMemory(
  settings: ReplayVideoExportSettings,
  frameCount: number,
  device: VideoExportDeviceProfile = detectVideoExportDeviceProfile()
): VideoExportMemoryForecast {
  const safeFrameCount = Math.max(1, Math.floor(frameCount));
  const durationSeconds = safeFrameCount / settings.fps;
  const encodedBytes = estimateEncodedBytes(settings, safeFrameCount);
  const surfaceCount = settings.camera.mode === 'cinematic' ? CINEMATIC_RENDER_SURFACE_COUNT : RENDER_SURFACE_COUNT;
  const renderSurfaceBytes = settings.width * settings.height * 4 * surfaceCount;
  const audioWorkingBytes = settings.audio.enabled
    ? Math.ceil(durationSeconds * settings.audio.sampleRate * settings.audio.channels * 4 * 1.35)
    : 0;
  // Muxers retain encoded samples until finalize. Include JS/object overhead and
  // temporary encoder/output buffers instead of pretending encoded size is the
  // entire peak working set.
  const estimatedPeakBytes = Math.ceil(encodedBytes * 1.35 + renderSurfaceBytes + audioWorkingBytes + 32 * MIB);
  const deviceBudgetBytes = device.deviceMemoryGiB === null
    ? null
    : Math.min(1.5 * GIB, Math.max(256 * MIB, device.deviceMemoryGiB * GIB * 0.28));
  const encodedPressure = encodedBytes / Math.max(1, settings.maxEncodedBytes);
  const devicePressure = deviceBudgetBytes === null ? 0 : estimatedPeakBytes / deviceBudgetBytes;
  const risk: VideoExportReliabilityRisk = encodedPressure >= 0.8 || devicePressure >= 1
    ? 'high'
    : encodedPressure >= 0.55 || devicePressure >= 0.7 || (settings.resolution === '4k' && settings.fps === 60)
      ? 'moderate'
      : 'low';
  const budgetLabel = deviceBudgetBytes === null ? null : formatBytes(deviceBudgetBytes);
  const notice = risk === 'high'
    ? `High memory pressure: about ${formatBytes(estimatedPeakBytes)} peak${budgetLabel ? ` against a ${budgetLabel} device budget` : ''}. Automatic fallback is enabled.`
    : risk === 'moderate'
      ? `Moderate export load: about ${formatBytes(estimatedPeakBytes)} peak${budgetLabel ? ` within a ${budgetLabel} device budget` : ''}.`
      : `Estimated peak memory ${formatBytes(estimatedPeakBytes)}.`;
  return {
    frameCount: safeFrameCount,
    durationSeconds,
    encodedBytes,
    renderSurfaceBytes,
    audioWorkingBytes,
    estimatedPeakBytes,
    deviceBudgetBytes,
    risk,
    notice
  };
}

export async function assessVideoExportReliability(
  settings: ReplayVideoExportSettings,
  frameCount: number,
  device: VideoExportDeviceProfile = detectVideoExportDeviceProfile()
): Promise<VideoExportReliabilityAssessment> {
  const capability = await detectReliableVideoExportCapability(settings);
  return {
    capability,
    device,
    memory: forecastVideoExportMemory(settings, frameCount, device)
  };
}

export async function detectReliableVideoExportCapability(
  settings: ReplayVideoExportSettings
): Promise<VideoExportCapability> {
  const requested = await detectVideoExportCapability(settings);
  if (requested.supported) return requested;

  for (const fallbackSettings of buildVideoExportFallbacks(settings)) {
    const fallback = await detectVideoExportCapability(fallbackSettings);
    if (!fallback.supported) continue;
    return {
      ...fallback,
      requestedFormat: settings.format,
      fallback: true,
      notice: `Requested settings are unavailable on this browser. Reliability fallback will use ${describeReliabilitySettings(fallbackSettings)}.`,
      reason: null
    };
  }
  return requested;
}

/**
 * Returns progressively safer settings. The requested settings are intentionally
 * not included because the caller attempts them first. No fallback changes the
 * replay, camera mode, creator cards, layout, or deterministic audio content.
 */
export function buildVideoExportFallbacks(settings: ReplayVideoExportSettings): ReplayVideoExportSettings[] {
  const candidates: ReplayVideoExportSettings[] = [];
  const alternateFormat = settings.format === 'webm' ? 'mp4' : 'webm';
  const push = (next: ReplayVideoExportSettings) => {
    const key = reliabilitySettingsKey(next);
    if (key === reliabilitySettingsKey(settings)) return;
    if (candidates.some((candidate) => reliabilitySettingsKey(candidate) === key)) return;
    candidates.push(next);
  };

  // Force the alternate container first. Auto normally prefers MP4, so merely
  // changing MP4 -> Auto would keep retrying the same H.264 path after a
  // mid-encode driver failure instead of actually testing WebM.
  push(reconfigureReplayVideoExportSettings(settings, { format: alternateFormat }));

  if (settings.quality === 'maximum') {
    push(reconfigureReplayVideoExportSettings(settings, { quality: 'high' }));
    push(reconfigureReplayVideoExportSettings(settings, { format: alternateFormat, quality: 'high' }));
  }
  if (settings.quality !== 'balanced') {
    push(reconfigureReplayVideoExportSettings(settings, { quality: 'balanced' }));
    push(reconfigureReplayVideoExportSettings(settings, { format: alternateFormat, quality: 'balanced' }));
  }
  if (settings.fps === 60) {
    const saferQuality = settings.quality === 'maximum' ? 'high' : settings.quality;
    push(reconfigureReplayVideoExportSettings(settings, { fps: 30, quality: saferQuality }));
    push(reconfigureReplayVideoExportSettings(settings, { format: alternateFormat, fps: 30, quality: 'balanced' }));
  }
  if (settings.resolution === '4k') {
    push(reconfigureReplayVideoExportSettings(settings, { resolution: '1080p', quality: 'high' }));
    push(reconfigureReplayVideoExportSettings(settings, {
      format: alternateFormat,
      resolution: '1080p',
      fps: 30,
      quality: 'balanced'
    }));
  }

  // Audio encoder support varies separately from video. Keep this last so a
  // requested deterministic-audio export is only made silent as a final rescue.
  if (settings.audio.enabled) {
    push(reconfigureReplayVideoExportSettings(settings, {
      format: alternateFormat,
      resolution: settings.resolution === '4k' ? '1080p' : settings.resolution,
      fps: settings.fps === 60 ? 30 : settings.fps,
      quality: 'balanced',
      audio: false
    }));
  }
  return candidates;
}

export async function exportReplayWithReliability(
  exporter: ReliableReplayVideoExporter,
  source: ReplayExportSource,
  requestedSettings: ReplayVideoExportSettings,
  callbacks: ReliableReplayVideoExportCallbacks = {},
  signal?: AbortSignal
): Promise<ReliableReplayVideoExportResult> {
  const candidates = [requestedSettings, ...buildVideoExportFallbacks(requestedSettings)];
  const attempts: ReplayVideoReliabilityAttempt[] = [];
  let lastFailure: Error | null = null;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const settings = candidates[candidateIndex]!;
    throwIfCancelled(signal);
    const capability = await detectVideoExportCapability(settings);
    if (!capability.supported) {
      const reason = capability.reason ?? 'The browser rejected this encoder configuration.';
      attempts.push({ index: attempts.length + 1, settings, kind: candidateIndex === 0 ? 'requested' : 'fallback', reason });
      callbacks.onAttempt?.(attempts.at(-1)!);
      lastFailure = new ReplayVideoExportError(reason, 'unsupported');
      continue;
    }

    let transientRetry = 0;
    while (true) {
      const kind: ReplayVideoReliabilityAttempt['kind'] = candidateIndex === 0 && transientRetry === 0
        ? 'requested'
        : transientRetry > 0
          ? 'retry'
          : 'fallback';
      const attempt: ReplayVideoReliabilityAttempt = {
        index: attempts.length + 1,
        settings,
        kind,
        reason: lastFailure?.message ?? null
      };
      attempts.push(attempt);
      callbacks.onAttempt?.(attempt);

      let attemptProgress = 0;
      try {
        const result = await exporter.export(source, settings, {
          onProgress: (progress) => {
            attemptProgress = Math.max(attemptProgress, progress.progress);
            callbacks.onProgress?.(progress);
          }
        }, signal);
        const fallbackApplied = reliabilitySettingsKey(settings) !== reliabilitySettingsKey(requestedSettings);
        return {
          result,
          requestedSettings,
          effectiveSettings: settings,
          attempts,
          fallbackApplied,
          notice: fallbackApplied
            ? `Recovered export using ${describeReliabilitySettings(settings)}.`
            : attempts.some((entry) => entry.kind === 'retry')
              ? 'Export recovered after retrying the requested settings.'
              : null
        };
      } catch (reason) {
        const error = normalizeExportError(reason, signal);
        if (!isRecoverableExportError(error)) throw error;
        lastFailure = error;
        // Retry the exact settings only for an early/transient driver failure.
        // A late failure is more likely resource pressure, so restart directly
        // with a safer fallback instead of repeating most of a long export.
        if (error.code === 'encoder-failure' && transientRetry < MAX_TRANSIENT_RETRIES && attemptProgress < 0.25) {
          transientRetry += 1;
          continue;
        }
        break;
      }
    }
  }

  throw lastFailure ?? new ReplayVideoExportError('No compatible export fallback succeeded.', 'unsupported');
}

export function describeReliabilitySettings(settings: ReplayVideoExportSettings): string {
  const audio = settings.audio.enabled ? 'audio' : 'silent';
  return `${settings.resolution} ${settings.fps} FPS ${settings.quality} ${settings.format.toUpperCase()} ${audio}`;
}

function reliabilitySettingsKey(settings: ReplayVideoExportSettings): string {
  return [
    settings.format,
    settings.resolution,
    settings.fps,
    settings.quality,
    settings.audio.enabled ? 'audio' : 'silent'
  ].join(':');
}

function normalizeExportError(reason: unknown, signal?: AbortSignal): ReplayVideoExportError {
  if (reason instanceof ReplayVideoExportError) return reason;
  if (signal?.aborted || (reason instanceof Error && reason.name === 'AbortError')) {
    return new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
  }
  return new ReplayVideoExportError(reason instanceof Error ? reason.message : 'The media encoder failed.', 'encoder-failure');
}

function isRecoverableExportError(error: ReplayVideoExportError): boolean {
  return error.code === 'unsupported' || error.code === 'encoder-failure' || error.code === 'memory-limit';
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
}
