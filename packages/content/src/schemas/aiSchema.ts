import { z } from 'zod';
import type { AbilitySlot } from '@kinetic/protocol';
import { abilitySlotSchema } from './internal';

export type AiMovementStyle = 'chase' | 'orbit' | 'kite' | 'charger';
export type AiTargetingStyle = 'nearest' | 'lowest-health' | 'largest' | 'clustered';

export interface AiAbilityUseRule {
  slot: AbilitySlot;
  everyTicks: number;
  phaseTicks: number;
  minDistance: number;
  maxDistance: number;
  healthBelow?: number;
  /** Profile-specific adjustment layered over the reusable ability priority. */
  priority?: number;
  /** Optional density requirement for area skills. */
  minimumTargets?: number;
  /** Combo-aware gate used by AI without embedding fighter ids in controller code. */
  targetStatusId?: string;
  minimumTargetStatusStacks?: number;
  maximumTargetStatusStacks?: number;
  priorityPerTargetStatusStack?: number;
  /** Optional generic fighter-resource gate and scoring weight. */
  selfResourceId?: string;
  minimumSelfResource?: number;
  maximumSelfResource?: number;
  priorityPerSelfResource?: number;
}

export interface AiProfile {
  id: string;
  reactionTicks: number;
  aggression: number;
  preferredDistance: number;
  retreatHealthRatio: number;
  steeringStrength: number;
  movementStyle: AiMovementStyle;
  orbitStrength: number;
  wallAvoidance: number;
  targeting: AiTargetingStyle;
  allySeparation: number;
  targetSpread: number;
  targetStickiness: number;
  abilityUsage: AiAbilityUseRule[];
}

export const aiProfileSchema = z.object({
  id: z.string(),
  reactionTicks: z.number().int().positive(),
  aggression: z.number().min(0).max(1),
  preferredDistance: z.number().nonnegative(),
  retreatHealthRatio: z.number().min(0).max(1),
  steeringStrength: z.number().positive(),
  movementStyle: z.enum(['chase', 'orbit', 'kite', 'charger']),
  orbitStrength: z.number().min(0).max(2),
  wallAvoidance: z.number().min(0).max(3),
  targeting: z.enum(['nearest', 'lowest-health', 'largest', 'clustered']).default('nearest'),
  allySeparation: z.number().min(0).max(3).default(0.75),
  targetSpread: z.number().min(0).max(5).default(0.6),
  targetStickiness: z.number().min(0).max(1).default(0.82),
  abilityUsage: z.array(z.object({
    slot: abilitySlotSchema,
    everyTicks: z.number().int().positive(),
    phaseTicks: z.number().int().nonnegative().default(0),
    minDistance: z.number().nonnegative().default(0),
    maxDistance: z.number().positive().default(99999),
    healthBelow: z.number().min(0).max(1).optional(),
    priority: z.number().min(-100).max(100).optional(),
    minimumTargets: z.number().int().positive().optional(),
    targetStatusId: z.string().optional(),
    minimumTargetStatusStacks: z.number().int().nonnegative().optional(),
    maximumTargetStatusStacks: z.number().int().nonnegative().optional(),
    priorityPerTargetStatusStack: z.number().min(-100).max(100).optional(),
    selfResourceId: z.string().min(1).optional(),
    minimumSelfResource: z.number().nonnegative().optional(),
    maximumSelfResource: z.number().nonnegative().optional(),
    priorityPerSelfResource: z.number().min(-10).max(10).optional()
  })).default([])
});
