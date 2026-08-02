import type {
  EntityId,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';
import type { World } from '../world';
import type { ExternalImpulseState } from './SimulationSystemTypes';

export interface KnockbackImpulseOptions {
  retention?: number;
  maxSpeed?: number;
  minWallBounces?: number;
  trailStrength?: number;
}

export type KnockbackKind = 'weapon' | 'explosion' | 'ability';

/**
 * Owns external-impulse accumulation and all shared knockback policy.
 * ArenaCollisionSystem remains authoritative for consuming protected wall
 * bounces; this system only creates and updates their impulse state.
 */
export class KnockbackSystem {
  constructor(
    private readonly world: World,
    private readonly externalImpulse: Map<EntityId, ExternalImpulseState>,
    private readonly getTick: () => number
  ) {}

  damageScaledImpulse(baseImpulse: number, damage: number): number {
    if (baseImpulse <= 0) return 0;
    const safeDamage = Math.min(120, Math.max(0, damage));
    // High-damage explosions must create clearly stronger displacement, not
    // merely a slightly larger number. The curve keeps micro-missiles modest
    // while making Bomber's MEGA BOMB capable of launching targets into walls.
    const damageRatio = safeDamage / 18;
    const multiplier = Math.max(
      0.86,
      0.7 + Math.pow(damageRatio, 1.12) * 0.72
    );
    return baseImpulse * multiplier;
  }

  explosionImpulseOptions(
    damage: number,
    abilityId?: string
  ): KnockbackImpulseOptions {
    if (abilityId === 'mega-bomb') {
      return {
        retention: 0.997,
        maxSpeed: 72,
        minWallBounces: 3,
        trailStrength: 1
      };
    }
    if (damage >= 24) {
      return {
        retention: Math.min(0.982, 0.95 + (damage - 24) * 0.0015),
        maxSpeed: Math.min(64, 52 + (damage - 24) * 0.5),
        trailStrength: Math.min(1, damage / 40)
      };
    }
    return {
      retention: 0.92,
      maxSpeed: 48,
      trailStrength: Math.min(0.7, damage / 32)
    };
  }

  applyKnockback(
    source: EntityId,
    target: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: KnockbackKind,
    impulseOptions?: KnockbackImpulseOptions
  ): void {
    const direction = {
      x: (this.world.x[target] ?? 0) - (this.world.x[source] ?? 0),
      y: (this.world.y[target] ?? 0) - (this.world.y[source] ?? 0)
    };
    this.applyKnockbackVector(
      source,
      target,
      direction,
      magnitude,
      events,
      kind,
      undefined,
      impulseOptions
    );
  }

  applyKnockbackFromPoint(
    source: EntityId | undefined,
    origin: Vec2,
    target: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: KnockbackKind,
    fallbackDirection?: Vec2,
    impulseOptions?: KnockbackImpulseOptions
  ): void {
    const direction = {
      x: (this.world.x[target] ?? 0) - origin.x,
      y: (this.world.y[target] ?? 0) - origin.y
    };
    this.applyKnockbackVector(
      source,
      target,
      direction,
      magnitude,
      events,
      kind,
      fallbackDirection,
      impulseOptions
    );
  }

  applyKnockbackVector(
    source: EntityId | undefined,
    target: EntityId,
    direction: Vec2,
    magnitude: number,
    events: SimulationEvent[],
    kind: KnockbackKind,
    fallbackDirection?: Vec2,
    impulseOptions?: KnockbackImpulseOptions
  ): void {
    if (magnitude === 0 || !this.world.isAlive(target)) return;

    let dx = direction.x;
    let dy = direction.y;
    let length = Math.hypot(dx, dy);
    if (length < 0.001 && fallbackDirection) {
      dx = fallbackDirection.x;
      dy = fallbackDirection.y;
      length = Math.hypot(dx, dy);
    }
    if (length < 0.001) {
      const fallbackAngle = (
        ((source ?? 0) * 37 + target * 17) % 360
      ) * Math.PI / 180;
      dx = Math.cos(fallbackAngle);
      dy = Math.sin(fallbackAngle);
      length = 1;
    }

    const nx = dx / length;
    const ny = dy / length;
    const incomingKnockbackMultiplier = this.world
      .getLoadout(target)
      .incomingKnockbackMultiplier;
    const resolvedMagnitude = magnitude * incomingKnockbackMultiplier;
    const invMass = 1 / this.world.getEffectiveMass(target);
    const velocityDelta = resolvedMagnitude * invMass;
    this.addExternalImpulse(
      target,
      nx * velocityDelta,
      ny * velocityDelta,
      impulseOptions
    );

    const visualForce = Math.abs(resolvedMagnitude);
    // Keep the event stream bounded in mass battles. Tiny recoil still affects
    // physics, while meaningful displacement receives explicit presentation.
    if (kind === 'explosion' || visualForce >= 2.4) {
      const sign = resolvedMagnitude < 0 ? -1 : 1;
      events.push({
        type: 'knockbackApplied',
        tick: this.getTick(),
        ...(source !== undefined ? { sourceId: source } : {}),
        targetId: target,
        position: {
          x: this.world.x[target] ?? 0,
          y: this.world.y[target] ?? 0
        },
        direction: { x: nx * sign, y: ny * sign },
        force: visualForce,
        kind
      });
    }
  }

  addExternalImpulse(
    target: EntityId,
    x: number,
    y: number,
    options: KnockbackImpulseOptions = {}
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !this.world.isAlive(target)) {
      return;
    }

    const current = this.externalImpulse.get(target) ?? {
      x: 0,
      y: 0,
      retention: 0.92,
      maxSpeed: 48,
      minWallBounces: 0,
      wallBounces: 0,
      trailStrength: 0
    };
    const maxImpulseSpeed = Math.max(
      current.maxSpeed,
      options.maxSpeed ?? 48
    );
    let nextX = current.x + x;
    let nextY = current.y + y;
    const nextMagnitude = Math.hypot(nextX, nextY);
    if (nextMagnitude > maxImpulseSpeed) {
      const scale = maxImpulseSpeed / nextMagnitude;
      nextX *= scale;
      nextY *= scale;
    }

    const appliedX = nextX - current.x;
    const appliedY = nextY - current.y;
    this.externalImpulse.set(target, {
      x: nextX,
      y: nextY,
      retention: Math.max(current.retention, options.retention ?? 0.92),
      maxSpeed: maxImpulseSpeed,
      minWallBounces: Math.max(
        current.minWallBounces,
        options.minWallBounces ?? 0
      ),
      wallBounces: current.wallBounces,
      trailStrength: Math.max(
        current.trailStrength,
        options.trailStrength ?? 0
      )
    });
    this.world.vx[target] = (this.world.vx[target] ?? 0) + appliedX;
    this.world.vy[target] = (this.world.vy[target] ?? 0) + appliedY;
  }

  removeExternalImpulse(entityId: EntityId): void {
    this.externalImpulse.delete(entityId);
  }
}
