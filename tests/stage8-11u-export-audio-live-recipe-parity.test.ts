import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stage 8.11U export audio live-recipe parity', () => {
  it('uses the normal live pulse recipe in export with no tone-softening substitution', () => {
    const audio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');

    expect(audio).not.toContain('softenHighPulseTones');
    expect(audio).not.toContain('playExportPulseTexture');
    expect(runtime).not.toContain('softenHighPulseTones');
    expect(audio).toContain('oscillator.type = type;');
    expect(audio).toContain('(0.025 + i * 0.008) * volumeScale * this.schedulingGainScale');
    expect(audio).toContain('t + 0.018');
    expect(audio).toContain('duration / pulses * 0.72');
  });

  it('uses one replay audio clock with no onset dither plumbing', () => {
    const audio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');

    expect(audio).not.toContain('throttleAtSeconds');
    expect(audio).toContain('this.schedulingClockMs = Math.max(0, atSeconds) * 1000');
    expect(runtime).not.toContain('RUNTIME_REPLAY_AUDIO_DITHER_MAX_SECONDS');
    expect(runtime).not.toContain('resolveRuntimeReplayAudioOnsetDitherSeconds');
    expect(runtime).toMatch(
      /engine\.consumeAtTime\(\s*batch\.events,\s*atSeconds,\s*entityCount,\s*focusEntityIds,\s*aiEntityIds\s*\)/
    );
  });

  it('keeps the deterministic bipolar-noise correctness fix', () => {
    const audio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    const fallback = readFileSync(new URL('../packages/video-export/src/audioSynthesis.ts', import.meta.url), 'utf8');

    expect(audio).toContain('return ((value >>> 0) / 0xffffffff) * 2 - 1;');
    expect(fallback).toContain('return ((value >>> 0) / 0xffffffff) * 2 - 1;');
  });

  it('keeps export master gain aligned with live instead of adding global makeup gain', () => {
    const runtime = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');

    expect(runtime).toContain('const EXPORT_MASTER_GAIN = 0.32;');
    expect(runtime).not.toContain('1.35');
  });
});
