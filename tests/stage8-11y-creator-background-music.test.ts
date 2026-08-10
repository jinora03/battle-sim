import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CreatorBackgroundMusicMixer,
  createStage810hExportSettings
} from '@kinetic/video-export';

describe('Stage 8.11Y creator background music', () => {
  it('enables subtle creator-only background music by default without changing combat audio settings', () => {
    const settings = createStage810hExportSettings();

    expect(settings.audio.enabled).toBe(true);
    expect(settings.creator.backgroundMusicEnabled).toBe(true);
    expect(settings.creator.backgroundMusicVolume).toBe(0.15);
  });

  it('renders a deterministic low-level stereo creator music bed', () => {
    const create = () => {
      const output = new Float32Array(48_000 * 2);
      new CreatorBackgroundMusicMixer({
        seed: 81011,
        sampleRate: 48_000,
        channels: 2,
        volume: 0.15,
        durationSeconds: 1,
        introSeconds: 0,
        resultHoldSeconds: 0
      }).mixIntoInterleaved(output, 0, 48_000);
      return output;
    };

    const first = create();
    const second = create();
    expect(first).toEqual(second);

    let peak = 0;
    let energy = 0;
    for (const sample of first) {
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / first.length);
    expect(rms).toBeGreaterThan(0.001);
    expect(peak).toBeLessThan(0.03);
  });

  it('mixes music only in the video-export PCM path and leaves BattleAudioEngine untouched', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const liveAudio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    const ui = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(exporter).toContain('new CreatorBackgroundMusicMixer({');
    expect(exporter).toContain('backgroundMusic?.mixIntoInterleaved(pcm, startFrame, frameCount);');
    expect(liveAudio).not.toContain('CreatorBackgroundMusicMixer');
    expect(ui).toContain('Background music');
    expect(ui).toContain('Background music volume');
  });

  it('keeps creator music adjustable but capped below combat SFX', () => {
    const settings = createStage810hExportSettings({}, { backgroundMusicVolume: 0.8 });
    expect(settings.creator.backgroundMusicVolume).toBe(0.3);
  });
});
