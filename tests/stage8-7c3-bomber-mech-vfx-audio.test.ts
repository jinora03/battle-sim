import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAbilityCombatAudioProfile, resolveCombatAudioLayer } from '@kinetic/audio';
import {
  getAbilityCombatVfxProfile,
  resolveCombatVfxLayer
} from '@kinetic/visual-engine';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const bomberAbilities = ['blast-dash', 'concussion-bomb', 'shrapnel-burst', 'mega-bomb'] as const;
const mechAbilities = ['kinetic-pulse', 'magnet-drag', 'fortify', 'reactor-overdrive'] as const;

describe('Stage 8.7C-3 Bomber and Mech VFX plus Mega Bomb audio retune', () => {
  it('profiles the complete Bomber and Mech kits', () => {
    for (const abilityId of [...bomberAbilities, ...mechAbilities]) {
      expect(getAbilityCombatVfxProfile(abilityId), abilityId).toBeDefined();
    }
  });

  it('gives Bomber a readable explosive hierarchy', () => {
    const dash = getAbilityCombatVfxProfile('blast-dash');
    const concussion = getAbilityCombatVfxProfile('concussion-bomb');
    const shrapnel = getAbilityCombatVfxProfile('shrapnel-burst');
    const mega = getAbilityCombatVfxProfile('mega-bomb');

    expect(dash?.layers.map((layer) => layer.intent)).toEqual(['dash', 'dash', 'channel', 'explosion']);
    expect(concussion?.layers.map((layer) => layer.intent)).toEqual(['explosion', 'explosion', 'knockback']);
    expect(shrapnel).toMatchObject({ hierarchy: 'payoff', palette: 'neutral' });
    expect(shrapnel?.layers.map((layer) => layer.intent)).toEqual(['transformation', 'explosion', 'burst-fire', 'knockback']);
    expect(mega).toMatchObject({ hierarchy: 'ultimate', palette: 'neutral' });
    expect(resolveCombatVfxLayer(mega!, 'activation')?.radiusScale).toBeGreaterThan(1.3);
    expect(resolveCombatVfxLayer(mega!, 'sustain')?.durationSeconds).toBeGreaterThanOrEqual(0.7);
  });

  it('gives Mech pulse, pull, armor-lock and overdrive lifecycles', () => {
    const pulse = getAbilityCombatVfxProfile('kinetic-pulse');
    const drag = getAbilityCombatVfxProfile('magnet-drag');
    const fortify = getAbilityCombatVfxProfile('fortify');
    const overdrive = getAbilityCombatVfxProfile('reactor-overdrive');

    expect(pulse?.layers.map((layer) => layer.intent)).toEqual(['transformation', 'explosion', 'knockback']);
    expect(drag?.layers.map((layer) => layer.intent)).toEqual(['pull', 'pull', 'channel', 'knockback']);
    expect(fortify).toMatchObject({ hierarchy: 'payoff', palette: 'metal' });
    expect(fortify?.layers.map((layer) => layer.intent)).toEqual(['transformation', 'transformation', 'status', 'knockback']);
    expect(overdrive).toMatchObject({ hierarchy: 'ultimate', palette: 'metal' });
    expect(resolveCombatVfxLayer(overdrive!, 'sustain')?.durationSeconds).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps directional punts explicit and radial blast pressure generic', () => {
    const downbeat = resolveCombatVfxLayer(getAbilityCombatVfxProfile('downbeat')!, 'activation');
    const concussionRelease = resolveCombatVfxLayer(getAbilityCombatVfxProfile('concussion-bomb')!, 'release');
    expect(downbeat?.directional).toBe(true);
    expect(concussionRelease?.directional).toBe(false);

    const fxSource = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const layeredSource = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');
    expect(fxSource).toContain('if (layer.directional)');
    expect(fxSource).toContain("layer.intent === 'explosion'");
    expect(layeredSource).toContain("layer.palette === 'neutral'");
    expect(layeredSource).toContain("layer.palette === 'metal'");
  });

  it('retunes Mega Bomb with a reusable low-register catastrophic detonation', () => {
    const profile = getAbilityCombatAudioProfile('mega-bomb');
    const activation = resolveCombatAudioLayer(profile!, 'activation');
    expect(activation).toMatchObject({
      hierarchy: 'ultimate',
      intent: 'explosion',
      variant: 'cataclysmic-explosion'
    });

    const audioSource = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(audioSource).toContain("layer.variant === 'cataclysmic-explosion'");
    expect(audioSource).toContain('playCataclysmicExplosion');
    expect(audioSource).toContain("filter.type = 'lowpass'");
    expect(audioSource).toContain('filter.frequency.setValueAtTime(420');
    expect(audioSource).not.toContain("layer.abilityId === 'mega-bomb'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
