import { describe, expect, it } from 'vitest';
import { getAbility } from '@kinetic/content';
import {
  getChargePresentationProfile,
  resolveChargeBodyPose,
  resolveChargeReleasePose,
  resolveChargeShake,
  resolveChargeWeaponPose
} from '../packages/renderer-pixi/src/chargePresentation';

describe('Stage 9D anatomy-driven charge presentation', () => {
  it('provides distinct charge identities for the intended force fighters', () => {
    const expected = new Map([
      ['driving-slash', 'sweep'],
      ['lance-charge', 'brace'],
      ['breakthrough-charge', 'brace'],
      ['blast-dash', 'unstable'],
      ['lightning-dash', 'electric'],
      ['bramble-charge', 'heavy'],
      ['solar-rush', 'heavy'],
      ['kinetic-pulse', 'heavy'],
      ['downbeat', 'gravity'],
      ['glacier-charge', 'steady'],
      ['phase-lunge', 'gravity']
    ] as const);

    for (const [abilityId, kind] of expected) {
      expect(getChargePresentationProfile(abilityId)?.kind, abilityId).toBe(kind);
    }
  });

  it('makes the sword load backward while the lancer braces straight', () => {
    const sword = getChargePresentationProfile('driving-slash')!;
    const lance = getChargePresentationProfile('lance-charge')!;
    const swordPose = resolveChargeWeaponPose(sword, 1, 50);
    const lancePose = resolveChargeWeaponPose(lance, 1, 50);

    expect(swordPose.x).toBeLessThan(-5);
    expect(swordPose.rotation).toBeGreaterThan(2);
    expect(lancePose.x).toBeLessThan(-7);
    expect(Math.abs(lancePose.rotation)).toBeLessThan(0.001);
  });

  it('continues the loaded sword into a short release sweep and spear thrust', () => {
    const swordStart = resolveChargeReleasePose([{ statusId: 'driving-slash', remainingTicks: 96 }], 50);
    const swordMid = resolveChargeReleasePose([{ statusId: 'driving-slash', remainingTicks: 90 }], 50);
    const lanceStart = resolveChargeReleasePose([{ statusId: 'lance-charge', remainingTicks: 110 }], 50);

    expect(swordStart?.rotation).toBeCloseTo(2.35, 6);
    expect(swordMid?.rotation).toBeLessThan(swordStart?.rotation ?? 0);
    expect(lanceStart?.rotation).toBe(0);
    expect(resolveChargeReleasePose([{ statusId: 'driving-slash', remainingTicks: 80 }], 50)).toBeNull();
  });

  it('builds body tension and deterministic directional shake without altering gameplay force', () => {
    const profile = getChargePresentationProfile('breakthrough-charge')!;
    const body = resolveChargeBodyPose(profile, 1);
    expect(body.scaleX).toBeLessThan(1);
    expect(body.scaleY).toBeGreaterThan(1);

    const shake = resolveChargeShake(profile, { x: 1, y: 0 }, 1.25, 1, 50, false);
    expect(Math.hypot(shake.x, shake.y)).toBeGreaterThan(0);
    expect(resolveChargeShake(profile, { x: 1, y: 0 }, 1.25, 1, 50, true)).toEqual({ x: 0, y: 0 });

    expect(getAbility('driving-slash').castTicks).toBe(48);
    expect(getAbility('lance-charge').castTicks).toBe(56);
    expect(getAbility('breakthrough-charge').castTicks).toBe(72);
  });
});
