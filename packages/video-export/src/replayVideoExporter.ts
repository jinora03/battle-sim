import { PixiBattleRenderer } from '@kinetic/renderer-pixi';
import { checksumSnapshot } from '@kinetic/simulation';
import { ReplayAudioSynthesizer } from './audioSynthesis';
import { ReplayAudioTimeline } from './audioTimeline';
import { BroadcastFrameRenderer } from './broadcastRenderer';
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
import { WebCodecsAudioEncoder } from './webCodecsAudio';
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
    const resultHoldFrames = source.battleEnded ? Math.round(settings.resultHoldSeconds * settings.fps) : 0;
    const totalFrames = stepper.totalFrames + resultHoldFrames;
    try {
      validateExportPlan(settings, totalFrames);
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
      const progress = totalFrames > 0 ? renderedFrames / totalFrames : 0;
      const estimatedRemainingMs = renderedFrames > 0 && renderedFrames < totalFrames
        ? Math.max(0, elapsedMs / renderedFrames * (totalFrames - renderedFrames))
        : null;
      callbacks.onProgress?.({
        phase,
        renderedFrames,
        totalFrames,
        progress,
        elapsedMs,
        estimatedRemainingMs,
        encodedBytes,
        message
      });
    };

    report('preparing', `Preparing the dedicated ${settings.width}×${settings.height} broadcast renderer.`, true);
    const encoder = await WebCodecsFrameEncoder.create(settings);
    if (!encoder) {
      throw new ReplayVideoExportError(
        `This browser cannot encode ${settings.width}×${settings.height} ${settings.fps} FPS VP9 or VP8 WebM output.`,
        'unsupported'
      );
    }
    const audioEncoder = settings.audio.enabled ? await WebCodecsAudioEncoder.create(settings.audio) : null;
    if (settings.audio.enabled && !audioEncoder) {
      encoder.close();
      throw new ReplayVideoExportError(
        'This browser cannot encode the requested Opus audio track. Turn Audio off to export video-only.',
        'unsupported'
      );
    }

    const broadcastRenderer = new BroadcastFrameRenderer(settings, source.replay.battle);
    const audioTimeline = new ReplayAudioTimeline(source.replay.battle);
    const arenaSize = broadcastRenderer.layout.arena;
    const host = createExportHost(arenaSize.width, arenaSize.height);
    const renderer = new PixiBattleRenderer();
    const muxer = new WebmMuxer({
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      codec: encoder.codec,
      maxEncodedBytes: settings.maxEncodedBytes,
      ...(settings.audio.enabled ? {
        audio: {
          codec: 'opus' as const,
          sampleRate: settings.audio.sampleRate,
          channels: settings.audio.channels
        }
      } : {})
    });

    try {
      renderer.setFixedOutputSize(arenaSize.width, arenaSize.height);
      await renderer.init(host, source.replay.battle.arenaId, settings.presentation);
      renderer.setActive(true);
      report('rendering', 'Rendering replay frames without real-time frame drops.', true);

      const encodeFrame = async (canvas: HTMLCanvasElement, timestampUs: number, durationUs: number) => {
        const keyFrame = renderedFrames % (settings.fps * KEYFRAME_INTERVAL_SECONDS) === 0;
        encoder.encode(canvas, timestampUs, durationUs, keyFrame);
        renderedFrames += 1;
        for (const sample of encoder.drainSamples()) muxer.addVideoSample(sample);
        encodedBytes = muxer.byteLength;
        if (encoder.encodeQueueSize >= ENCODER_QUEUE_LIMIT) {
          await encoder.flush();
          for (const sample of encoder.drainSamples()) muxer.addVideoSample(sample);
          encodedBytes = muxer.byteLength;
        }
        report('rendering', `Rendered ${renderedFrames.toLocaleString()} of ${totalFrames.toLocaleString()} frames.`);
        if (renderedFrames % 2 === 0) await yieldToBrowser();
      };

      while (!stepper.done) {
        this.throwIfCancelled(signal);
        const frame = stepper.next();
        if (!frame) break;
        audioTimeline.addEvents(frame.events);
        renderer.renderExportFrame(frame.snapshot, frame.events, 1000 / settings.fps);
        const broadcastCanvas = broadcastRenderer.render(renderer.getCanvas(), frame.snapshot, frame.events);
        await encodeFrame(broadcastCanvas, frame.timestampUs, frame.durationUs);
      }

      if (resultHoldFrames > 0) {
        const finalSnapshot = stepper.finalSnapshot();
        const durationUs = Math.round(1_000_000 / settings.fps);
        for (let holdFrame = 0; holdFrame < resultHoldFrames; holdFrame += 1) {
          this.throwIfCancelled(signal);
          const broadcastCanvas = broadcastRenderer.render(renderer.getCanvas(), finalSnapshot, []);
          const timestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
          await encodeFrame(broadcastCanvas, timestampUs, durationUs);
        }
      }

      await encoder.flush();
      for (const sample of encoder.drainSamples()) muxer.addVideoSample(sample);
      encodedBytes = muxer.byteLength;

      if (audioEncoder) {
        report('audio', 'Rendering deterministic replay audio and encoding Opus.', true);
        const synthesizer = new ReplayAudioSynthesizer(
          audioTimeline.finalize(),
          settings.audio.sampleRate,
          settings.audio.channels
        );
        const totalAudioFrames = Math.ceil(renderedFrames / settings.fps * settings.audio.sampleRate);
        for (let startFrame = 0; startFrame < totalAudioFrames; startFrame += audioEncoder.framesPerChunk) {
          this.throwIfCancelled(signal);
          const frameCount = audioEncoder.framesPerChunk;
          const pcm = synthesizer.renderInterleaved(startFrame, frameCount);
          audioEncoder.encode(pcm, Math.round(startFrame * 1_000_000 / settings.audio.sampleRate), frameCount);
          for (const sample of audioEncoder.drainSamples()) muxer.addAudioSample(sample);
          encodedBytes = muxer.byteLength;
          if (audioEncoder.encodeQueueSize >= ENCODER_QUEUE_LIMIT) {
            await audioEncoder.flush();
            for (const sample of audioEncoder.drainSamples()) muxer.addAudioSample(sample);
            encodedBytes = muxer.byteLength;
          }
          if (startFrame % (audioEncoder.framesPerChunk * 20) === 0) await yieldToBrowser();
        }
        await audioEncoder.flush();
        for (const sample of audioEncoder.drainSamples()) muxer.addAudioSample(sample);
        encodedBytes = muxer.byteLength;
      }

      this.throwIfCancelled(signal);
      report('muxing', 'Packaging synchronized video and audio into a WebM file.', true);
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
        audioCodec: audioEncoder?.codec ?? null,
        mimeType: 'video/webm',
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        frameCount: renderedFrames,
        durationSeconds: renderedFrames / settings.fps,
        encodedBytes: blob.size,
        sourceChecksum: source.checksum,
        layout: settings.layout,
        resolution: settings.resolution,
        quality: settings.quality
      };
      encodedBytes = blob.size;
      report('complete', 'Video export complete.', true);
      return result;
    } catch (reason) {
      if (reason instanceof ReplayVideoExportError) throw reason;
      if (signal?.aborted) throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
      const message = reason instanceof Error ? reason.message : 'The media encoder failed.';
      const code = message.includes('memory safeguard') ? 'memory-limit' : 'encoder-failure';
      throw new ReplayVideoExportError(message, code);
    } finally {
      encoder.close();
      audioEncoder?.close();
      renderer.destroy();
      broadcastRenderer.destroy();
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
