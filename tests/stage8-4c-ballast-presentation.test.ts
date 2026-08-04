import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';
import { getSkillPresentation } from '@kinetic/visual-engine';

describe('Stage 8.4C Ballast presentation polish', () => {
  it('assigns dedicated mass-themed resolve recipes to the complete Ballast kit', () => {
    expect(getSkillPresentation('featherfall').resolve).toBe('mass-bloom');
    expect(getSkillPresentation('downbeat').resolve).toBe('downbeat-punt');
    expect(getSkillPresentation('dead-weight').resolve).toBe('anchor-drop');
    expect(getSkillPresentation('last-call').resolve).toBe('last-call');
  });

  it('implements every dedicated Ballast resolve style in the Pixi effect engine', () => {
    const fxSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    for (const style of ['mass-bloom', 'downbeat-punt', 'anchor-drop', 'last-call']) {
      expect(fxSource).toContain(`case '${style}':`);
    }
  });

  it('gives Skip Stone and all four abilities explicit synthesized audio paths', () => {
    const audioSource = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(audioSource.match(/event\.weaponId === 'skip-stone'/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const abilityId of ['featherfall', 'downbeat', 'dead-weight', 'last-call']) {
      expect(audioSource).toContain(`id === '${abilityId}'`);
    }
  });

  it('keeps engine and content compatibility markers aligned', () => {
  expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
});
});
