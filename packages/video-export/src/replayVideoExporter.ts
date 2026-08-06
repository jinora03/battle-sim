import { PixiBattleRenderer } from '@kinetic/renderer-pixi';
import { checksumSnapshot } from '@kinetic/simulation';
import { ReplayFrameStepper } from './replayFrameStepper';
import { validateExportPlan } from './settings';
import {
  ReplayVideoExportError,
  type ReplayExportSource,
  type ReplayVideoExporterCallbacks,
  type ReplayVideoExportProgress,
  type ReplayVideoExportResult,
  type ReplayVideoExportSettings
} from './types';
import { WebCodecsFrameEncoder } from './webCodecs';
import { WebmMuxer } from './webmMuxer';

const KEYFRAME_INTERVAL_SECONDS = 2;
const PROGRESS_INTERVAL_FRAMES = 6;
const ENCODER_QUEUE_LIMIT = 8;

export class ReplayVideoExporter {
  async export(
    source: ReplayExportSource,
    settings: ReplayVideoExportSettings,
    callbacks: ReplayVideoExporterCallbacks = {},
    signal?: AbortSignal
  ): Promise<ReplayVideoExportResult> {
    this.assertSource(source);
    const stepper = new ReplayFrameStepper(source.replay, source.endTick, settings.fps);
    try {
      validateExportPlan(settings, stepper.totalFrames);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The replay cannot be exported.';
      const code = message.includes('duration') ? 'duration-limit' : message.includes('memory') ? 'memory-limit' : 'invalid-source';
      throw new ReplayVideoExportError(message, code);
    }
    this.throwIfCancelled(signal);

    const startedAt = performance.now();
    let renderedFrames = 0;
    let encodedBytes = 0;
    const report = (phase: ReplayVideoExportProgress['phase'], message: string, force = false) => {
      if (!force && renderedFrames > 0 && renderedFrames % PROGRESS_INTERVAL_FRAMES !== 0) return;
      const elapsedMs = Math.max(0, performance.now() - startedAt);
      const progress = stepper.totalFrames > 0 ? renderedFrames / stepper.totalFrames : 0;
      const estimatedRemainingMs = renderedFrames > 0
        ? Math.max(0, elapsedMs / renderedFrames * (stepper.totalFrames - renderedFrames))
        : null;
      callbacks.onProgress?.({
        phase,
        renderedFrames,
        totalFrames: stepper.totalFrames,
        progress,
        elapsedMs,
        estimatedRemainingMs,
        encodedBytes,
        message
      });
    };

    report('preparing', 'Preparing the dedicated 1920×1080 export renderer.', true);
    const encoder = await WebCodecsFrameEncoder.create(settings);
    if (!encoder) {
      throw new ReplayVideoExportError(
        'This browser cannot encode the required 1080p60 VP9 or VP8 WebM output.',
        'unsupported'
      );
    }

    const host = createExportHost(settings.width, settings.height);
    const renderer = new PixiBattleRenderer();
    const muxer = new WebmMuxer({
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      codec: encoder.codec,
      maxEncodedBytes: settings.maxEncodedBytes
    });

    try {
      renderer.setFixedOutputSize(settings.width, settings.height);
      await renderer.init(host, source.replay.battle.arenaId, settings.presentation);
      renderer.setActive(true);
      const canvas = renderer.getCanvas();
      report('rendering', 'Rendering replay frames without real-time frame drops.', true);

      while (!stepper.done) {
        this.throwIfCancelled(signal);
        const frame = stepper.next();
        if (!frame) break;
        renderer.renderExportFrame(frame.snapshot, frame.events, 1000 / settings.fps);
        const keyFrame = frame.frameIndex % (settings.fps * KEYFRAME_INTERVAL_SECONDS) === 0;
        encoder.encode(canvas, frame.timestampUs, frame.durationUs, keyFrame);
        renderedFrames += 1;
        for (const sample of encoder.drainSamples()) muxer.addSample(sample);
        encodedBytes = muxer.byteLength;

        if (encoder.encodeQueueSize >= ENCODER_QUEUE_LIMIT) {
          await encoder.flush();
          for (const sample of encoder.drainSamples()) muxer.addSample(sample);
          encodedBytes = muxer.byteLength;
        }
        report('rendering', `Rendered ${renderedFrames.toLocaleString()} of ${stepper.totalFrames.toLocaleString()} frames.`);
        if (renderedFrames % 2 === 0) await yieldToBrowser();
      }

      await encoder.flush();
      for (const sample of encoder.drainSamples()) muxer.addSample(sample);
      encodedBytes = muxer.byteLength;
      this.throwIfCancelled(signal);
      report('muxing', 'Packaging encoded frames into a WebM file.', true);
      const blob = muxer.finalize();
      const finalChecksum = checksumSnapshot(stepper.finalSnapshot());
      if (finalChecksum !== source.checksum) {
        throw new ReplayVideoExportError(
          `Replay checksum mismatch: expected ${source.checksum}, received ${finalChecksum}.`,
          'invalid-source'
        );
      }
      const result: ReplayVideoExportResult = {
        blob,
        codec: encoder.codec,
        mimeType: 'video/webm',
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        frameCount: renderedFrames,
        durationSeconds: renderedFrames / settings.fps,
        encodedBytes: blob.size,
        sourceChecksum: source.checksum
      };
      encodedBytes = blob.size;
      report('complete', 'Video export complete.', true);
      return result;
    } catch (reason) {
      if (reason instanceof ReplayVideoExportError) throw reason;
      if (signal?.aborted) throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
      const message = reason instanceof Error ? reason.message : 'The video encoder failed.';
      const code = message.includes('memory safeguard') ? 'memory-limit' : 'encoder-failure';
      throw new ReplayVideoExportError(message, code);
    } finally {
      encoder.close();
      renderer.destroy();
      host.remove();
    }
  }

  private assertSource(source: ReplayExportSource): void {
    if (!Number.isInteger(source.endTick) || source.endTick <= 0) {
      throw new ReplayVideoExportError('The replay has no completed simulation ticks to export.', 'invalid-source');
    }
    if (!source.checksum || source.checksum === '--------') {
      throw new ReplayVideoExportError('The replay source is missing its final simulation checksum.', 'invalid-source');
    }
  }

  private throwIfCancelled(signal?: AbortSignal): void {
    if (signal?.aborted) throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
  }
}

function createExportHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div');
  host.dataset.videoExportHost = 'true';
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    opacity: '0',
    pointerEvents: 'none',
    contain: 'strict',
    overflow: 'hidden'
  });
  document.body.appendChild(host);
  return host;
}

async function yieldToBrowser(): Promise<void> {
  const schedulerApi = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (schedulerApi?.yield) {
    await schedulerApi.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
