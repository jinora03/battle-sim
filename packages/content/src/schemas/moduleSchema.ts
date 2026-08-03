import type { ModuleSlot } from '@kinetic/protocol';
import type { MountedAttachmentDefinition } from './attachmentSchema';

export interface PeriodicStatusPulseDefinition {
  statusId: string;
  radius: number;
  intervalTicks: number;
  durationTicks: number;
  stacks: number;
  resourceId?: string;
  minimumResource?: number;
}

export interface PrimaryConeChannelDefinition {
  /** Total active channel duration after the normal primary windup. */
  activeTicks: number;
  /** Damage/knockback pulse cadence while the channel is active. */
  hitIntervalTicks: number;
  /** Apply the primary's on-hit statuses every N channel pulses. */
  statusIntervalHits: number;
  /** Multiplies the base primary range for cone queries. */
  rangeMultiplier: number;
  /** Full cone width in degrees. */
  angleDegrees: number;
  /** Per-pulse direct damage relative to the base primary damage. */
  damageMultiplier: number;
  /** Per-pulse knockback relative to the base primary knockback. */
  knockbackMultiplier: number;
  /** Locomotion acceleration retained while channeling. */
  movementMultiplier: number;
}

export interface FighterModuleDefinition {
  id: string;
  name: string;
  description: string;
  slot: ModuleSlot;
  compatibleFighterIds: string[];
  /** Zero or more visible components mounted by this module. */
  attachments?: MountedAttachmentDefinition[];
  modifiers: {
    primaryDamageMultiplier?: number;
    primaryKnockbackMultiplier?: number;
    primaryCooldownMultiplier?: number;
    primaryProjectileBounce?: number;
    primaryProjectileMaxWallBounces?: number;
    primaryProjectilePenetration?: number;
    /** Replaces projectile firing with a deterministic pulsed cone channel. */
    primaryConeChannel?: PrimaryConeChannelDefinition;
    statusDurationMultiplier?: Record<string, number>;
    /** Adds deterministic stacks when this fighter applies the named status to an enemy. */
    statusStacksAppliedBonus?: Record<string, number>;
    skillProjectileHomingMultiplier?: number;
    skillProjectileDamageMultiplier?: number;
    /** Per-ability action multipliers keyed by stable ability id. */
    abilityDamageMultiplier?: Record<string, number>;
    abilityImpulseMultiplier?: Record<string, number>;
    abilityRadiusMultiplier?: Record<string, number>;
    abilitySelfImpulseMultiplier?: Record<string, number>;
    /** Generic fighter-resource tuning keyed by resource id. */
    resourceGainMultiplier?: Record<string, number>;
    resourceDecayMultiplier?: Record<string, number>;
    resourceThresholdIncomingDamageMultiplier?: {
      resourceId: string;
      thresholdRatio: number;
      multiplier: number;
    };
    /** Deterministic module-owned status pulses centered on the equipped fighter. */
    periodicStatusPulses?: PeriodicStatusPulseDefinition[];
    incomingDamageMultiplier?: number;
    incomingKnockbackMultiplier?: number;
    moveAccelerationMultiplier?: number;
    maxSpeedMultiplier?: number;
  };
}

export interface ResolvedFighterLoadout {
  moduleIds: string[];
  modules: FighterModuleDefinition[];
  mountedAttachments: MountedAttachmentDefinition[];
  primaryDamageMultiplier: number;
  primaryKnockbackMultiplier: number;
  primaryCooldownMultiplier: number;
  primaryProjectileBounce: number;
  primaryProjectileMaxWallBounces: number;
  primaryProjectilePenetration: number;
  primaryConeChannel: PrimaryConeChannelDefinition | null;
  statusDurationMultiplier: Record<string, number>;
  statusStacksAppliedBonus: Record<string, number>;
  skillProjectileHomingMultiplier: number;
  skillProjectileDamageMultiplier: number;
  abilityDamageMultiplier: Record<string, number>;
  abilityImpulseMultiplier: Record<string, number>;
  abilityRadiusMultiplier: Record<string, number>;
  abilitySelfImpulseMultiplier: Record<string, number>;
  resourceGainMultiplier: Record<string, number>;
  resourceDecayMultiplier: Record<string, number>;
  resourceThresholdIncomingDamageMultiplier: {
    resourceId: string;
    thresholdRatio: number;
    multiplier: number;
  } | null;
  periodicStatusPulses: PeriodicStatusPulseDefinition[];
  incomingDamageMultiplier: number;
  incomingKnockbackMultiplier: number;
  moveAccelerationMultiplier: number;
  maxSpeedMultiplier: number;
}
