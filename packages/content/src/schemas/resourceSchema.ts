import { z } from 'zod';
import type { Element } from '@kinetic/protocol';
import { elementSchema } from './internal';

export type CombatResourceGainRule =
  | {
      event: 'DAMAGE_DEALT';
      amountPerDamage: number;
      element?: Element;
      maximumPerEvent?: number;
    }
  | {
      event: 'STATUS_APPLIED';
      statusId: string;
      amountPerStack: number;
    };

export interface CombatResourceDefinition {
  id: string;
  name: string;
  maximum: number;
  initial: number;
  decayPerSecond: number;
  decayDelayTicks: number;
  gainRules: CombatResourceGainRule[];
}

const gainRuleSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('DAMAGE_DEALT'),
    amountPerDamage: z.number().positive(),
    element: elementSchema.optional(),
    maximumPerEvent: z.number().positive().optional()
  }),
  z.object({
    event: z.literal('STATUS_APPLIED'),
    statusId: z.string().min(1),
    amountPerStack: z.number().positive()
  })
]);

export const combatResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maximum: z.number().positive(),
  initial: z.number().nonnegative(),
  decayPerSecond: z.number().nonnegative().default(0),
  decayDelayTicks: z.number().int().nonnegative().default(0),
  gainRules: z.array(gainRuleSchema).default([])
});
