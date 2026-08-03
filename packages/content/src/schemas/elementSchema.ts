import { z } from 'zod';
import type { Element } from '@kinetic/protocol';
import { elementSchema } from './internal';

export interface ElementInteraction {
  source: Element;
  target: Element;
  multiplier: number;
}

export const elementInteractionSchema = z.object({
  source: elementSchema,
  target: elementSchema,
  multiplier: z.number().positive()
});
