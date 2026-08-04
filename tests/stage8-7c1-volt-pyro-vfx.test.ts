import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getAbilityCombatVfxProfile,
  listAbilityCombatVfxProfiles,
  resolveCombatVfxLayer
} from '@kinetic/visual-engine';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const voltAbilityIds = ['lightning-dash', 'arc-burst', 'polarity-pull', 'thunder-dome'] as const;
const pyroAbilityIds = ['magma-dash', 'flame-ring', 'molten-guard', 'inferno-collapse'] as const;

describe('Stage 8.7C-1 Volt and Pyro intent VFX', () => {
  it('profiles the complete Volt and Pyro kits', () => {
    for (const abilityId of [...voltAbilityIds, ...pyroAbilityIds]) {
      expect(getAbilityCombatVfxProfile(abilityId), abilityId).toBeDefined();
    }
    expect(listAbilityCombatVfxProfiles()).toEqual(expect.arrayContaining(
      [...voltAbilityIds, ...pyroAbilityIds].map((abilityId) => expect.objectContaining({ abilityId }))
    ));
  });

  it('keeps Volt mobility, control and payoff roles visually distinct', () => {
    const dash = getAbilityCombatVfxProfile('lightning-dash');
    const burst = getAbilityCombatVfxProfile('arc-burst');
    const pull = getAbilityCombatVfxProfile('polarity-pull');
    const dome = getAbilityCombatVfxProfile('thunder-dome');

    expect(dash?.layers.map((layer) => layer.intent)).toEqual(['dash', 'dash', 'channel', 'status']);
    expect(burst?.layers.map((layer) => layer.intent)).toEqual(['explosion', 'explosion', 'status']);
    expect(pull).toMatchObject({ hierarchy: 'payoff', palette: 'electric' });
    expect(pull?.layers.map((layer) => layer.intent)).toEqual(['pull', 'pull', 'channel', 'explosion']);
    expect(dome?.hierarchy).toBe('ultimate');

    const pullActivation = resolveCombatVfxLayer(pull!, 'activation');
    expect(pullActivation?.intent).toBe('pull');
    expect(pullActivation?.radiusScale).toBeGreaterThan(1);
  });

  it('gives Pyro a readable dash, vortex, combustion and transformation hierarchy', () => {
    const dash = getAbilityCombatVfxProfile('magma-dash');
    const vortex = getAbilityCombatVfxProfile('flame-ring');
    const combustion = getAbilityCombatVfxProfile('molten-guard');
    const meltdown = getAbilityCombatVfxProfile('inferno-collapse');

    expect(dash?.hierarchy).toBe('skill');
    expect(vortex?.layers.map((layer) => layer.intent)).toEqual(['pull', 'pull', 'channel', 'status']);
    expect(combustion).toMatchObject({ hierarchy: 'payoff', palette: 'fire' });
    expect(combustion?.layers.map((layer) => layer.intent)).toEqual(['explosion', 'explosion', 'status', 'knockback']);
    expect(meltdown).toMatchObject({ hierarchy: 'ultimate', palette: 'fire' });
    expect(meltdown?.layers.map((layer) => layer.intent)).toEqual(['transformation', 'explosion', 'transformation', 'status']);
    expect(resolveCombatVfxLayer(meltdown!, 'sustain')?.durationSeconds).toBeGreaterThan(0.6);
  });

  it('renders pull compression generically in full and budgeted paths', () => {
    const fxSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const layeredSource = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');

    expect(fxSource).toContain('private inwardBurst');
    expect(fxSource).toContain("layer.intent === 'pull'");
    expect(fxSource).toContain('playProfiledBlast');
    expect(layeredSource).toContain('private spawnInwardResidualBurst');
    expect(layeredSource).toContain("activation?.intent === 'pull'");

    for (const abilityId of ['flame-ring', 'molten-guard', 'inferno-collapse']) {
      expect(fxSource).not.toContain(`event.abilityId === '${abilityId}'`);
    }
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.17-stage8.7c1');
    expect(ENGINE_VERSION).toBe('1.3.17-stage8.7c1');
  });
});
