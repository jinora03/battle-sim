import { describe, expect, it } from 'vitest';
import {
  getElementVfxPalette,
  getVfxQualityProfile,
  getWeaponVfxRecipe,
  resolveVfxQuality,
  resolveVisualRadius
} from '@kinetic/visual-engine';

describe('v1.1 Stage 6 layered VFX policy', () => {
  it('selects high quality for a small healthy battle', () => {
    expect(resolveVfxQuality({
      effects: true,
      particleScale: 1,
      reducedMotion: false,
      adaptiveQuality: true,
      performanceScale: 1,
      fighterCount: 8
    }).tier).toBe('high');
  });

  it('reduces presentation quality for crowded or constrained battles', () => {
    const crowded = resolveVfxQuality({
      effects: true,
      particleScale: 1,
      reducedMotion: false,
      adaptiveQuality: true,
      performanceScale: 0.55,
      fighterCount: 64
    });
    expect(crowded.tier).toBe('low');
    expect(crowded.maxGroundMarks).toBeLessThan(getVfxQualityProfile('high').maxGroundMarks);
  });

  it('keeps visual radii separate from gameplay radii', () => {
    const gameplayRadius = 120;
    expect(resolveVisualRadius(gameplayRadius, 'high', 'ultimate')).toBeGreaterThan(gameplayRadius);
    expect(resolveVisualRadius(gameplayRadius, 'low', 'ambient')).toBeLessThan(gameplayRadius);
  });

  it('provides distinct elemental and weapon recipes', () => {
    expect(getElementVfxPalette('fire').groundMark).not.toBe(getElementVfxPalette('water').groundMark);
    expect(getWeaponVfxRecipe('arc-emitter').muzzleFlash).toBe(true);
    expect(getWeaponVfxRecipe('flame-fists').trailShape).toBe('beam');
    expect(getWeaponVfxRecipe('void-scythe').groundMark).toBe('void');
  });
});
