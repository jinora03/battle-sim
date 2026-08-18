import { describe, expect, it } from 'vitest';
import { getAbility } from '@kinetic/content';
import { getAbilityCombatAudioProfile } from '@kinetic/audio';
import { getAbilityCombatVfxProfile } from '@kinetic/visual-engine';
import {
  getChargePresentationProfile,
  resolveChargeTravelAbility,
  resolveChargeTravelWeaponPose,
  resolveChargeWeaponTipScale
} from '../packages/renderer-pixi/src/chargePresentation';
import {
  getChargedMeleeLaunchProfile,
  listChargedMeleeLaunchAbilityIds
} from '../packages/simulation/src/systems/chargedMeleeLaunchProfile';

describe('Stage 9D weapon-driven charged melee', () => {
  it('gives every authored melee charge an aggressive launch tier below MEGA BOMB', () => {
    const expected = [
      'driving-slash',
      'lance-charge',
      'breakthrough-charge',
      'glacier-charge',
      'bramble-charge',
      'solar-rush',
      'phase-lunge'
    ];
    expect(listChargedMeleeLaunchAbilityIds().sort()).toEqual([...expected].sort());

    for (const abilityId of expected) {
      const profile = getChargedMeleeLaunchProfile(abilityId);
      expect(profile, abilityId).not.toBeNull();
      if (!profile) continue;
      expect(profile.targetForceMultiplier, abilityId).toBeGreaterThan(1);
      expect(profile.targetImpulse.retention, abilityId).toBeGreaterThanOrEqual(0.992);
      expect(profile.targetImpulse.retention, abilityId).toBeLessThan(0.997);
      expect(profile.targetImpulse.maxSpeed, abilityId).toBeGreaterThanOrEqual(68);
      expect(profile.targetImpulse.maxSpeed, abilityId).toBeLessThan(72);
      expect(profile.targetImpulse.trailStrength, abilityId).toBe(1);
    }
  });

  it('keeps the charged weapon visibly leading during the post-cast travel window', () => {
    const cooling = (abilityId: string, cooldownTotalTicks = 200) => ({
      abilityId,
      phase: 'cooldown',
      cooldownTotalTicks,
      cooldownRemainingTicks: cooldownTotalTicks - 2
    });
    expect(resolveChargeTravelAbility('frost-warden', [{ statusId: 'cryo-guard' }], [cooling('glacier-charge')])).toBe('glacier-charge');
    expect(resolveChargeTravelAbility('thorn-colossus', [{ statusId: 'barkskin' }], [cooling('bramble-charge')])).toBe('bramble-charge');
    expect(resolveChargeTravelAbility('void-reaper', [{ statusId: 'phased' }], [cooling('phase-lunge')])).toBe('phase-lunge');
    expect(resolveChargeTravelAbility('iron-lancer', [{ statusId: 'lance-charge' }], [cooling('lance-charge')])).toBe('lance-charge');
    expect(resolveChargeTravelAbility('thorn-colossus', [{ statusId: 'barkskin' }], [cooling('regenerate')])).toBeNull();

    for (const abilityId of ['driving-slash', 'lance-charge', 'breakthrough-charge', 'glacier-charge', 'bramble-charge', 'phase-lunge']) {
      expect(resolveChargeTravelWeaponPose(abilityId, 50).x, abilityId).toBeGreaterThan(0);
    }
    expect(resolveChargeWeaponTipScale('spear')).toBeGreaterThan(resolveChargeWeaponTipScale('gauntlet'));
  });

  it('makes previously blink-fast melee charges readable before release', () => {
    expect(getAbility('glacier-charge').castTicks).toBe(42);
    expect(getAbility('bramble-charge').castTicks).toBe(46);
    expect(getAbility('solar-rush').castTicks).toBe(34);
    expect(getAbility('phase-lunge').castTicks).toBe(38);
    expect(getChargePresentationProfile('phase-lunge')).not.toBeNull();
  });

  it('keeps explicit buildup/release audio and VFX aligned for the new sword and spear charges', () => {
    for (const abilityId of ['driving-slash', 'lance-charge', 'breakthrough-charge']) {
      const audio = getAbilityCombatAudioProfile(abilityId);
      const vfx = getAbilityCombatVfxProfile(abilityId);
      expect(audio, `${abilityId} audio`).toBeDefined();
      expect(vfx, `${abilityId} VFX`).toBeDefined();
      expect(audio?.layers.anticipation, abilityId).toBeDefined();
      expect(audio?.layers.sustain?.anchor, abilityId).toBe('activated');
      expect(audio?.layers.activation?.intent, abilityId).toBe('knockback');
      expect(audio?.layers.release?.intent, abilityId).toBe('knockback');
      expect(vfx?.layers.some((layer) => layer.phase === 'anticipation'), abilityId).toBe(true);
      expect(vfx?.layers.some((layer) => layer.phase === 'release' && layer.intent === 'knockback'), abilityId).toBe(true);
    }
  });
});
