import { describe, expect, it } from 'vitest';
import { getPrimaryAttack } from '@kinetic/content';
import {
  resolveFighterAnatomy,
  resolveFighterArmPose,
  resolveHeldWeaponPoint,
  resolveHeldWeaponPose
} from '../packages/renderer-pixi/src/fighterAnatomy';

describe('Stage 9D held melee arm rig', () => {
  it('keeps one-handed melee arms attached from the anatomy shoulder to the weapon hand', () => {
    const anatomy = resolveFighterAnatomy(50);
    const sword = getPrimaryAttack('vanguard-longsword');
    const held = resolveHeldWeaponPose(sword, 50, Math.PI * 0.25, 1);

    expect(held).not.toBeNull();
    if (!held) return;

    const arm = resolveFighterArmPose(anatomy.rightShoulder, held.hand, 'right', 50);
    expect(arm.shoulder).toEqual(anatomy.rightShoulder);
    expect(arm.hand).toEqual(anatomy.rightHand);
    expect(Number.isFinite(arm.elbow.x)).toBe(true);
    expect(Number.isFinite(arm.elbow.y)).toBe(true);
    expect(Math.hypot(arm.elbow.x - arm.shoulder.x, arm.elbow.y - arm.shoulder.y)).toBeGreaterThan(0);
  });

  it('gives Iron Lancer a distinct left-hand support grip on the spear shaft', () => {
    const spear = getPrimaryAttack('war-spear');
    expect(spear.visualGrip?.hand).toBe('right');
    expect(spear.visualGrip?.support?.hand).toBe('left');

    const held = resolveHeldWeaponPose(spear, 50, 0, 1);
    expect(held).not.toBeNull();
    if (!held || !spear.visualGrip?.support) return;

    const support = resolveHeldWeaponPoint(
      spear,
      50,
      held,
      spear.visualGrip.support.x,
      spear.visualGrip.support.y ?? 0,
      1
    );

    expect(support.x).toBeGreaterThan(held.hand.x);
    const anatomy = resolveFighterAnatomy(50);
    const supportArm = resolveFighterArmPose(anatomy.leftShoulder, support, 'left', 50);
    expect(supportArm.shoulder).toEqual(anatomy.leftShoulder);
    expect(supportArm.hand).toEqual(support);
  });

  it('does not add a second hand to ordinary one-handed melee weapons', () => {
    for (const attackId of ['frost-halberd', 'hydraulic-gauntlet', 'solar-punch', 'void-scythe', 'thorn-claws', 'vanguard-longsword']) {
      expect(getPrimaryAttack(attackId).visualGrip?.support, attackId).toBeUndefined();
    }
  });
});
