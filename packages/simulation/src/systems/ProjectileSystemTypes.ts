import type {
  Element,
  EntityId,
  SimulationEvent,
  SimulationMetricsSnapshot,
  Vec2
} from '@kinetic/protocol';
import type { SnapshotProjectileState } from '../snapshots/SnapshotSystem';

export interface ProjectileImpulseOptions {
  retention?: number;
  maxSpeed?: number;
  minWallBounces?: number;
  trailStrength?: number;
}

export interface ProjectileSystemContext {
  getTick(): number;
  getMetrics(): SimulationMetricsSnapshot;
  getMaxEntityRadius(): number;
  primaryElement(sourceId: EntityId): Element;
  dealDamage(
    sourceId: EntityId,
    targetId: EntityId,
    amount: number,
    element: Element,
    events: SimulationEvent[]
  ): void;
  applyKnockback(
    sourceId: EntityId,
    targetId: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability'
  ): void;
  applyKnockbackFromPoint(
    sourceId: EntityId | undefined,
    origin: Vec2,
    targetId: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    fallbackDirection?: Vec2,
    impulseOptions?: ProjectileImpulseOptions
  ): void;
  applyStatus(
    sourceId: EntityId,
    targetId: EntityId,
    statusId: string,
    durationTicks: number,
    events: SimulationEvent[],
    stacks?: number
  ): void;
  triggerPrimaryHitPassive(
    sourceId: EntityId,
    targetId: EntityId,
    impact: number,
    normal: Vec2,
    abilityId: string,
    events: SimulationEvent[]
  ): void;
  damageScaledImpulse(baseImpulse: number, damage: number): number;
  explosionImpulseOptions(
    damage: number,
    abilityId?: string
  ): ProjectileImpulseOptions;
}

export interface RuntimeProjectile extends SnapshotProjectileState {
  isPrimaryAttack: boolean;
  remainingTicks: number;
  damageMultiplier: number;
  knockbackMultiplier: number;
  bounceRetention: number;
  maxWallBounces: number;
  wallBounces: number;
  penetrationRemaining: number;
  hitTargetIds: EntityId[];
  homingStrength: number;
}

export interface PendingProjectileLaunch {
  launchTick: number;
  sequence: number;
  sourceId: EntityId;
  projectileId: string;
  direction: Vec2;
  targetId: EntityId | null;
  retargetOnLaunch: boolean;
}

export interface ProjectileArenaBounds {
  width: number;
  height: number;
}
