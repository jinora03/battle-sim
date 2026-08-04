import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_VFX_HIERARCHY_SCALE,
  COMBAT_VFX_INTENTS,
  COMBAT_VFX_PHASES,
  getAbilityCombatVfxProfile,
  listAbilityCombatVfxProfiles,
  resolveCombatVfxLayer
} from '@kinetic/visual-engine';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

describe('Stage 8.7A intent-based combat VFX', () => {
  it('defines a reusable four-phase visual lifecycle and intent vocabulary', () => {
    expect(COMBAT_VFX_PHASES).toEqual(['anticipation', 'activation', 'sustain', 'release']);
    expect(COMBAT_VFX_INTENTS).toEqual(expect.arrayContaining([
      'projectile',
      'dash',
      'beam',
      'explosion',
      'pull',
      'knockback',
      'status',
      'transformation',
      'channel',
      'ultimate'
    ]));
  });

  it('keeps presentation hierarchy ordered from basics to ultimates', () => {
    expect(COMBAT_VFX_HIERARCHY_SCALE.basic).toBeLessThan(COMBAT_VFX_HIERARCHY_SCALE.skill);
    expect(COMBAT_VFX_HIERARCHY_SCALE.skill).toBeLessThan(COMBAT_VFX_HIERARCHY_SCALE.payoff);
    expect(COMBAT_VFX_HIERARCHY_SCALE.payoff).toBeLessThan(COMBAT_VFX_HIERARCHY_SCALE.ultimate);
  });

  it('registers Thunder Dome as the first complete reference profile', () => {
    const profile = getAbilityCombatVfxProfile('thunder-dome');
    expect(profile).toMatchObject({
      abilityId: 'thunder-dome',
      palette: 'electric',
      hierarchy: 'ultimate'
    });
    expect(profile?.layers.map((layer) => layer.phase)).toEqual(COMBAT_VFX_PHASES);
    expect(profile?.layers.map((layer) => layer.intent)).toEqual([
      'ultimate',
      'explosion',
      'channel',
      'status'
    ]);
    expect(listAbilityCombatVfxProfiles()).toEqual(expect.arrayContaining([expect.objectContaining({ abilityId: 'thunder-dome' })]));
  });

  it('normalizes cast-relative timing without simulation state or random values', () => {
    const profile = getAbilityCombatVfxProfile('thunder-dome');
    expect(profile).toBeDefined();
    const anticipation = resolveCombatVfxLayer(profile!, 'anticipation', 54);
    const activation = resolveCombatVfxLayer(profile!, 'activation');
    const release = resolveCombatVfxLayer(profile!, 'release');

    expect(anticipation).toMatchObject({
      phase: 'anticipation',
      anchor: 'activated',
      intent: 'ultimate'
    });
    expect(anticipation?.durationSeconds).toBeCloseTo(0.9, 5);
    expect(activation?.anchor).toBe('resolved');
    expect(activation?.intensity).toBeGreaterThan(release?.intensity ?? 0);
    expect(release?.delaySeconds).toBeGreaterThan(0);
  });

  it('routes profiles through generic full-quality and mass-battle render paths', () => {
    const legacySource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const layeredSource = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');

    expect(legacySource).toContain('getAbilityCombatVfxProfile');
    expect(legacySource).toContain('scheduleAbilityCombatVfx');
    expect(legacySource).toContain('scheduledCombatVfx');
    expect(layeredSource).toContain("snapshot.entities.length > 40 || quality.tier === 'low'");
    expect(layeredSource).toContain("abilityProfile?.hierarchy === 'ultimate'");
    expect(legacySource).not.toContain("event.abilityId === 'thunder-dome'");
    expect(layeredSource).not.toContain("event.abilityId === 'thunder-dome'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.16-stage8.7b');
    expect(ENGINE_VERSION).toBe('1.3.16-stage8.7b');
  });
});
