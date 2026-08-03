import { z } from 'zod';
import type { PrimaryAttackBehavior } from '@kinetic/protocol';
import type { AttackForm, PrimaryAttackDefinition } from './attackSchema';

export interface ProjectileDefinition {
  speed: number;
  radius: number;
  lifetimeTicks: number;
  fuseTicks: number;
  gravity: number;
  bounce: number;
  /** Optional finite wall/obstacle ricochet budget. Omitted preserves legacy unlimited native bounce. */
  maxWallBounces?: number;
  explosionRadius: number;
  explosionDamage: number;
  explosionImpulse: number;
  /** Optional deterministic steering used by missiles and guided elemental shots. */
  homingStrength?: number;
  homingDelayTicks?: number;
  homingRange?: number;
  /** Maximum turn applied each tick while homing. */
  homingTurnRadians?: number;
  /** Smoke/trail hint for presentation; it never changes simulation rules. */
  trailStyle?: 'none' | 'smoke' | 'energy' | 'water' | 'spark';
}

/** Reusable projectile used by skills without becoming the fighter's Basic attack. */
export interface ProjectileStatusInteraction {
  statusId: string;
  bonusDamagePerStack?: number;
  bonusKnockbackPerStack?: number;
  homingStrengthPerStack?: number;
  consumeStacks?: number | 'all';
  applyStatusAtStacks?: {
    minimumStacks: number;
    statusId: string;
    durationTicks: number;
    stacks?: number;
  };
}

export interface SkillProjectileDefinition {
  id: string;
  name: string;
  form: AttackForm;
  behavior: Extract<PrimaryAttackBehavior, 'ranged' | 'automatic' | 'throwable'>;
  damage: number;
  knockback: number;
  friendlyFire: boolean;
  visualId: string;
  audioId: string;
  projectile: ProjectileDefinition;
  onHitStatuses?: Array<{ statusId: string; durationTicks: number; stacks?: number }>;
  statusInteraction?: ProjectileStatusInteraction;
}

export type ProjectileSourceDefinition = Pick<
  PrimaryAttackDefinition,
  'id' | 'name' | 'form' | 'behavior' | 'damage' | 'knockback' | 'friendlyFire' | 'visualId' | 'audioId' | 'projectile' | 'onHitStatuses'
> & { statusInteraction?: ProjectileStatusInteraction };

const projectileDefinitionSchema = z.object({
  speed: z.number().positive(),
  radius: z.number().positive(),
  lifetimeTicks: z.number().int().positive(),
  fuseTicks: z.number().int().nonnegative().default(0),
  gravity: z.number().nonnegative().default(0),
  bounce: z.number().min(0).max(1.25).default(0),
  maxWallBounces: z.number().int().min(0).max(64).optional(),
  explosionRadius: z.number().nonnegative().default(0),
  explosionDamage: z.number().nonnegative().default(0),
  explosionImpulse: z.number().nonnegative().default(0),
  homingStrength: z.number().min(0).max(1).optional(),
  homingDelayTicks: z.number().int().nonnegative().optional(),
  homingRange: z.number().positive().optional(),
  homingTurnRadians: z.number().positive().max(Math.PI).optional(),
  trailStyle: z.enum(['none', 'smoke', 'energy', 'water', 'spark']).optional()
});
