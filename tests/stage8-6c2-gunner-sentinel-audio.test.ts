import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_AUDIO_ANCHORS,
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles,
  resolveCombatAudioContact,
  resolveCombatAudioLayer
} from '@kinetic/audio';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const GUNNER_ABILITIES = ['tactical-slide', 'suppressive-fire', 'pinning-round', 'kill-zone'] as const;
const SOLAR_SENTINEL_ABILITIES = ['solar-rush', 'thunder-clap', 'solar-aegis', 'solar-laser'] as const;

describe('Stage 8.6C-2 Gunner and Solar Sentinel audio rollout', () => {
  it('registers complete intent profiles for both fighter kits', () => {
    const ids = new Set(listAbilityCombatAudioProfiles().map((profile) => profile.abilityId));
    for (const abilityId of [...GUNNER_ABILITIES, ...SOLAR_SENTINEL_ABILITIES]) {
      expect(ids.has(abilityId), `${abilityId} should have an intent audio profile`).toBe(true);
      expect(getAbilityCombatAudioProfile(abilityId)?.layers.activation).toBeDefined();
    }
  });

  it('keeps the intended mechanical and solar identities and hierarchy', () => {
    for (const abilityId of GUNNER_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('mechanical');
    }
    for (const abilityId of SOLAR_SENTINEL_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('solar');
    }

    expect(getAbilityCombatAudioProfile('suppressive-fire')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('pinning-round')?.hierarchy).toBe('payoff');
    expect(getAbilityCombatAudioProfile('kill-zone')?.hierarchy).toBe('ultimate');
    expect(getAbilityCombatAudioProfile('solar-aegis')?.hierarchy).toBe('payoff');
    expect(getAbilityCombatAudioProfile('solar-laser')?.hierarchy).toBe('ultimate');
  });

  it('anchors Kill Zone firing phases to activation so spin-down follows the barrage', () => {
    expect(COMBAT_AUDIO_ANCHORS).toEqual(['activated', 'resolved']);
    const profile = getAbilityCombatAudioProfile('kill-zone');
    expect(profile).toBeDefined();

    const anticipation = resolveCombatAudioLayer(profile!, 'anticipation', 30);
    const activation = resolveCombatAudioLayer(profile!, 'activation', 30);
    const sustain = resolveCombatAudioLayer(profile!, 'sustain', 30);
    const release = resolveCombatAudioLayer(profile!, 'release', 30);

    expect(anticipation?.anchor).toBe('activated');
    expect(anticipation?.intent).toBe('transformation');
    expect(activation).toMatchObject({ anchor: 'activated', intent: 'burst-fire' });
    expect(sustain).toMatchObject({ anchor: 'activated', intent: 'burst-fire' });
    expect(release).toMatchObject({ anchor: 'activated', intent: 'transformation' });
    expect(release?.delaySeconds ?? 0).toBeGreaterThan(
      (sustain?.delaySeconds ?? 0) + (sustain?.durationSeconds ?? 0) * 0.75
    );
  });

  it('separates Solar Eye Beams charge, ignition, sustain, contact and shutdown', () => {
    const profile = getAbilityCombatAudioProfile('solar-laser');
    expect(profile).toBeDefined();

    const anticipation = resolveCombatAudioLayer(profile!, 'anticipation', 210);
    const activation = resolveCombatAudioLayer(profile!, 'activation', 210);
    const sustain = resolveCombatAudioLayer(profile!, 'sustain', 210);
    const release = resolveCombatAudioLayer(profile!, 'release', 210);
    const contact = resolveCombatAudioContact(profile!);

    expect(anticipation).toMatchObject({ anchor: 'activated', intent: 'ultimate' });
    expect(activation).toMatchObject({ anchor: 'activated', intent: 'beam' });
    expect(sustain).toMatchObject({ anchor: 'activated', intent: 'beam' });
    expect(release).toMatchObject({ anchor: 'resolved', intent: 'beam' });
    expect(activation?.delaySeconds).toBeGreaterThanOrEqual(0.75);
    expect(sustain?.delaySeconds).toBeGreaterThan(activation?.delaySeconds ?? 0);
    expect(contact).toMatchObject({ abilityId: 'solar-laser', intent: 'beam' });
    expect(contact?.intervalMs).toBeGreaterThanOrEqual(60);
  });

  it('routes migrated abilities through profiles and tracks real channel contact damage', () => {
    const source = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    for (const abilityId of [...GUNNER_ABILITIES, ...SOLAR_SENTINEL_ABILITIES]) {
      expect(source).not.toContain(`id === '${abilityId}'`);
    }
    expect(source).toContain('activeContactAbilities');
    expect(source).toContain('resolveCombatAudioContact');
    expect(source).toContain("event.type !== 'damage'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.13-stage8.6c3');
    expect(ENGINE_VERSION).toBe('1.3.13-stage8.6c3');
  });
});
