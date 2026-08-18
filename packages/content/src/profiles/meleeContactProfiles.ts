import type { PrimaryAttackDefinition } from '../schemas/attackSchema';

export interface MeleeContactProfile {
  handForwardRadius: number;
  handLateralRadius: number;
  tipScale: number;
  widthRadius: number;
}

const TIP_SCALE_BY_FORM: Readonly<Record<string, number>> = {
  sword: 2.16,
  spear: 1.78,
  axe: 1.68,
  hammer: 1.62,
  void: 1.58,
  claws: 1.42,
  gauntlet: 1.46
};

const WIDTH_BY_FORM: Readonly<Record<string, number>> = {
  sword: 0.28,
  spear: 0.2,
  axe: 0.24,
  hammer: 0.28,
  void: 0.2,
  claws: 0.24,
  gauntlet: 0.32
};

/**
 * Deterministic top-down contact envelope matching the anatomy-driven weapon
 * presentation. +X is front and +Y is the fighter's right hand.
 *
 * This deliberately does not depend on Pixi. The simulation and AI can reason
 * about the visible held weapon without importing renderer code.
 */
export function getMeleeContactProfile(
  attack: Pick<PrimaryAttackDefinition, 'behavior' | 'form' | 'visualGrip'>
): MeleeContactProfile | null {
  if (!['melee', 'slam', 'spin'].includes(attack.behavior) || !attack.visualGrip) return null;
  const handSign = attack.visualGrip.hand === 'left' ? -1 : 1;
  return {
    handForwardRadius: 0.42,
    handLateralRadius: 0.82 * handSign,
    tipScale: TIP_SCALE_BY_FORM[attack.form] ?? 1.5,
    widthRadius: WIDTH_BY_FORM[attack.form] ?? 0.2
  };
}

export function resolveMeleeContactReach(
  attack: Pick<PrimaryAttackDefinition, 'behavior' | 'form' | 'visualGrip' | 'visualScale'>,
  sourceRadius: number,
  targetRadius = 0,
  reachMultiplier = 1
): number {
  const profile = getMeleeContactProfile(attack);
  if (!profile) return 0;
  const gripX = attack.visualGrip?.x ?? 0;
  const weaponLength = Math.max(0.35, profile.tipScale - gripX)
    * sourceRadius
    * attack.visualScale
    * Math.max(0.1, reachMultiplier);
  const forward = profile.handForwardRadius * sourceRadius + weaponLength;
  const lateral = profile.handLateralRadius * sourceRadius;
  const width = profile.widthRadius * sourceRadius;
  return Math.hypot(forward, lateral) + width + targetRadius;
}
