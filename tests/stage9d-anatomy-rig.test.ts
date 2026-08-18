import { describe, expect, it } from 'vitest';
import { getPrimaryAttack } from '@kinetic/content';
import {
  resolveFighterAnatomy,
  resolveHeldWeaponPose
} from '../packages/renderer-pixi/src/fighterAnatomy';
import { resolvePrimaryAttackVisualMounts } from '../packages/renderer-pixi/src/weaponMounts';

describe('Stage 9D fighter anatomy rig', () => {
  it('defines one canonical local anatomy: +X front, +Y right', () => {
    const anatomy = resolveFighterAnatomy(50);
    expect(anatomy.front.x).toBeGreaterThan(0);
    expect(anatomy.front.y).toBe(0);
    expect(anatomy.rear.x).toBeLessThan(0);
    expect(anatomy.rightShoulder.y).toBeGreaterThan(0);
    expect(anatomy.rightHand.y).toBeGreaterThan(anatomy.rightShoulder.y);
    expect(anatomy.leftShoulder.y).toBeLessThan(0);
    expect(anatomy.leftHand.y).toBeLessThan(anatomy.leftShoulder.y);
  });

  it('attaches current melee weapon grips to the anatomy right hand without changing generic mounts', () => {
    for (const attackId of [
      'frost-halberd',
      'hydraulic-gauntlet',
      'solar-punch',
      'void-scythe',
      'thorn-claws',
      'vanguard-longsword',
      'war-spear'
    ]) {
      const attack = getPrimaryAttack(attackId);
      expect(attack.visualGrip?.hand, attackId).toBe('right');
      expect(resolvePrimaryAttackVisualMounts(attack).map((mount) => mount.side), attackId).toEqual(['center']);

      const anatomy = resolveFighterAnatomy(50);
      const pose = resolveHeldWeaponPose(attack, 50, 0, 1);
      expect(pose, attackId).not.toBeNull();
      if (!pose || !attack.visualGrip) continue;

      const size = 50 * attack.visualScale;
      const gripX = pose.x + attack.visualGrip.x * size;
      const gripY = pose.y + (attack.visualGrip.y ?? 0) * size;
      expect(gripX, attackId).toBeCloseTo(anatomy.rightHand.x, 6);
      expect(gripY, attackId).toBeCloseTo(anatomy.rightHand.y, 6);
    }
  });

  it('keeps a rotating weapon pinned to its hand through the explicit grip', () => {
    const attack = getPrimaryAttack('vanguard-longsword');
    const anatomy = resolveFighterAnatomy(50);
    const rotation = Math.PI * 0.72;
    const pose = resolveHeldWeaponPose(attack, 50, rotation, 1);
    expect(pose).not.toBeNull();
    if (!pose || !attack.visualGrip) return;

    const size = 50 * attack.visualScale;
    const gx = attack.visualGrip.x * size;
    const gy = (attack.visualGrip.y ?? 0) * size;
    const cos = Math.cos(pose.rotation);
    const sin = Math.sin(pose.rotation);
    const worldGripX = pose.x + gx * cos - gy * sin;
    const worldGripY = pose.y + gx * sin + gy * cos;
    expect(worldGripX).toBeCloseTo(anatomy.rightHand.x, 6);
    expect(worldGripY).toBeCloseTo(anatomy.rightHand.y, 6);
  });

  it('removes hidden auto-rotation from generic right-side mounts', () => {
    const [right] = resolvePrimaryAttackVisualMounts({
      style: 'swing',
      visualMounts: [{ id: 'right-test', side: 'right' }]
    });
    expect(right?.rotationRadians).toBe(0);
  });
});
