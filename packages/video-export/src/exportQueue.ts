import type {
  ReplayExportSource,
  ReplayVideoExportProgress,
  ReplayVideoExportResult,
  ReplayVideoExportSettings
} from './types';

export interface ReplayExportQueueRequest {
  id: string;
  sourceKey: string;
  settings: ReplayVideoExportSettings;
}

export interface ReplayExportQueueCompleteOutcome {
  id: string;
  sourceKey: string;
  status: 'complete';
  result: ReplayVideoExportResult;
}

export interface ReplayExportQueueErrorOutcome {
  id: string;
  sourceKey: string;
  status: 'error';
  error: Error;
}

export type ReplayExportQueueOutcome = ReplayExportQueueCompleteOutcome | ReplayExportQueueErrorOutcome;

export interface ReplayExportQueueCallbacks {
  resolveSource(request: ReplayExportQueueRequest, signal?: AbortSignal): Promise<ReplayExportSource>;
  exportReplay(
    source: ReplayExportSource,
    settings: ReplayVideoExportSettings,
    onProgress: (progress: ReplayVideoExportProgress) => void,
    signal?: AbortSignal
  ): Promise<ReplayVideoExportResult>;
  onItemStart?(request: ReplayExportQueueRequest, index: number, total: number): void;
  onItemProgress?(
    request: ReplayExportQueueRequest,
    progress: ReplayVideoExportProgress,
    index: number,
    total: number
  ): void;
  onItemComplete?(
    request: ReplayExportQueueRequest,
    result: ReplayVideoExportResult,
    index: number,
    total: number
  ): void;
  onItemError?(
    request: ReplayExportQueueRequest,
    error: Error,
    index: number,
    total: number
  ): void;
}

/**
 * Runs creator video work one item at a time. Replay sources are memoized by
 * sourceKey for the lifetime of the queue run so one deterministic replay can
 * feed several output formats without resimulating the battle.
 */
export async function runReplayExportQueue(
  requests: readonly ReplayExportQueueRequest[],
  callbacks: ReplayExportQueueCallbacks,
  signal?: AbortSignal
): Promise<ReplayExportQueueOutcome[]> {
  assertUniqueRequestIds(requests);
  const sourceCache = new Map<string, ReplayExportSource>();
  const outcomes: ReplayExportQueueOutcome[] = [];

  for (let index = 0; index < requests.length; index += 1) {
    throwIfCancelled(signal);
    const request = requests[index]!;
    callbacks.onItemStart?.(request, index, requests.length);

    try {
      let source = sourceCache.get(request.sourceKey);
      if (!source) {
        source = await callbacks.resolveSource(request, signal);
        sourceCache.set(request.sourceKey, source);
      }
      throwIfCancelled(signal);

      const result = await callbacks.exportReplay(
        source,
        request.settings,
        (progress) => callbacks.onItemProgress?.(request, progress, index, requests.length),
        signal
      );
      const outcome: ReplayExportQueueCompleteOutcome = {
        id: request.id,
        sourceKey: request.sourceKey,
        status: 'complete',
        result
      };
      outcomes.push(outcome);
      callbacks.onItemComplete?.(request, result, index, requests.length);
    } catch (reason) {
      if (signal?.aborted) throw cancelledError();
      const error = reason instanceof Error ? reason : new Error('Queued video export failed.');
      const outcome: ReplayExportQueueErrorOutcome = {
        id: request.id,
        sourceKey: request.sourceKey,
        status: 'error',
        error
      };
      outcomes.push(outcome);
      callbacks.onItemError?.(request, error, index, requests.length);
    }
  }

  return outcomes;
}

function assertUniqueRequestIds(requests: readonly ReplayExportQueueRequest[]): void {
  const ids = new Set<string>();
  for (const request of requests) {
    if (!request.id) throw new Error('Queued video exports require an item id.');
    if (!request.sourceKey) throw new Error(`Queued video export ${request.id} is missing a source key.`);
    if (ids.has(request.id)) throw new Error(`Duplicate queued video export id: ${request.id}`);
    ids.add(request.id);
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError();
}

function cancelledError(): Error {
  const error = new Error('Export queue was cancelled.');
  error.name = 'AbortError';
  return error;
}
