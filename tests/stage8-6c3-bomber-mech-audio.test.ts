import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_AUDIO_PALETTES,
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles,
  resolveCombatAudioLayer
} from '@kinetic/audio';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const BOMBER_ABILITIES = ['blast-dash', 'concussion-bomb', 'shrapnel-burst', 'mega-bomb'] as const;
const MECH_ABILITIES = ['kinetic-pulse', 'magnet-drag', 'fortify', 'reactor-overdrive'] as const;

describe('Stage 8.6C-3 Bomber and Mech Bruiser audio rollout', () => {
  it('registers complete intent profiles for both fighter kits', () => {
    const ids = new Set(listAbilityCombatAudioProfiles().map((profile) => profile.abilityId));
    for (const abilityId of [...BOMBER_ABILITIES, ...MECH_ABILITIES]) {
      expect(ids.has(abilityId), `${abilityId} should have an intent audio profile`).toBe(true);
      expect(getAbilityCombatAudioProfile(abilityId)?.layers.activation).toBeDefined();
    }
  });

  it('gives Bomber a reusable explosive palette and preserves the sound hierarchy', () => {
    expect(COMBAT_AUDIO_PALETTES).toContain('explosive');
    for (const abilityId of BOMBER_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('explosive');
    }

    expect(getAbilityCombatAudioProfile('blast-dash')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('concussion-bomb')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('shrapnel-burst')?.hierarchy).toBe('payoff');
    expect(getAbilityCombatAudioProfile('mega-bomb')?.hierarchy).toBe('ultimate');
  });

  it('builds Mega Bomb from arming tension through detonation and pressure release', () => {
    const profile = getAbilityCombatAudioProfile('mega-bomb');
    expect(profile).toBeDefined();

    expect(resolveCombatAudioLayer(profile!, 'anticipation', 66)).toMatchObject({
      palette: 'explosive', hierarchy: 'ultimate', intent: 'ultimate'
    });
    expect(resolveCombatAudioLayer(profile!, 'activation')).toMatchObject({ intent: 'explosion' });
    expect(resolveCombatAudioLayer(profile!, 'sustain')).toMatchObject({ intent: 'channel' });
    expect(resolveCombatAudioLayer(profile!, 'release')).toMatchObject({ intent: 'knockback' });
  });

  it('gives Mech distinct pulse, pull, armor-lock and reactor lifecycles', () => {
    for (const abilityId of MECH_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('mechanical');
    }

    expect(getAbilityCombatAudioProfile('kinetic-pulse')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('magnet-drag')?.layers.activation?.intent).toBe('pull');
    expect(getAbilityCombatAudioProfile('fortify')?.hierarchy).toBe('payoff');

    const overdrive = getAbilityCombatAudioProfile('reactor-overdrive');
    expect(overdrive).toMatchObject({ hierarchy: 'ultimate', palette: 'mechanical' });
    expect(resolveCombatAudioLayer(overdrive!, 'anticipation', 58)?.intent).toBe('ultimate');
    expect(resolveCombatAudioLayer(overdrive!, 'activation')?.intent).toBe('transformation');
    expect(resolveCombatAudioLayer(overdrive!, 'sustain')?.intent).toBe('channel');
    expect(resolveCombatAudioLayer(overdrive!, 'release')?.intent).toBe('transformation');
  });

  it('routes migrated abilities through profiles while retaining distinct basic-attack paths', () => {
    const source = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    for (const abilityId of [...BOMBER_ABILITIES, ...MECH_ABILITIES]) {
      expect(source).not.toContain(`id === '${abilityId}'`);
    }

    expect(source).toContain("event.weaponId === 'demolition-bomb'");
    expect(source).toContain("event.weaponId === 'hydraulic-gauntlet'");
    expect(source).toContain("layer.palette === 'explosive'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
