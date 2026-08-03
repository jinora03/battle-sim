import { z } from 'zod';
import type { Element } from '@kinetic/protocol';
import { elementSchema } from './internal';

export interface StatusDefinition {
  id: string;
  periodicDamage?: number;
  periodTicks?: number;
  element?: Element;
  speedMultiplier?: number;
  massMultiplier?: number;
  /** Optional multiplicative mass scaling applied once per active stack. */
  massMultiplierPerStack?: number;
  /** Generic renderer hint for visibly light or anchored statuses. */
  massPresentation?: 'light' | 'heavy';
  maxStacks?: number;
  refreshMode?: 'refresh' | 'extend' | 'replace';
}

export const statusSchema = z.object({
  id: z.string(),
  periodicDamage: z.number().nonnegative().optional(),
  periodTicks: z.number().int().positive().optional(),
  element: elementSchema.optional(),
  speedMultiplier: z.number().positive().optional(),
  massMultiplier: z.number().positive().optional(),
  massMultiplierPerStack: z.number().positive().optional(),
  massPresentation: z.enum(['light', 'heavy']).optional(),
  maxStacks: z.number().int().positive().optional(),
  refreshMode: z.enum(['refresh', 'extend', 'replace']).optional()
});

/** Resolves fixed and per-stack status mass modifiers with deterministic integer stacking. */
export function resolveStatusMassMultiplier(
  definition: StatusDefinition,
  stacks: number
): number {
  let multiplier = definition.massMultiplier ?? 1;
  const perStack = definition.massMultiplierPerStack ?? 1;
  const resolvedStacks = Math.max(0, Math.trunc(stacks));
  for (let index = 0; index < resolvedStacks; index += 1) {
    multiplier *= perStack;
  }
  return multiplier;
}
