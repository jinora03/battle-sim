import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_AUDIO_HIERARCHY_GAIN,
  COMBAT_AUDIO_INTENTS,
  COMBAT_AUDIO_PHASES,
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles,
  resolveCombatAudioLayer
} from '@kinetic/audio';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

describe('Stage 8.6A intent-based combat audio', () => {
  it('defines the shared four-layer combat-audio lifecycle', () => {
    expect(COMBAT_AUDIO_PHASES).toEqual(['anticipation', 'activation', 'sustain', 'release']);
    expect(COMBAT_AUDIO_INTENTS).toEqual(expect.arrayContaining([
      'projectile',
      'burst-fire',
      'beam',
      'explosion',
      'pull',
      'knockback',
      'transformation',
      'channel',
      'status-application',
      'ultimate'
    ]));
  });

  it('keeps a strict loudness hierarchy from basic attacks to ultimates', () => {
    expect(COMBAT_AUDIO_HIERARCHY_GAIN.basic).toBeLessThan(COMBAT_AUDIO_HIERARCHY_GAIN.skill);
    expect(COMBAT_AUDIO_HIERARCHY_GAIN.skill).toBeLessThan(COMBAT_AUDIO_HIERARCHY_GAIN.payoff);
    expect(COMBAT_AUDIO_HIERARCHY_GAIN.payoff).toBeLessThan(COMBAT_AUDIO_HIERARCHY_GAIN.ultimate);
  });

  it('registers Thunder Dome as the first complete reference profile', () => {
    const profile = getAbilityCombatAudioProfile('thunder-dome');
    expect(profile).toMatchObject({
      abilityId: 'thunder-dome',
      palette: 'electric',
      hierarchy: 'ultimate'
    });
    expect(Object.keys(profile?.layers ?? {}).sort()).toEqual([...COMBAT_AUDIO_PHASES].sort());
    expect(profile?.layers.anticipation?.intent).toBe('ultimate');
    expect(profile?.layers.activation?.intent).toBe('explosion');
    expect(profile?.layers.sustain?.intent).toBe('channel');
    expect(profile?.layers.release?.intent).toBe('status-application');
    expect(listAbilityCombatAudioProfiles()).toContain(profile);
  });

  it('normalizes profile timing and hierarchy gain without simulation state', () => {
    const profile = getAbilityCombatAudioProfile('thunder-dome');
    expect(profile).toBeDefined();
    const anticipation = resolveCombatAudioLayer(profile!, 'anticipation', 58);
    const sustain = resolveCombatAudioLayer(profile!, 'sustain');

    expect(anticipation).toMatchObject({
      abilityId: 'thunder-dome',
      phase: 'anticipation',
      palette: 'electric',
      hierarchy: 'ultimate',
      intent: 'ultimate',
      gainScale: 1
    });
    expect(anticipation?.durationSeconds).toBeGreaterThan(0.5);
    expect(sustain?.delaySeconds).toBeGreaterThan(0);
    expect(resolveCombatAudioLayer(profile!, 'release')?.gainScale).toBeLessThan(1);
  });

  it('routes profiled abilities through generic intent playback instead of an ability-id sound branch', () => {
    const source = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('getAbilityCombatAudioProfile');
    expect(source).toContain('playCombatAudioLayer');
    expect(source).not.toContain("id === 'thunder-dome'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.14-stage8.6d');
    expect(ENGINE_VERSION).toBe('1.3.14-stage8.6d');
  });
});
