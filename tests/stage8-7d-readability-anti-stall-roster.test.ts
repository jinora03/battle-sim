import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import {
  getAiCornerEscapeSign,
  resolveAiCornerEscapeDirection
} from '@kinetic/controllers';
import { ENGINE_VERSION } from '@kinetic/simulation';
import {
  getAbilityCombatVfxProfile,
  resolveCombatVfxLayer,
  resolveCombatVfxParticleStyle
} from '@kinetic/visual-engine';

describe('Stage 8.7D battle readability, anti-stall and roster polish', () => {
  it('uses intent-specific angular particle shapes instead of circle-only combat effects', () => {
    const explosion = resolveCombatVfxLayer(getAbilityCombatVfxProfile('mega-bomb')!, 'activation');
    const pull = resolveCombatVfxLayer(getAbilityCombatVfxProfile('polarity-pull')!, 'activation');
    const punt = resolveCombatVfxLayer(getAbilityCombatVfxProfile('downbeat')!, 'activation');
    const beam = resolveCombatVfxLayer(getAbilityCombatVfxProfile('solar-laser')!, 'activation');

    expect(resolveCombatVfxParticleStyle(explosion!)).toEqual({ primary: 'debris', secondary: 'smoke' });
    expect(resolveCombatVfxParticleStyle(pull!)).toEqual({ primary: 'ribbon', secondary: 'ring-fragment' });
    expect(resolveCombatVfxParticleStyle(punt!)).toEqual({ primary: 'wedge', secondary: 'streak' });
    expect(resolveCombatVfxParticleStyle(beam!)).toEqual({ primary: 'streak', secondary: 'spark' });
  });

  it('routes layered glow and broken shock rings through both renderer paths', () => {
    const fxSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const layeredSource = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');

    expect(fxSource).toContain('profileBloom');
    expect(fxSource).toContain('brokenShockwave');
    expect(fxSource).toContain("shape === 'flame'");
    expect(layeredSource).toContain('spawnProfileBloom');
    expect(layeredSource).toContain('spawnBrokenRing');
    expect(layeredSource).toContain("shape === 'wedge'");
  });

  it('resolves deterministic corner escapes inward while allowing seeded side variation', () => {
    const input = {
      entityId: 4,
      targetId: 9,
      corner: 'left:top' as const,
      targetDirection: { x: 1, y: 0.25 },
      escapeEpoch: 0
    };
    const first = resolveAiCornerEscapeDirection({ ...input, seed: 87001 });
    const repeated = resolveAiCornerEscapeDirection({ ...input, seed: 87001 });
    expect(first).toEqual(repeated);
    expect(first.x).toBeGreaterThan(0);
    expect(first.y).toBeGreaterThan(0);
    expect(Math.hypot(first.x, first.y)).toBeCloseTo(1, 6);

    const signs = new Set(Array.from({ length: 16 }, (_, seed) => getAiCornerEscapeSign(87000 + seed, 4, 'left:top:9', 0)));
    expect(signs.size).toBe(2);
  });

  it('adds corner-pressure state without changing player-controlled movement', () => {
    const controllerSource = readFileSync(new URL('../packages/controllers/src/index.ts', import.meta.url), 'utf8');
    expect(controllerSource).toContain('cornerPressureReactions');
    expect(controllerSource).toContain('updateRangedCornerEscape');
    expect(controllerSource).toContain('memory.cornerPressureReactions < 2');
    expect(controllerSource).toContain("['ranged', 'automatic', 'throwable', 'beam']");
  });

  it('keeps roster passive information static, readable and bounded on mobile', () => {
    const rosterSource = readFileSync(new URL('../apps/game/src/RosterView.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/70-fighter-previews.css', import.meta.url), 'utf8');

    expect(rosterSource).toContain('fighter-passive-card');
    expect(rosterSource).not.toContain('fighter-identity-disclosure');
    expect(rosterSource).not.toContain('listCompatibleModules');
    expect(styles).toContain('.fighter-passive-card');
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('.release-fighter-card');
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
    expect(CONTENT_VERSION).toMatch(/^1\.3\.\d+-stage8\./);
  });
});
