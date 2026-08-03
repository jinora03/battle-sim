import { z } from 'zod';
import type { AbilitySlot, BlastKind, Element } from '@kinetic/protocol';
import { abilitySlotSchema, elementSchema } from './internal';

export type AbilityIntent = 'offensive' | 'defensive' | 'movement' | 'support' | 'reactive';
export type AbilityTargeting = 'self' | 'target' | 'area' | 'direction';

export interface AbilityActivationProfile {
  intent: AbilityIntent;
  targeting: AbilityTargeting;
  priority: number;
  minRange: number;
  maxRange: number;
  requiresLineOfSight: boolean;
  minimumTargets: number;
  collisionWindowTicks: number;
  aimToleranceDegrees: number;
}

export type AbilityCondition =
  | { type: 'IMPACT_ABOVE'; value: number }
  | { type: 'SELF_HAS_STATUS'; statusId: string; minimumStacks?: number }
  | { type: 'TARGET_HAS_STATUS'; statusId: string; minimumStacks?: number; maximumStacks?: number }
  | { type: 'SELF_HEALTH_BELOW'; ratio: number };

export type AbilityAction =
  | { type: 'APPLY_IMPULSE_SELF'; magnitude: number; direction?: 'forward' | 'backward' | 'left' | 'right' }
  | { type: 'DEAL_DAMAGE_TARGET'; amount: number; element: Element }
  | { type: 'APPLY_STATUS_SELF'; statusId: string; durationTicks: number; stacks?: number }
  | { type: 'APPLY_STATUS_TARGET'; statusId: string; durationTicks: number; stacks?: number }
  | { type: 'REMOVE_STATUS_SELF'; statusId: string }
  | { type: 'REMOVE_STATUS_TARGET'; statusId: string; stacks?: number | 'all' }
  | { type: 'APPLY_KNOCKBACK_TARGET'; magnitude: number }
  | { type: 'RADIAL_IMPULSE'; radius: number; magnitude: number; enemiesOnly: boolean; direction: 'push' | 'pull' }
  | { type: 'RADIAL_DAMAGE'; radius: number; amount: number; element: Element; enemiesOnly: boolean }
  | { type: 'DIRECTIONAL_DAMAGE'; range: number; arcDegrees: number; amount: number; knockback: number; element: Element; enemiesOnly: boolean }
  | { type: 'RADIAL_STATUS'; radius: number; statusId: string; durationTicks: number; stacks?: number; enemiesOnly: boolean }
  | { type: 'EXPLODE'; kind: BlastKind; radius: number; damage: number; impulse: number; element: Element; enemiesOnly: boolean }
  | { type: 'EXPLODE_AT_TARGET'; kind: BlastKind; radius: number; damage: number; impulse: number; element: Element; enemiesOnly: boolean }
  | {
      type: 'LAUNCH_PROJECTILES';
      projectileId: string;
      count: number;
      pattern: 'forward' | 'fan' | 'radial';
      spreadDegrees: number;
      targetMode: 'selected' | 'nearest' | 'distributed';
      intervalTicks?: number;
    }
  | { type: 'HEAL_SELF'; amount: number }
  | { type: 'USE_WEAPON'; weaponId?: string };

export interface AbilityDefinition {
  id: string;
  name: string;
  slot: AbilitySlot;
  cooldownTicks: number;
  castTicks: number;
  castMovementMultiplier: number;
  activation?: Partial<AbilityActivationProfile>;
  triggers: Array<{
    event: 'ON_ACTIVATE' | 'ON_COLLISION' | 'ON_HEALTH_BELOW';
    conditions: AbilityCondition[];
    actions: AbilityAction[];
  }>;
}

export type PassiveTriggerEvent = 'ON_PRIMARY_HIT' | 'ON_ABILITY_RESOLVED' | 'ON_BATTLE_START';

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  triggers: Array<{
    event: PassiveTriggerEvent;
    conditions: AbilityCondition[];
    actions: AbilityAction[];
  }>;
}

const conditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('IMPACT_ABOVE'), value: z.number().nonnegative() }),
  z.object({ type: z.literal('SELF_HAS_STATUS'), statusId: z.string(), minimumStacks: z.number().int().positive().optional() }),
  z.object({ type: z.literal('TARGET_HAS_STATUS'), statusId: z.string(), minimumStacks: z.number().int().nonnegative().optional(), maximumStacks: z.number().int().nonnegative().optional() }),
  z.object({ type: z.literal('SELF_HEALTH_BELOW'), ratio: z.number().min(0).max(1) })
]);

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('APPLY_IMPULSE_SELF'), magnitude: z.number().positive(), direction: z.enum(['forward', 'backward', 'left', 'right']).optional() }),
  z.object({ type: z.literal('DEAL_DAMAGE_TARGET'), amount: z.number().nonnegative(), element: elementSchema }),
  z.object({ type: z.literal('APPLY_STATUS_SELF'), statusId: z.string(), durationTicks: z.number().int().positive(), stacks: z.number().int().positive().optional() }),
  z.object({ type: z.literal('APPLY_STATUS_TARGET'), statusId: z.string(), durationTicks: z.number().int().positive(), stacks: z.number().int().positive().optional() }),
  z.object({ type: z.literal('REMOVE_STATUS_SELF'), statusId: z.string() }),
  z.object({ type: z.literal('REMOVE_STATUS_TARGET'), statusId: z.string(), stacks: z.union([z.number().int().positive(), z.literal('all')]).optional() }),
  z.object({ type: z.literal('APPLY_KNOCKBACK_TARGET'), magnitude: z.number().positive() }),
  z.object({
    type: z.literal('RADIAL_IMPULSE'), radius: z.number().positive(), magnitude: z.number().positive(),
    enemiesOnly: z.boolean().default(true), direction: z.enum(['push', 'pull']).default('push')
  }),
  z.object({ type: z.literal('RADIAL_DAMAGE'), radius: z.number().positive(), amount: z.number().nonnegative(), element: elementSchema, enemiesOnly: z.boolean().default(true) }),
  z.object({
    type: z.literal('DIRECTIONAL_DAMAGE'), range: z.number().positive(), arcDegrees: z.number().min(1).max(360),
    amount: z.number().nonnegative(), knockback: z.number().nonnegative().default(0), element: elementSchema, enemiesOnly: z.boolean().default(true)
  }),
  z.object({ type: z.literal('RADIAL_STATUS'), radius: z.number().positive(), statusId: z.string(), durationTicks: z.number().int().positive(), stacks: z.number().int().positive().optional(), enemiesOnly: z.boolean().default(true) }),
  z.object({
    type: z.literal('EXPLODE'), kind: z.enum(['explosion', 'wave']), radius: z.number().positive(),
    damage: z.number().nonnegative(), impulse: z.number().nonnegative(), element: elementSchema, enemiesOnly: z.boolean().default(true)
  }),
  z.object({
    type: z.literal('EXPLODE_AT_TARGET'), kind: z.enum(['explosion', 'wave']), radius: z.number().positive(),
    damage: z.number().nonnegative(), impulse: z.number().nonnegative(), element: elementSchema, enemiesOnly: z.boolean().default(true)
  }),
  z.object({
    type: z.literal('LAUNCH_PROJECTILES'),
    projectileId: z.string().min(1),
    count: z.number().int().min(1).max(32),
    pattern: z.enum(['forward', 'fan', 'radial']),
    spreadDegrees: z.number().min(0).max(360).default(0),
    targetMode: z.enum(['selected', 'nearest', 'distributed']).default('selected'),
    intervalTicks: z.number().int().min(0).max(30).optional()
  }),
  z.object({ type: z.literal('HEAL_SELF'), amount: z.number().positive() }),
  z.object({ type: z.literal('USE_WEAPON'), weaponId: z.string().optional() })
]);

export const abilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: abilitySlotSchema,
  cooldownTicks: z.number().int().nonnegative(),
  castTicks: z.number().int().nonnegative().default(0),
  castMovementMultiplier: z.number().min(0).max(1).default(1),

  activation: z.object({
    intent: z.enum(['offensive', 'defensive', 'movement', 'support', 'reactive']).optional(),
    targeting: z.enum(['self', 'target', 'area', 'direction']).optional(),
    priority: z.number().min(0).max(200).optional(),
    minRange: z.number().nonnegative().optional(),
    maxRange: z.number().positive().optional(),
    requiresLineOfSight: z.boolean().optional(),
    minimumTargets: z.number().int().positive().optional(),
    collisionWindowTicks: z.number().int().nonnegative().optional(),
    aimToleranceDegrees: z.number().min(0).max(180).optional()
  }).optional(),
  triggers: z.array(z.object({
    event: z.enum(['ON_ACTIVATE', 'ON_COLLISION', 'ON_HEALTH_BELOW']),
    conditions: z.array(conditionSchema).optional().default([]),
    actions: z.array(actionSchema)
  }))
});
