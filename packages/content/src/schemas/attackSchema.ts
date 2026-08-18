import type { PrimaryAttackBehavior } from '@kinetic/protocol';
import type { ProjectileDefinition } from './projectileSchema';

export type AttackForm =
  | 'sword'
  | 'spear'
  | 'hammer'
  | 'axe'
  | 'claws'
  | 'rifle'
  | 'launcher'
  | 'shield'
  | 'gauntlet'
  | 'fire'
  | 'water'
  | 'ice'
  | 'lightning'
  | 'nature'
  | 'void';

export type PrimaryAttackStyle =
  | 'swing'
  | 'thrust'
  | 'overhead'
  | 'spin'
  | 'shot'
  | 'burst'
  | 'lob'
  | 'orbit'
  | 'slam'
  | 'stream';
/** @deprecated Use PrimaryAttackStyle. */
export type WeaponAttackStyle = PrimaryAttackStyle;

export type WeaponVisualMountSide = 'center' | 'left' | 'right';

/**
 * Presentation-only primary weapon socket. Offsets are expressed in fighter
 * radii so the same definition scales cleanly with fighter size. Multiple
 * mounts naturally support dual wielding without changing combat hit origins.
 */
export interface WeaponVisualMountDefinition {
  id: string;
  side: WeaponVisualMountSide;
  forwardOffset?: number;
  lateralOffset?: number;
  scale?: number;
  rotationDegrees?: number;
}

export type WeaponVisualHand = 'left' | 'right';

/**
 * Presentation-only grip point for weapons that are visibly held by a fighter.
 * x/y are normalized to the rendered weapon size (fighter radius * visualScale),
 * not fighter space. The renderer aligns this grip to the requested anatomy hand
 * socket, so changing weapon length does not move the hand attachment.
 */
export interface WeaponVisualSupportGripDefinition {
  hand: WeaponVisualHand;
  x: number;
  y?: number;
}

export interface WeaponVisualGripDefinition {
  hand: WeaponVisualHand;
  x: number;
  y?: number;
  rotationDegrees?: number;
  /** Optional second hand that reaches to another point on the same weapon. */
  support?: WeaponVisualSupportGripDefinition;
}

export interface PrimaryAttackDefinition {
  id: string;
  name: string;
  form: AttackForm;
  behavior: PrimaryAttackBehavior;
  /** @deprecated Runtime compatibility alias for behavior. */
  category: PrimaryAttackBehavior;
  style: PrimaryAttackStyle;
  range: number;
  minRange: number;
  damage: number;
  knockback: number;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  cooldownTicks: number;
  attackAngleDegrees: number;
  /** Exaggerated top-down silhouette scale. */
  visualScale: number;
  /** Distance from fighter center to the visible ranged muzzle, in fighter radii. */
  muzzleOffsetScale?: number;
  /** Visual-only generic sockets; simulation attack origin remains fighter-centered. */
  visualMounts?: WeaponVisualMountDefinition[];
  /** Optional anatomy-aware grip used by visually held weapons. */
  visualGrip?: WeaponVisualGripDefinition;
  /** Number of deterministic shots released during one attack. */
  burstCount?: number;
  /** Simulation ticks between burst shots. */
  burstIntervalTicks?: number;
  /** Total angular spread across the burst. */
  spreadDegrees?: number;
  /** Re-arms per-target contact for sustained attacks. */
  repeatHitIntervalTicks?: number;
  projectile?: ProjectileDefinition;
  onHitStatuses?: Array<{ statusId: string; durationTicks: number; stacks?: number }>;
  movementAllowed: boolean;
  friendlyFire: boolean;
  visualId: string;
  audioId: string;
}
/** @deprecated Use PrimaryAttackDefinition. */
export type WeaponDefinition = PrimaryAttackDefinition;
