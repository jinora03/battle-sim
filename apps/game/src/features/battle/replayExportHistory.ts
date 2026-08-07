import type { ReplayVideoExportResult } from '@kinetic/video-export';

const STORAGE_KEY = 'kinetic.replay-export-history.v1';
const MAX_ENTRIES = 8;

export interface ReplayExportHistoryEntry {
  id: string;
  createdAt: string;
  filename: string;
  preset: ReplayVideoExportResult['creatorPreset'];
  layout: ReplayVideoExportResult['layout'];
  resolution: ReplayVideoExportResult['resolution'];
  fps: ReplayVideoExportResult['fps'];
  durationSeconds: number;
  encodedBytes: number;
  container: ReplayVideoExportResult['container'];
  codec: ReplayVideoExportResult['codec'];
  audio: boolean;
  winnerName: string;
  highlight: string | null;
  thumbnail: boolean;
}

export function readReplayExportHistory(): ReplayExportHistoryEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function addReplayExportHistoryEntry(
  result: ReplayVideoExportResult,
  filename: string
): ReplayExportHistoryEntry[] {
  const entry: ReplayExportHistoryEntry = {
    id: `${Date.now()}-${result.sourceChecksum}`,
    createdAt: new Date().toISOString(),
    filename,
    preset: result.creatorPreset,
    layout: result.layout,
    resolution: result.resolution,
    fps: result.fps,
    durationSeconds: result.durationSeconds,
    encodedBytes: result.encodedBytes,
    container: result.container,
    codec: result.codec,
    audio: result.audioCodec !== null,
    winnerName: result.summary.winnerName,
    highlight: result.summary.highlight?.title ?? null,
    thumbnail: result.thumbnailBlob !== null
  };
  const next = [entry, ...readReplayExportHistory()].slice(0, MAX_ENTRIES);
  writeHistory(next);
  return next;
}

export function clearReplayExportHistory(): ReplayExportHistoryEntry[] {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage access may be blocked by browser privacy settings.
  }
  return [];
}

function writeHistory(entries: ReplayExportHistoryEntry[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // History is convenience metadata; export success does not depend on it.
  }
}

function isHistoryEntry(value: unknown): value is ReplayExportHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ReplayExportHistoryEntry>;
  return typeof entry.id === 'string'
    && typeof entry.createdAt === 'string'
    && typeof entry.filename === 'string'
    && typeof entry.durationSeconds === 'number'
    && typeof entry.encodedBytes === 'number'
    && typeof entry.winnerName === 'string';
}
