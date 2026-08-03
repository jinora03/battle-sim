import { z } from 'zod';

export const elementSchema = z.enum(['neutral', 'fire', 'water', 'ice', 'electric', 'metal', 'nature', 'void']);
export const abilitySlotSchema = z.enum(['basic', 'skill1', 'skill2', 'skill3', 'ultimate']);
