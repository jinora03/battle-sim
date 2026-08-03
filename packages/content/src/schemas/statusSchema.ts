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
  maxStacks: z.number().int().positive().optional(),
  refreshMode: z.enum(['refresh', 'extend', 'replace']).optional()
});
