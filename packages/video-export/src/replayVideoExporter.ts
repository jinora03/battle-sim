import { PixiBattleRenderer } from '@kinetic/renderer-pixi';
import { checksumSnapshot } from '@kinetic/simulation';
import { ReplayAudioSynthesizer } from './audioSynthesis';
import { ReplayAudioTimeline } from './audioTimeline';
import { BroadcastFrameRenderer } from './broadcastRenderer';
import {
  buildCinematicHighlightPlan,
  cinematicHighlightOffsetSecondsAtTick,
  getCinematicHighlightFocus,
  isCinematicHighlightSlowMotionFrame
} from './cinematicHighlights';
import { CreatorReplayAnalyzer } from './creatorHighlights';
import { captureCreatorThumbnail, encodeCreatorThumbnail } from './creatorThumbnail';
import { ReplayFrameStepper } from './replayFrameStepper';
import { RuntimeReplayAudioTimeline, renderRuntimeReplayAudio } from './runtimeReplayAudio';
import {
  calculateCreatorIntroFrameCount,
  calculateKnockoutSlowMotionFrameCount,
  validateExportPlan
} from './settings';
import {
  ReplayVideoExportError,
  type ReplayExportSource,
  type ReplayVideoExporterCallbacks,
  type ReplayVideoExportProgress,
  type ReplayVideoExportResult,
  type ReplayVideoExportSettings
} from './types';
import { createExportMediaPipeline } from './mediaPipeline';

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
    this.throwIfCancelled(signal);
    let highlightPlan: Awaited<ReturnType<typeof buildCinematicHighlightPlan>>;
    try {
      highlightPlan = await buildCinematicHighlightPlan(source, settings.camera, settings.fps, signal);
    } catch (reason) {
      if (signal?.aborted || (reason instanceof Error && reason.name === 'AbortError')) {
        throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
      }
      throw reason;
    }
    this.throwIfCancelled(signal);
    const stepper = new ReplayFrameStepper(source.replay, source.endTick, settings.fps);
    const introFrames = calculateCreatorIntroFrameCount(settings);
    const knockoutSlowMotionFrames = calculateKnockoutSlowMotionFrameCount(settings, source.battleEnded);
    const resultHoldFrames = source.battleEnded ? Math.round(settings.resultHoldSeconds * settings.fps) : 0;
    const totalFrames = introFrames + stepper.totalFrames + highlightPlan.extraFrames + knockoutSlowMotionFrames + resultHoldFrames;
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
    const media = await createExportMediaPipeline(settings);
    if (!media) {
      const formatLabel = settings.format === 'mp4' ? 'H.264/AAC MP4' : settings.format === 'webm' ? 'VP9/VP8 WebM' : 'MP4 or WebM';
      throw new ReplayVideoExportError(
        `This browser cannot encode the requested ${settings.width}×${settings.height} ${settings.fps} FPS ${formatLabel} output.`,
        'unsupported'
      );
    }

    const broadcastRenderer = new BroadcastFrameRenderer(settings, source.replay.battle);
    const creatorAnalyzer = new CreatorReplayAnalyzer(source.replay.battle);
    const presentationOffsetSecondsAtTick = (tick: number) => cinematicHighlightOffsetSecondsAtTick(highlightPlan, tick);
    const audioTimeline = new ReplayAudioTimeline(source.replay.battle, {
      startOffsetSeconds: introFrames / settings.fps,
      resultDelaySeconds: knockoutSlowMotionFrames / settings.fps,
      presentationOffsetSecondsAtTick
    });
    const runtimeAudioTimeline = new RuntimeReplayAudioTimeline();
    const initialSnapshot = stepper.currentSnapshot();
    const arenaSize = broadcastRenderer.layout.arena;
    const host = createExportHost(arenaSize.width, arenaSize.height);
    const renderer = new PixiBattleRenderer();
    let thumbnailCanvas: HTMLCanvasElement | null = null;

    try {
      renderer.setFixedOutputSize(arenaSize.width, arenaSize.height);
      await renderer.init(host, source.replay.battle.arenaId, settings.presentation);
      renderer.setActive(true);
      report('rendering', 'Rendering replay frames without real-time frame drops.', true);

      const encodeFrame = async (canvas: HTMLCanvasElement, timestampUs: number, durationUs: number) => {
        const keyFrame = renderedFrames % (settings.fps * KEYFRAME_INTERVAL_SECONDS) === 0;
        media.encodeVideo(canvas, timestampUs, durationUs, keyFrame);
        renderedFrames += 1;
        encodedBytes = media.byteLength;
        if (media.videoQueueSize >= ENCODER_QUEUE_LIMIT) {
          await flushEncoderStage(
            () => media.flushVideo(),
            'Video encoder flush failed while draining queued frames.'
          );
          encodedBytes = media.byteLength;
        }
        report('rendering', `Rendered ${renderedFrames.toLocaleString()} of ${totalFrames.toLocaleString()} frames.`);
        if (renderedFrames % 2 === 0) await yieldToBrowser();
      };

      if (introFrames > 0) {
        renderer.renderExportFrame(initialSnapshot, [], 1000 / settings.fps);
        report('rendering', 'Rendering the creator matchup intro.', true);
        for (let introFrame = 0; introFrame < introFrames; introFrame += 1) {
          this.throwIfCancelled(signal);
          const broadcastCanvas = broadcastRenderer.render(renderer.getCanvas(), initialSnapshot, [], {
            phase: 'intro',
            phaseProgress: introFrames <= 1 ? 1 : introFrame / (introFrames - 1),
            showResult: false,
            showCaptions: false,
            creatorCard: {
              kind: 'intro',
              progress: introFrames <= 1 ? 1 : introFrame / (introFrames - 1)
            }
          });
          const timestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
          const durationUs = Math.round(1_000_000 / settings.fps);
          await encodeFrame(broadcastCanvas, timestampUs, durationUs);
        }
      }

      while (!stepper.done) {
        this.throwIfCancelled(signal);
        const frame = stepper.next();
        if (!frame) break;
        audioTimeline.addEvents(frame.events);
        runtimeAudioTimeline.addEvents(frame.events);
        const highlightChanged = creatorAnalyzer.update(frame.snapshot, frame.events);
        const cinematicHighlight = getCinematicHighlightFocus(highlightPlan, frame.snapshot.tick);
        renderer.renderExportFrame(frame.snapshot, frame.events, 1000 / settings.fps);
        const presentationShake = settings.camera.shakeEnabled
          ? renderer.getLastPresentationShakePixels()
          : 0;
        const hideResult = settings.camera.mode === 'cinematic' && frame.snapshot.battleEnded;
        const broadcastCanvas = hideResult
          ? broadcastRenderer.render(renderer.getCanvas(), frame.snapshot, frame.events, {
              showResult: false,
              showCaptions: settings.creator.captionsEnabled,
              highlight: cinematicHighlight,
              presentationShake
            })
          : broadcastRenderer.render(renderer.getCanvas(), frame.snapshot, frame.events, {
              showCaptions: settings.creator.captionsEnabled,
              highlight: cinematicHighlight,
              presentationShake
            });
        if (settings.creator.thumbnailEnabled && highlightChanged) {
          if (thumbnailCanvas) {
            thumbnailCanvas.width = 1;
            thumbnailCanvas.height = 1;
          }
          thumbnailCanvas = captureCreatorThumbnail(broadcastCanvas, settings.layout);
        }
        const timestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
        await encodeFrame(broadcastCanvas, timestampUs, frame.durationUs);

        if (isCinematicHighlightSlowMotionFrame(highlightPlan, frame.snapshot.tick)) {
          this.throwIfCancelled(signal);
          const slowMotionCanvas = broadcastRenderer.render(renderer.getCanvas(), frame.snapshot, [], {
            ...(hideResult ? { showResult: false } : {}),
            showCaptions: settings.creator.captionsEnabled,
            highlight: cinematicHighlight ? { ...cinematicHighlight, slowMotion: true } : null
          });
          const slowTimestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
          await encodeFrame(slowMotionCanvas, slowTimestampUs, frame.durationUs);
        }
      }

      const finalSnapshot = stepper.finalSnapshot();
      const creatorSummary = creatorAnalyzer.finalize(finalSnapshot);
      const durationUs = Math.round(1_000_000 / settings.fps);
      if (knockoutSlowMotionFrames > 0) {
        report('rendering', 'Holding the knockout with deterministic cinematic framing.', true);
        for (let slowFrame = 0; slowFrame < knockoutSlowMotionFrames; slowFrame += 1) {
          this.throwIfCancelled(signal);
          const broadcastCanvas = broadcastRenderer.render(renderer.getCanvas(), finalSnapshot, [], {
            phase: 'knockout',
            phaseProgress: knockoutSlowMotionFrames <= 1 ? 1 : slowFrame / (knockoutSlowMotionFrames - 1),
            showResult: false,
            showCaptions: settings.creator.captionsEnabled
          });
          const timestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
          await encodeFrame(broadcastCanvas, timestampUs, durationUs);
        }
      }

      if (resultHoldFrames > 0) {
        for (let holdFrame = 0; holdFrame < resultHoldFrames; holdFrame += 1) {
          this.throwIfCancelled(signal);
          const broadcastCanvas = broadcastRenderer.render(renderer.getCanvas(), finalSnapshot, [], {
            phase: 'result',
            phaseProgress: resultHoldFrames <= 1 ? 1 : holdFrame / (resultHoldFrames - 1),
            showResult: true,
            showCaptions: settings.creator.captionsEnabled,
            creatorCard: {
              kind: 'summary',
              progress: resultHoldFrames <= 1 ? 1 : holdFrame / (resultHoldFrames - 1),
              summary: creatorSummary
            }
          });
          if (settings.creator.thumbnailEnabled && !thumbnailCanvas && holdFrame === 0) {
            thumbnailCanvas = captureCreatorThumbnail(broadcastCanvas, settings.layout);
          }
          const timestampUs = Math.round(renderedFrames * 1_000_000 / settings.fps);
          await encodeFrame(broadcastCanvas, timestampUs, durationUs);
        }
      }

      report('finalizing', 'Finalizing the video encoder and committing buffered frames.', true);
      await flushEncoderStage(
        () => media.flushVideo(),
        'Video encoder flush failed while finalizing the exported video.'
      );
      encodedBytes = media.byteLength;

      if (settings.audio.enabled && media.audioCodec) {
        report('audio', `Rendering deterministic replay audio and encoding ${media.audioCodec.toUpperCase()}.`, true);
        const runtimeAudio = await renderRuntimeReplayAudio({
          battle: source.replay.battle,
          initialSnapshot,
          timeline: runtimeAudioTimeline,
          durationSeconds: renderedFrames / settings.fps,
          startOffsetSeconds: introFrames / settings.fps,
          resultDelaySeconds: knockoutSlowMotionFrames / settings.fps,
          presentationOffsetSecondsAtTick,
          sampleRate: settings.audio.sampleRate,
          channels: settings.audio.channels
        });
        const audioSource = runtimeAudio ?? new ReplayAudioSynthesizer(
          audioTimeline.finalize(),
          settings.audio.sampleRate,
          settings.audio.channels
        );
        const totalAudioFrames = Math.ceil(renderedFrames / settings.fps * settings.audio.sampleRate);
        for (let startFrame = 0; startFrame < totalAudioFrames; startFrame += media.audioFramesPerChunk) {
          this.throwIfCancelled(signal);
          const frameCount = Math.min(media.audioFramesPerChunk, totalAudioFrames - startFrame);
          const pcm = audioSource.renderInterleaved(startFrame, frameCount);
          media.encodeAudio(pcm, Math.round(startFrame * 1_000_000 / settings.audio.sampleRate), frameCount);
          encodedBytes = media.byteLength;
          if (media.audioQueueSize >= ENCODER_QUEUE_LIMIT) {
            await flushEncoderStage(
              () => media.flushAudio(),
              'Audio encoder flush failed while draining queued samples.'
            );
            encodedBytes = media.byteLength;
          }
          if (startFrame % (media.audioFramesPerChunk * 20) === 0) await yieldToBrowser();
        }
        report('finalizing', 'Finalizing deterministic audio and committing buffered samples.', true);
        await flushEncoderStage(
          () => media.flushAudio(),
          'Audio encoder flush failed while finalizing deterministic replay audio.'
        );
        encodedBytes = media.byteLength;
      }

      this.throwIfCancelled(signal);
      report('muxing', `Packaging synchronized video and audio into a ${media.container.toUpperCase()} file.`, true);
      const blob = finalizeMediaFile(() => media.finalize());
      const thumbnailBlob = thumbnailCanvas ? await safeEncodeCreatorThumbnail(thumbnailCanvas) : null;
      const finalChecksum = checksumSnapshot(stepper.finalSnapshot());
      if (finalChecksum !== source.checksum) {
        throw new ReplayVideoExportError(
          `Replay checksum mismatch: expected ${source.checksum}, received ${finalChecksum}.`,
          'invalid-source'
        );
      }
      const result: ReplayVideoExportResult = {
        blob,
        container: media.container,
        codec: media.videoCodec,
        audioCodec: media.audioCodec,
        mimeType: media.container === 'mp4' ? 'video/mp4' : 'video/webm',
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        frameCount: renderedFrames,
        durationSeconds: renderedFrames / settings.fps,
        encodedBytes: blob.size,
        sourceChecksum: source.checksum,
        layout: settings.layout,
        resolution: settings.resolution,
        quality: settings.quality,
        cameraMode: settings.camera.mode,
        creatorPreset: settings.creator.preset,
        summary: creatorSummary,
        thumbnailBlob,
        thumbnailWidth: thumbnailBlob ? thumbnailCanvas?.width ?? null : null,
        thumbnailHeight: thumbnailBlob ? thumbnailCanvas?.height ?? null : null
      };
      encodedBytes = blob.size;
      return result;
    } catch (reason) {
      if (reason instanceof ReplayVideoExportError) throw reason;
      if (signal?.aborted) throw new ReplayVideoExportError('Video export was cancelled.', 'cancelled');
      const message = reason instanceof Error ? reason.message : 'The media encoder failed.';
      const code = message.includes('memory safeguard') ? 'memory-limit' : 'encoder-failure';
      throw new ReplayVideoExportError(message, code);
    } finally {
      media.close();
      // Export cleanup must never turn an already encoded video into a false
      // user-facing failure. Chromium can report transient WebGL teardown
      // errors after large 4K contexts; cleanup remains best-effort here while
      // the live renderer recovery owns the fresh-context guarantee.
      try { renderer.setActive(false); } catch { /* best-effort export cleanup */ }
      try { renderer.destroy(); } catch { /* best-effort export cleanup */ }
      try { broadcastRenderer.destroy(); } catch { /* best-effort export cleanup */ }
      if (thumbnailCanvas) {
        thumbnailCanvas.width = 1;
        thumbnailCanvas.height = 1;
      }
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

async function flushEncoderStage(action: () => Promise<void>, context: string): Promise<void> {
  try {
    await action();
  } catch (reason) {
    const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
    throw new ReplayVideoExportError(`${context}${detail}`.trim(), 'encoder-failure');
  }
}

function finalizeMediaFile(action: () => Blob): Blob {
  try {
    return action();
  } catch (reason) {
    const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
    throw new ReplayVideoExportError(`Container finalization failed.${detail}`.trim(), 'encoder-failure');
  }
}

async function safeEncodeCreatorThumbnail(canvas: HTMLCanvasElement): Promise<Blob | null> {
  try {
    return await encodeCreatorThumbnail(canvas);
  } catch {
    // Thumbnail generation is optional and must never invalidate a completed video.
    return null;
  }
}
