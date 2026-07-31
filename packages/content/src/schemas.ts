import { z } from 'zod';
import type { AbilitySlot, ArenaObstacleKind, ArenaZoneKind, BlastKind, Element, PrimaryAttackBehavior, TeamId, Vec2 } from '@kinetic/protocol';

export interface FighterDefinition {
  id: string;
  name: string;
  classification: {
    archetype: string;
    elements: Element[];
    traits: string[];
  };
  physics: {
    radius: number;
    mass: number;
    restitution: number;
    linearDamping: number;
    maxSpeed: number;
  };
  stats: {
    maxHp: number;
    moveAcceleration: number;
  };
  aiProfileId: string | null;
  abilitySlots: Partial<Record<AbilitySlot, string | null>>;
  resistances: Partial<Record<Element, number>>;
  visualRecipeId: string;
  animationRecipeId: string;
  audioProfileId: string;
  /** The authoritative source for the Basic attack and its rendered silhouette. */
  primaryAttackId: string;
  /** @deprecated Migrated to primaryAttackId when importing old fighter bundles. */
  weaponId?: string | null;
}


export type AttackForm =
  | 'sword'
  | 'spear'
  | 'hammer'
  | 'axe'
  | 'claws'
  | 'rifle'
  | 'launcher'
  | 'shield'
  | 'gauntlet'
  | 'fire'
  | 'water'
  | 'ice'
  | 'lightning'
  | 'nature'
  | 'void';

export type PrimaryAttackStyle =
  | 'swing'
  | 'thrust'
  | 'overhead'
  | 'spin'
  | 'shot'
  | 'burst'
  | 'lob'
  | 'orbit'
  | 'slam'
  | 'stream';
/** @deprecated Use PrimaryAttackStyle. */
export type WeaponAttackStyle = PrimaryAttackStyle;

export interface ProjectileDefinition {
  speed: number;
  radius: number;
  lifetimeTicks: number;
  fuseTicks: number;
  gravity: number;
  bounce: number;
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

export interface PrimaryAttackDefinition {
  id: string;
  name: string;
  form: AttackForm;
  behavior: PrimaryAttackBehavior;
  /** @deprecated Runtime compatibility alias for behavior. */
  category: PrimaryAttackBehavior;
  style: PrimaryAttackStyle;
  range: number;
  minRange: number;
  damage: number;
  knockback: number;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  cooldownTicks: number;
  attackAngleDegrees: number;
  /** Exaggerated top-down silhouette scale. */
  visualScale: number;
  /** Number of deterministic shots released during one attack. */
  burstCount?: number;
  /** Simulation ticks between burst shots. */
  burstIntervalTicks?: number;
  /** Total angular spread across the burst. */
  spreadDegrees?: number;
  /** Re-arms per-target contact for sustained attacks. */
  repeatHitIntervalTicks?: number;
  projectile?: ProjectileDefinition;
  onHitStatuses?: Array<{ statusId: string; durationTicks: number }>;
  movementAllowed: boolean;
  friendlyFire: boolean;
  visualId: string;
  audioId: string;
}
/** @deprecated Use PrimaryAttackDefinition. */
export type WeaponDefinition = PrimaryAttackDefinition;

/** Reusable projectile used by skills without becoming the fighter's Basic attack. */
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
  onHitStatuses?: Array<{ statusId: string; durationTicks: number }>;
}

export type ProjectileSourceDefinition = Pick<
  PrimaryAttackDefinition,
  'id' | 'name' | 'form' | 'behavior' | 'damage' | 'knockback' | 'friendlyFire' | 'visualId' | 'audioId' | 'projectile' | 'onHitStatuses'
>;

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
  | { type: 'SELF_HAS_STATUS'; statusId: string }
  | { type: 'SELF_HEALTH_BELOW'; ratio: number };

export type AbilityAction =
  | { type: 'APPLY_IMPULSE_SELF'; magnitude: number }
  | { type: 'DEAL_DAMAGE_TARGET'; amount: number; element: Element }
  | { type: 'APPLY_STATUS_SELF'; statusId: string; durationTicks: number }
  | { type: 'APPLY_STATUS_TARGET'; statusId: string; durationTicks: number }
  | { type: 'REMOVE_STATUS_SELF'; statusId: string }
  | { type: 'APPLY_KNOCKBACK_TARGET'; magnitude: number }
  | { type: 'RADIAL_IMPULSE'; radius: number; magnitude: number; enemiesOnly: boolean; direction: 'push' | 'pull' }
  | { type: 'RADIAL_DAMAGE'; radius: number; amount: number; element: Element; enemiesOnly: boolean }
  | { type: 'DIRECTIONAL_DAMAGE'; range: number; arcDegrees: number; amount: number; knockback: number; element: Element; enemiesOnly: boolean }
  | { type: 'RADIAL_STATUS'; radius: number; statusId: string; durationTicks: number; enemiesOnly: boolean }
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

export interface StatusDefinition {
  id: string;
  periodicDamage?: number;
  periodTicks?: number;
  element?: Element;
  speedMultiplier?: number;
  massMultiplier?: number;
}

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

export interface ElementInteraction {
  source: Element;
  target: Element;
  multiplier: number;
}

const elementSchema = z.enum(['neutral', 'fire', 'water', 'ice', 'electric', 'metal', 'nature', 'void']);
const abilitySlotSchema = z.enum(['basic', 'skill1', 'skill2', 'skill3', 'ultimate']);

export const fighterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  classification: z.object({
    archetype: z.string().min(1),
    elements: z.array(elementSchema).min(1),
    traits: z.array(z.string())
  }),
  physics: z.object({
    radius: z.number().positive(),
    mass: z.number().positive(),
    restitution: z.number().min(0).max(1.25),
    linearDamping: z.number().min(0).max(1),
    maxSpeed: z.number().positive()
  }),
  stats: z.object({
    maxHp: z.number().positive(),
    moveAcceleration: z.number().positive()
  }),
  aiProfileId: z.string().nullable(),
  abilitySlots: z.object({
    basic: z.string().nullable().optional(),
    skill1: z.string().nullable().optional(),
    skill2: z.string().nullable().optional(),
    skill3: z.string().nullable().optional(),
    ultimate: z.string().nullable().optional()
  }),
  resistances: z.partialRecord(elementSchema, z.number().positive()).default({}),
  visualRecipeId: z.string(),
  animationRecipeId: z.string(),
  audioProfileId: z.string(),
  primaryAttackId: z.string().min(1),
  weaponId: z.string().nullable().optional()
});

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
    minimumTargets: z.number().int().positive().optional()
  })).default([])
});

const conditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('IMPACT_ABOVE'), value: z.number().nonnegative() }),
  z.object({ type: z.literal('SELF_HAS_STATUS'), statusId: z.string() }),
  z.object({ type: z.literal('SELF_HEALTH_BELOW'), ratio: z.number().min(0).max(1) })
]);

const projectileDefinitionSchema = z.object({
  speed: z.number().positive(),
  radius: z.number().positive(),
  lifetimeTicks: z.number().int().positive(),
  fuseTicks: z.number().int().nonnegative().default(0),
  gravity: z.number().nonnegative().default(0),
  bounce: z.number().min(0).max(1.25).default(0),
  explosionRadius: z.number().nonnegative().default(0),
  explosionDamage: z.number().nonnegative().default(0),
  explosionImpulse: z.number().nonnegative().default(0),
  homingStrength: z.number().min(0).max(1).optional(),
  homingDelayTicks: z.number().int().nonnegative().optional(),
  homingRange: z.number().positive().optional(),
  homingTurnRadians: z.number().positive().max(Math.PI).optional(),
  trailStyle: z.enum(['none', 'smoke', 'energy', 'water', 'spark']).optional()
});

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('APPLY_IMPULSE_SELF'), magnitude: z.number().positive() }),
  z.object({ type: z.literal('DEAL_DAMAGE_TARGET'), amount: z.number().nonnegative(), element: elementSchema }),
  z.object({ type: z.literal('APPLY_STATUS_SELF'), statusId: z.string(), durationTicks: z.number().int().positive() }),
  z.object({ type: z.literal('APPLY_STATUS_TARGET'), statusId: z.string(), durationTicks: z.number().int().positive() }),
  z.object({ type: z.literal('REMOVE_STATUS_SELF'), statusId: z.string() }),
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
  z.object({ type: z.literal('RADIAL_STATUS'), radius: z.number().positive(), statusId: z.string(), durationTicks: z.number().int().positive(), enemiesOnly: z.boolean().default(true) }),
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

export const statusSchema = z.object({
  id: z.string(),
  periodicDamage: z.number().nonnegative().optional(),
  periodTicks: z.number().int().positive().optional(),
  element: elementSchema.optional(),
  speedMultiplier: z.number().positive().optional(),
  massMultiplier: z.number().positive().optional()
});

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

export const elementInteractionSchema = z.object({
  source: elementSchema,
  target: elementSchema,
  multiplier: z.number().positive()
});
