import type { PrimaryAttackDefinition, WeaponVisualHand } from '@kinetic/content';

export interface FighterAnatomyPoint {
  x: number;
  y: number;
}

export interface FighterAnatomyPose {
  center: FighterAnatomyPoint;
  front: FighterAnatomyPoint;
  rear: FighterAnatomyPoint;
  leftShoulder: FighterAnatomyPoint;
  rightShoulder: FighterAnatomyPoint;
  leftHand: FighterAnatomyPoint;
  rightHand: FighterAnatomyPoint;
}

export interface HeldWeaponPose {
  x: number;
  y: number;
  rotation: number;
  hand: FighterAnatomyPoint;
  shoulder: FighterAnatomyPoint;
}

export interface FighterArmPose {
  shoulder: FighterAnatomyPoint;
  elbow: FighterAnatomyPoint;
  hand: FighterAnatomyPoint;
}

/**
 * Canonical top-down fighter anatomy in local fighter space.
 * +X is front, -X is rear, -Y is left and +Y is right.
 * These sockets scale only from fighter radius and are presentation-only.
 */
export function resolveFighterAnatomy(radius: number): FighterAnatomyPose {
  return {
    center: { x: 0, y: 0 },
    front: { x: radius * 0.88, y: 0 },
    rear: { x: -radius * 0.88, y: 0 },
    leftShoulder: { x: radius * 0.12, y: -radius * 0.58 },
    rightShoulder: { x: radius * 0.12, y: radius * 0.58 },
    leftHand: { x: radius * 0.42, y: -radius * 0.82 },
    rightHand: { x: radius * 0.42, y: radius * 0.82 }
  };
}

export function resolveAnatomyHand(
  anatomy: FighterAnatomyPose,
  hand: WeaponVisualHand
): { hand: FighterAnatomyPoint; shoulder: FighterAnatomyPoint } {
  return hand === 'left'
    ? { hand: anatomy.leftHand, shoulder: anatomy.leftShoulder }
    : { hand: anatomy.rightHand, shoulder: anatomy.rightShoulder };
}

/**
 * Align a weapon's explicit grip point to an anatomy hand socket. The weapon
 * can rotate freely around that grip without its handle drifting away from the
 * hand. animationRotation is relative to the weapon's rest rotation.
 */
export function resolveHeldWeaponPose(
  attack: Pick<PrimaryAttackDefinition, 'visualScale' | 'visualGrip'>,
  fighterRadius: number,
  animationRotation = 0,
  renderScale = 1,
  motionOffset: FighterAnatomyPoint = { x: 0, y: 0 }
): HeldWeaponPose | null {
  const grip = attack.visualGrip;
  if (!grip) return null;

  const anatomy = resolveFighterAnatomy(fighterRadius);
  const socket = resolveAnatomyHand(anatomy, grip.hand);
  const weaponSize = fighterRadius * attack.visualScale * renderScale;
  const rotation = (grip.rotationDegrees ?? 0) * Math.PI / 180 + animationRotation;
  const gripX = grip.x * weaponSize;
  const gripY = (grip.y ?? 0) * weaponSize;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotatedGripX = gripX * cos - gripY * sin;
  const rotatedGripY = gripX * sin + gripY * cos;

  return {
    x: socket.hand.x + motionOffset.x - rotatedGripX,
    y: socket.hand.y + motionOffset.y - rotatedGripY,
    rotation,
    hand: socket.hand,
    shoulder: socket.shoulder
  };
}


/** Resolve a stable top-down elbow between an anatomy shoulder and a target hand. */
export function resolveFighterArmPose(
  shoulder: FighterAnatomyPoint,
  hand: FighterAnatomyPoint,
  side: WeaponVisualHand,
  fighterRadius: number
): FighterArmPose {
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const bend = fighterRadius * 0.1 * (side === 'right' ? 1 : -1);
  return {
    shoulder,
    elbow: {
      x: shoulder.x + dx * 0.5 + nx * bend,
      y: shoulder.y + dy * 0.5 + ny * bend
    },
    hand
  };
}

/** Transform a normalized point on a held weapon into fighter-local space. */
export function resolveHeldWeaponPoint(
  attack: Pick<PrimaryAttackDefinition, 'visualScale'>,
  fighterRadius: number,
  pose: Pick<HeldWeaponPose, 'x' | 'y' | 'rotation'>,
  normalizedX: number,
  normalizedY = 0,
  renderScale = 1
): FighterAnatomyPoint {
  const weaponSize = fighterRadius * attack.visualScale * renderScale;
  const localX = normalizedX * weaponSize;
  const localY = normalizedY * weaponSize;
  const cos = Math.cos(pose.rotation);
  const sin = Math.sin(pose.rotation);
  return {
    x: pose.x + localX * cos - localY * sin,
    y: pose.y + localX * sin + localY * cos
  };
}
