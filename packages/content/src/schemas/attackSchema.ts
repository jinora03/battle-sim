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
