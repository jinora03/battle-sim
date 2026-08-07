import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Mp4Muxer,
  createStage810eExportSettings,
  createStage810hExportSettings
} from '@kinetic/video-export';

function ascii(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('Stage 8.10H MP4 and WebM format fallback', () => {
  it('keeps earlier stage settings on WebM while creator export defaults to Auto', () => {
    const previous = createStage810eExportSettings({}, { preset: 'youtube' });
    const current = createStage810hExportSettings({}, { preset: 'youtube' });
    expect(previous.format).toBe('webm');
    expect(previous.audio.codec).toBe('opus');
    expect(current.format).toBe('auto');
    expect(current.audio.codec).toBe('auto');

    expect(createStage810hExportSettings({}, { preset: 'shorts', format: 'mp4' })).toMatchObject({
      format: 'mp4', width: 1080, height: 1920, fps: 60
    });
    expect(createStage810hExportSettings({}, { preset: 'youtube', format: 'webm' }).format).toBe('webm');
  });

  it('packages H.264 and AAC samples into a structurally valid fragmented MP4 blob', async () => {
    const muxer = new Mp4Muxer({
      width: 1920,
      height: 1080,
      fps: 60,
      sampleRate: 48_000,
      channels: 2,
      audioBitrate: 160_000,
      maxEncodedBytes: 1024 * 1024,
      audioEnabled: true
    });
    // Minimal AVCDecoderConfigurationRecord for container-structure coverage.
    muxer.setVideoDecoderConfig(Uint8Array.of(1, 66, 0, 31, 255, 225, 0, 1, 0, 1, 0, 1, 0));
    muxer.setAudioDecoderConfig(Uint8Array.of(0x11, 0x90));
    muxer.addVideoSample({ timestampUs: 0, durationUs: 16_667, keyFrame: true, data: Uint8Array.of(0, 0, 0, 1, 9) });
    muxer.addVideoSample({ timestampUs: 16_667, durationUs: 16_667, keyFrame: false, data: Uint8Array.of(0, 0, 0, 1, 1) });
    muxer.addAudioSample({ timestampUs: 0, durationUs: 21_333, data: Uint8Array.of(1, 2, 3) });

    const blob = muxer.finalize();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = ascii(bytes);
    expect(blob.type).toBe('video/mp4');
    expect(ascii(bytes.slice(4, 8))).toBe('ftyp');
    expect(text).toContain('moov');
    expect(text).toContain('avc1');
    expect(text).toContain('mp4a');
    expect(text).toContain('moof');
    expect(text).toContain('mdat');
  });

  it('prefers H.264 plus AAC for Auto and retains VP9/VP8 plus Opus as the fallback path', () => {
    const capability = readFileSync(new URL('../packages/video-export/src/webCodecs.ts', import.meta.url), 'utf8');
    const pipeline = readFileSync(new URL('../packages/video-export/src/mediaPipeline.ts', import.meta.url), 'utf8');
    const mp4Codecs = readFileSync(new URL('../packages/video-export/src/mp4Codecs.ts', import.meta.url), 'utf8');

    expect(capability.indexOf('resolveH264EncoderConfig(settings)')).toBeLessThan(capability.indexOf('resolveEncoderConfig(settings)'));
    expect(capability).toContain("settings.format === 'mp4'");
    expect(capability).toContain("container: 'webm', fallback: settings.format === 'auto'");
    expect(pipeline.indexOf('createMp4Pipeline(settings)')).toBeLessThan(pipeline.indexOf('createWebmPipeline(settings)'));
    expect(mp4Codecs).toContain("codec: 'mp4a.40.2'");
    expect(mp4Codecs).toContain("avc: { format: 'avc' }");
    expect(mp4Codecs).toContain("latencyMode: 'realtime'");
    expect(mp4Codecs).toContain("'prefer-hardware'");
    expect(mp4Codecs).toContain("'no-preference'");
  });

  it('exposes Auto, MP4 and WebM in the creator panel and downloads the resolved extension', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    expect(panel).toContain('Auto · MP4 preferred');
    expect(panel).toContain('MP4 · H.264/AAC');
    expect(panel).toContain('WebM · VP9/VP8');
    expect(panel).toContain('capability?.notice');
    expect(hook).toContain("const extension = result.container === 'mp4' ? 'mp4' : 'webm';");
    expect(hook).not.toContain('`${baseName}.webm`');
  });

  it('does not introduce captureStream or MediaRecorder into the fixed-frame export path', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const pipeline = readFileSync(new URL('../packages/video-export/src/mediaPipeline.ts', import.meta.url), 'utf8');
    expect(exporter).not.toContain('captureStream(');
    expect(exporter).not.toContain('MediaRecorder');
    expect(pipeline).not.toContain('captureStream(');
    expect(pipeline).not.toContain('MediaRecorder');
  });
});
