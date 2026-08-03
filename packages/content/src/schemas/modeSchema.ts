import { z } from 'zod';
import type { TeamId } from '@kinetic/protocol';

export type VictoryRule = 'LAST_TEAM_STANDING' | 'DEFEAT_BOSS' | 'SURVIVE_TICKS';

export interface GameModeDefinition {
  id: string;
  name: string;
  description: string;
  formatLabel: string;
  minUnits: number;
  maxUnits: number;
  victory: VictoryRule;
  bossTeam?: TeamId;
  survivorTeam?: TeamId;
  durationTicks?: number;
}

export const gameModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().min(1),
  formatLabel: z.string().min(1),
  minUnits: z.number().int().positive(),
  maxUnits: z.number().int().positive(),
  victory: z.enum(['LAST_TEAM_STANDING', 'DEFEAT_BOSS', 'SURVIVE_TICKS']),
  bossTeam: z.number().int().positive().optional(),
  survivorTeam: z.number().int().positive().optional(),
  durationTicks: z.number().int().positive().optional()
});
