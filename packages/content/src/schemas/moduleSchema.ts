import type { ModuleSlot } from '@kinetic/protocol';
import type { MountedAttachmentDefinition } from './attachmentSchema';

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
    statusDurationMultiplier?: Record<string, number>;
    skillProjectileHomingMultiplier?: number;
    skillProjectileDamageMultiplier?: number;
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
  statusDurationMultiplier: Record<string, number>;
  skillProjectileHomingMultiplier: number;
  skillProjectileDamageMultiplier: number;
  incomingDamageMultiplier: number;
  incomingKnockbackMultiplier: number;
  moveAccelerationMultiplier: number;
  maxSpeedMultiplier: number;
}
