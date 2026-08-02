import type {
  Element,
  EntityId,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';

export interface AbilityCollisionContext {
  self: EntityId;
  target: EntityId;
  impact: number;
  normal: Vec2;
}

export interface AbilityTriggerContext {
  self: EntityId;
  target: EntityId | null;
  impact: number;
  normal: Vec2;
  abilityId: string;
}

export interface AbilityImpulseOptions {
  retention?: number;
  maxSpeed?: number;
  minWallBounces?: number;
  trailStrength?: number;
}

export interface AbilitySystemContext {
  getTick(): number;
  dealDamage(
    sourceId: EntityId,
    targetId: EntityId,
    amount: number,
    element: Element,
    events: SimulationEvent[]
  ): void;
  applyStatus(
    sourceId: EntityId,
    targetId: EntityId,
    statusId: string,
    durationTicks: number,
    events: SimulationEvent[],
    stacks?: number
  ): void;
  applyKnockback(
    sourceId: EntityId,
    targetId: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    options?: AbilityImpulseOptions
  ): void;
  applyKnockbackFromPoint(
    sourceId: EntityId,
    origin: Vec2,
    targetId: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    fallbackDirection?: Vec2,
    options?: AbilityImpulseOptions
  ): void;
  addExternalImpulse(
    targetId: EntityId,
    x: number,
    y: number,
    options?: AbilityImpulseOptions
  ): void;
  removeExternalImpulse(entityId: EntityId): void;
  damageScaledImpulse(baseImpulse: number, damage: number): number;
  explosionImpulseOptions(damage: number, abilityId?: string): AbilityImpulseOptions;
}

export function normalizeAbilityVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}
