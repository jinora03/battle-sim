import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getAbilityCombatVfxProfile,
  getCombatVfxPersistentRig,
  listAbilityCombatVfxProfiles,
  resolveCombatVfxLayer
} from '@kinetic/visual-engine';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const gunnerAbilityIds = ['tactical-slide', 'suppressive-fire', 'pinning-round', 'kill-zone'] as const;
const sentinelAbilityIds = ['solar-rush', 'thunder-clap', 'solar-aegis', 'solar-laser'] as const;

describe('Stage 8.7B Gunner and Solar Sentinel intent VFX', () => {
  it('profiles the complete Gunner and Solar Sentinel kits', () => {
    for (const abilityId of [...gunnerAbilityIds, ...sentinelAbilityIds]) {
      expect(getAbilityCombatVfxProfile(abilityId), abilityId).toBeDefined();
    }
    expect(listAbilityCombatVfxProfiles()).toEqual(expect.arrayContaining(
      [...gunnerAbilityIds, ...sentinelAbilityIds].map((abilityId) => expect.objectContaining({ abilityId }))
    ));
  });

  it('keeps Gunner hierarchy and rotary lifecycle readable', () => {
    expect(getAbilityCombatVfxProfile('tactical-slide')?.hierarchy).toBe('skill');
    expect(getAbilityCombatVfxProfile('suppressive-fire')?.hierarchy).toBe('skill');
    expect(getAbilityCombatVfxProfile('pinning-round')?.hierarchy).toBe('payoff');

    const killZone = getAbilityCombatVfxProfile('kill-zone');
    expect(killZone).toMatchObject({
      hierarchy: 'ultimate',
      persistentRig: { kind: 'rotary-cannon', statusId: 'kill-zone-overdrive' }
    });
    expect(killZone?.layers.map((layer) => layer.intent)).toEqual([
      'transformation',
      'ultimate',
      'burst-fire',
      'transformation'
    ]);
    expect(getCombatVfxPersistentRig('kill-zone-overdrive')?.kind).toBe('rotary-cannon');

    const sustain = resolveCombatVfxLayer(killZone!, 'sustain');
    const release = resolveCombatVfxLayer(killZone!, 'release');
    expect(sustain?.delaySeconds).toBeLessThan(release?.delaySeconds ?? 0);
    expect(sustain?.durationSeconds).toBeGreaterThan(0.7);
  });

  it('drives Solar Eye Beams telegraph timing from profile data', () => {
    const laser = getAbilityCombatVfxProfile('solar-laser');
    expect(laser).toMatchObject({
      palette: 'fire',
      hierarchy: 'ultimate',
      telegraph: {
        kind: 'dual-eye-beam',
        eyeChargeTicks: 30,
        beamStartTicks: 48,
        range: 1080
      }
    });
    expect(laser?.layers.map((layer) => [layer.phase, layer.anchor, layer.intent])).toEqual([
      ['anticipation', 'activated', 'ultimate'],
      ['activation', 'activated', 'beam'],
      ['sustain', 'activated', 'channel'],
      ['release', 'resolved', 'beam']
    ]);
    expect(resolveCombatVfxLayer(laser!, 'activation')?.delaySeconds).toBeCloseTo(0.8, 5);
  });

  it('uses profile metadata instead of fighter-specific renderer checks', () => {
    const fxSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const layeredSource = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');
    const telegraphSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/SkillTelegraphRenderer.ts', import.meta.url), 'utf8');
    const fighterSource = readFileSync(new URL('../packages/renderer-pixi/src/fighters/FighterView.ts', import.meta.url), 'utf8');

    expect(fxSource).toContain("layer.intent === 'burst-fire'");
    expect(layeredSource).toContain("layer.intent === 'burst-fire'");
    expect(fxSource).not.toContain("case 'gatling-overdrive'");
    expect(fxSource).not.toContain("case 'solar-laser'");

    expect(telegraphSource).toContain("beamTelegraph?.kind === 'dual-eye-beam'");
    expect(telegraphSource).not.toContain("recipe.abilityId === 'solar-laser'");
    expect(fighterSource).toContain('getCombatVfxPersistentRig');
    expect(fighterSource).not.toContain("entity.fighterId !== 'gunner'");
    expect(fighterSource).not.toContain("status.statusId === 'kill-zone-overdrive'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
