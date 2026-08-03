import { z } from 'zod';
import type { ArenaObstacleKind, ArenaZoneKind, TeamId, Vec2 } from '@kinetic/protocol';

export interface ArenaSpawnZoneDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  team?: TeamId;
}

export interface ArenaObstacleDefinition {
  id: string;
  kind: ArenaObstacleKind;
  shape: 'circle' | 'box';
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  restitution: number;
  destructible: boolean;
  maxHp: number;
  impactDamageScale: number;
  breakImpulseThreshold: number;
  contactDamage: number;
}

export interface ArenaZoneDefinition {
  id: string;
  name: string;
  kind: ArenaZoneKind;
  shape: 'circle' | 'rect';
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  strength: number;
  damage: number;
  intervalTicks: number;
  statusId?: string;
  direction: Vec2;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  theme: 'iron' | 'temple' | 'foundry';
  width: number;
  height: number;
  spatialCellSize: number;
  recommendedUnits: { min: number; max: number };
  allowedModes: string[];
  spawnZones: ArenaSpawnZoneDefinition[];
  obstacles: ArenaObstacleDefinition[];
  zones: ArenaZoneDefinition[];
}

const spawnZoneSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  team: z.number().int().positive().optional()
});

const obstacleSchema = z.object({
  id: z.string(),
  kind: z.enum(['pillar', 'crate', 'reactor']),
  shape: z.enum(['circle', 'box']),
  x: z.number(),
  y: z.number(),
  radius: z.number().nonnegative().default(0),
  width: z.number().nonnegative().default(0),
  height: z.number().nonnegative().default(0),
  restitution: z.number().min(0).max(1.25).default(0.82),
  destructible: z.boolean().default(false),
  maxHp: z.number().nonnegative().default(0),
  impactDamageScale: z.number().nonnegative().default(0),
  breakImpulseThreshold: z.number().nonnegative().default(0),
  contactDamage: z.number().nonnegative().default(0)
});

const zoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['ice', 'water', 'lava', 'electric', 'wind']),
  shape: z.enum(['circle', 'rect']),
  x: z.number(),
  y: z.number(),
  radius: z.number().nonnegative().default(0),
  width: z.number().nonnegative().default(0),
  height: z.number().nonnegative().default(0),
  strength: z.number().nonnegative().default(0),
  damage: z.number().nonnegative().default(0),
  intervalTicks: z.number().int().positive().default(30),
  statusId: z.string().optional(),
  direction: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 })
});

export const arenaSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.enum(['tiny', 'small', 'medium', 'large', 'huge']),
  theme: z.enum(['iron', 'temple', 'foundry']).default('iron'),
  width: z.number().positive(),
  height: z.number().positive(),
  spatialCellSize: z.number().positive(),
  recommendedUnits: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  allowedModes: z.array(z.string()).min(1),
  spawnZones: z.array(spawnZoneSchema).default([]),
  obstacles: z.array(obstacleSchema).default([]),
  zones: z.array(zoneSchema).default([])
});
