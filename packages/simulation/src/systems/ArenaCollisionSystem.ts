import type { ArenaDefinition, ArenaObstacleDefinition } from '@kinetic/content';
import type {
  ArenaObstacleSnapshot,
  Element,
  EntityId,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';
import { compareOrdinal } from '../order';
import type { World } from '../world';
import type { ExternalImpulseState } from './SimulationSystemTypes';

export interface RuntimeObstacle {
  definition: ArenaObstacleDefinition;
  hp: number;
  alive: boolean;
}

interface ArenaCollisionHooks {
  getTick(): number;
  dealDamage(
    sourceId: EntityId | null,
    targetId: EntityId,
    amount: number,
    element: Element,
    events: SimulationEvent[]
  ): void;
}

/** Owns arena-wall and obstacle collision state without changing step order. */
export class ArenaCollisionSystem {
  private readonly obstacleList: RuntimeObstacle[] = [];
  private readonly obstacleIdScratch: EntityId[] = [];

  constructor(
    private readonly world: World,
    private readonly arena: ArenaDefinition,
    private readonly externalImpulse: Map<EntityId, ExternalImpulseState>,
    private readonly hooks: ArenaCollisionHooks
  ) {
    for (const definition of arena.obstacles) {
      this.obstacleList.push({
        definition,
        hp: definition.destructible ? definition.maxHp : 0,
        alive: true
      });
    }
    this.obstacleList.sort((a, b) =>
      compareOrdinal(a.definition.id, b.definition.id)
    );
  }

  activeObstacles(): readonly RuntimeObstacle[] {
    return this.obstacleList;
  }

  resolveBounds(events: SimulationEvent[]): void {
    for (const id of this.world.activeIdsView()) {
      const r = this.world.radius[id] ?? 0;
      const baseRestitution = this.world.restitution[id] ?? 1;
      let x = this.world.x[id] ?? 0;
      let y = this.world.y[id] ?? 0;
      let vx = this.world.vx[id] ?? 0;
      let vy = this.world.vy[id] ?? 0;
      const impulse = this.externalImpulse.get(id);
      let impulseX = impulse?.x ?? 0;
      let impulseY = impulse?.y ?? 0;
      let magnitude = 0;
      let hitWall = false;
      const preservingBounces =
        impulse !== undefined && impulse.wallBounces < impulse.minWallBounces;
      const restitution = preservingBounces
        ? Math.max(baseRestitution, 0.985)
        : baseRestitution;

      if (x - r < 0) {
        x = r;
        hitWall = true;
        magnitude = Math.max(magnitude, Math.abs(vx));
        vx = Math.abs(vx) * restitution;
        impulseX = Math.abs(impulseX) * restitution;
      } else if (x + r > this.arena.width) {
        x = this.arena.width - r;
        hitWall = true;
        magnitude = Math.max(magnitude, Math.abs(vx));
        vx = -Math.abs(vx) * restitution;
        impulseX = -Math.abs(impulseX) * restitution;
      }
      if (y - r < 0) {
        y = r;
        hitWall = true;
        magnitude = Math.max(magnitude, Math.abs(vy));
        vy = Math.abs(vy) * restitution;
        impulseY = Math.abs(impulseY) * restitution;
      } else if (y + r > this.arena.height) {
        y = this.arena.height - r;
        hitWall = true;
        magnitude = Math.max(magnitude, Math.abs(vy));
        vy = -Math.abs(vy) * restitution;
        impulseY = -Math.abs(impulseY) * restitution;
      }

      this.world.x[id] = x;
      this.world.y[id] = y;
      this.world.vx[id] = vx;
      this.world.vy[id] = vy;
      if (impulse) {
        const wallBounces = impulse.wallBounces + (hitWall ? 1 : 0);
        this.externalImpulse.set(id, {
          ...impulse,
          x: impulseX,
          y: impulseY,
          wallBounces,
          retention:
            wallBounces >= impulse.minWallBounces
              ? Math.min(impulse.retention, 0.92)
              : impulse.retention
        });
      }
      if (magnitude > 1.5) {
        events.push({
          type: 'wallImpact',
          tick: this.hooks.getTick(),
          entityId: id,
          position: { x, y },
          magnitude
        });
      }
    }
  }

  resolveObstacleCollisions(events: SimulationEvent[]): void {
    for (const id of this.world.copyActiveIdsInto(this.obstacleIdScratch)) {
      for (const obstacle of this.obstacleList) {
        if (!obstacle.alive) continue;
        const contact =
          obstacle.definition.shape === 'circle'
            ? this.circleContact(id, obstacle.definition)
            : this.boxContact(id, obstacle.definition);
        if (!contact) continue;

        const { normal, overlap, position } = contact;
        this.world.x[id] = (this.world.x[id] ?? 0) + normal.x * overlap;
        this.world.y[id] = (this.world.y[id] ?? 0) + normal.y * overlap;
        const vx = this.world.vx[id] ?? 0;
        const vy = this.world.vy[id] ?? 0;
        const velocityInto = vx * normal.x + vy * normal.y;
        let magnitude = 0;
        if (velocityInto < 0) {
          magnitude = -velocityInto * this.world.getEffectiveMass(id);
          const restitution = Math.min(
            this.world.restitution[id] ?? 1,
            obstacle.definition.restitution
          );
          this.world.vx[id] = vx - (1 + restitution) * velocityInto * normal.x;
          this.world.vy[id] = vy - (1 + restitution) * velocityInto * normal.y;
          const impulse = this.externalImpulse.get(id);
          if (impulse) {
            const impulseInto = impulse.x * normal.x + impulse.y * normal.y;
            if (impulseInto < 0) {
              this.externalImpulse.set(id, {
                ...impulse,
                x: impulse.x - (1 + restitution) * impulseInto * normal.x,
                y: impulse.y - (1 + restitution) * impulseInto * normal.y
              });
            }
          }
        }
        if (magnitude <= 0.05) continue;

        events.push({
          type: 'obstacleImpact',
          tick: this.hooks.getTick(),
          entityId: id,
          obstacleId: obstacle.definition.id,
          position,
          magnitude
        });
        if (obstacle.definition.contactDamage > 0 && magnitude > 2) {
          this.hooks.dealDamage(
            null,
            id,
            obstacle.definition.contactDamage * Math.min(2, magnitude / 6),
            'neutral',
            events
          );
        }
        if (
          obstacle.definition.destructible &&
          magnitude >= obstacle.definition.breakImpulseThreshold
        ) {
          const amount = Math.max(
            0,
            (magnitude - obstacle.definition.breakImpulseThreshold) *
              obstacle.definition.impactDamageScale
          );
          obstacle.hp = Math.max(0, obstacle.hp - amount);
          events.push({
            type: 'obstacleDamaged',
            tick: this.hooks.getTick(),
            sourceId: id,
            obstacleId: obstacle.definition.id,
            amount,
            hpAfter: obstacle.hp,
            position
          });
          if (obstacle.hp <= 0) {
            obstacle.alive = false;
            events.push({
              type: 'obstacleDestroyed',
              tick: this.hooks.getTick(),
              sourceId: id,
              obstacleId: obstacle.definition.id,
              position
            });
          }
        }
      }
    }
  }

  hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    for (const obstacle of this.obstacleList) {
      if (!obstacle.alive) continue;
      const definition = obstacle.definition;
      if (definition.shape === 'circle') {
        if (
          segmentIntersectsCircle(
            ax,
            ay,
            bx,
            by,
            definition.x,
            definition.y,
            definition.radius
          )
        ) {
          return false;
        }
      } else if (
        segmentIntersectsBox(
          ax,
          ay,
          bx,
          by,
          definition.x - definition.width / 2,
          definition.y - definition.height / 2,
          definition.width,
          definition.height
        )
      ) {
        return false;
      }
    }
    return true;
  }

  snapshots(): ArenaObstacleSnapshot[] {
    // Match the stable ID-sorted order used by the pooled runtime snapshot.
    return this.obstacleList.map(({ definition, hp, alive }) => ({
      id: definition.id,
      kind: definition.kind,
      shape: definition.shape,
      x: definition.x,
      y: definition.y,
      radius: definition.radius,
      width: definition.width,
      height: definition.height,
      hp,
      maxHp: definition.maxHp,
      destructible: definition.destructible,
      alive
    }));
  }

  updateRuntimeSnapshots(targets: ArenaObstacleSnapshot[]): void {
    let index = 0;
    for (const { definition, hp, alive } of this.obstacleList) {
      const target = targets[index] ?? {
        id: '',
        kind: definition.kind,
        shape: definition.shape,
        x: 0,
        y: 0,
        radius: 0,
        width: 0,
        height: 0,
        hp: 0,
        maxHp: 0,
        destructible: false,
        alive: true
      };
      target.id = definition.id;
      target.kind = definition.kind;
      target.shape = definition.shape;
      target.x = definition.x;
      target.y = definition.y;
      target.radius = definition.radius;
      target.width = definition.width;
      target.height = definition.height;
      target.hp = hp;
      target.maxHp = definition.maxHp;
      target.destructible = definition.destructible;
      target.alive = alive;
      targets[index] = target;
      index += 1;
    }
    targets.length = index;
  }

  private circleContact(
    id: EntityId,
    obstacle: ArenaObstacleDefinition
  ): { normal: Vec2; overlap: number; position: Vec2 } | null {
    const dx = (this.world.x[id] ?? 0) - obstacle.x;
    const dy = (this.world.y[id] ?? 0) - obstacle.y;
    const combined = (this.world.radius[id] ?? 0) + obstacle.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= combined * combined) return null;
    const distance = Math.max(0.0001, Math.sqrt(distSq));
    const normal =
      distance <= 0.0001
        ? { x: 1, y: 0 }
        : { x: dx / distance, y: dy / distance };
    return {
      normal,
      overlap: combined - distance,
      position: {
        x: obstacle.x + normal.x * obstacle.radius,
        y: obstacle.y + normal.y * obstacle.radius
      }
    };
  }

  private boxContact(
    id: EntityId,
    obstacle: ArenaObstacleDefinition
  ): { normal: Vec2; overlap: number; position: Vec2 } | null {
    const x = this.world.x[id] ?? 0;
    const y = this.world.y[id] ?? 0;
    const r = this.world.radius[id] ?? 0;
    const halfW = obstacle.width / 2;
    const halfH = obstacle.height / 2;
    const minX = obstacle.x - halfW;
    const maxX = obstacle.x + halfW;
    const minY = obstacle.y - halfH;
    const maxY = obstacle.y + halfH;
    const closestX = Math.max(minX, Math.min(maxX, x));
    const closestY = Math.max(minY, Math.min(maxY, y));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) return null;

    if (distSq > 0.000001) {
      const distance = Math.sqrt(distSq);
      return {
        normal: { x: dx / distance, y: dy / distance },
        overlap: r - distance,
        position: { x: closestX, y: closestY }
      };
    }

    let nearestValue = x - minX;
    let normal: Vec2 = { x: -1, y: 0 };
    let position: Vec2 = { x: minX, y };
    const right = maxX - x;
    if (right < nearestValue) {
      nearestValue = right;
      normal = { x: 1, y: 0 };
      position = { x: maxX, y };
    }
    const top = y - minY;
    if (top < nearestValue) {
      nearestValue = top;
      normal = { x: 0, y: -1 };
      position = { x, y: minY };
    }
    const bottom = maxY - y;
    if (bottom < nearestValue) {
      nearestValue = bottom;
      normal = { x: 0, y: 1 };
      position = { x, y: maxY };
    }
    return { normal, overlap: r + nearestValue, position };
  }
}

function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq <= 0.000001
      ? 0
      : Math.max(
          0,
          Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSq)
        );
  const px = ax + dx * t;
  const py = ay + dy * t;
  const ox = px - cx;
  const oy = py - cy;
  return ox * ox + oy * oy <= radius * radius;
}

function segmentIntersectsBox(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let minTime = 0;
  let maxTime = 1;
  const axes: Array<[number, number, number]> = [
    [ax, dx, x],
    [ay, dy, y]
  ];
  const extents = [width, height];
  for (let index = 0; index < axes.length; index += 1) {
    const [origin, delta, minimum] = axes[index] ?? [0, 0, 0];
    const maximum = minimum + (extents[index] ?? 0);
    if (Math.abs(delta) < 0.000001) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const inverse = 1 / delta;
    let t1 = (minimum - origin) * inverse;
    let t2 = (maximum - origin) * inverse;
    if (t1 > t2) [t1, t2] = [t2, t1];
    minTime = Math.max(minTime, t1);
    maxTime = Math.min(maxTime, t2);
    if (minTime > maxTime) return false;
  }
  return true;
}
