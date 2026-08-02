import type { ArenaDefinition, ArenaZoneDefinition } from '@kinetic/content';
import type {
  Element,
  EntityId,
  SimulationEvent
} from '@kinetic/protocol';
import type { World } from '../world';

export interface EnvironmentModifiers {
  steering: number;
  damping: number | null;
  maxSpeed: number;
}

interface ArenaZoneHooks {
  getTick(): number;
  applyStatus(
    sourceId: EntityId,
    targetId: EntityId,
    statusId: string,
    durationTicks: number,
    events: SimulationEvent[]
  ): void;
  dealDamage(
    sourceId: EntityId | null,
    targetId: EntityId,
    amount: number,
    element: Element,
    events: SimulationEvent[]
  ): void;
}

/** Owns deterministic zone membership, hazards, and movement modifiers. */
export class ArenaZoneSystem {
  private readonly hazardReadyTick = new Map<string, number>();
  private readonly zoneIdScratch: EntityId[] = [];
  private readonly zoneCurrentScratch = new Set<string>();
  private readonly zoneById = new Map<string, ArenaZoneDefinition>();

  constructor(
    private readonly world: World,
    private readonly arena: ArenaDefinition,
    private readonly hooks: ArenaZoneHooks
  ) {
    for (const zone of arena.zones) this.zoneById.set(zone.id, zone);
  }

  update(events: SimulationEvent[]): void {
    if (this.arena.zones.length === 0) return;

    // Zone hazards can kill mid-loop; iterate a stable copy. Zone membership is
    // rebuilt into a reused Set and zones are visited in arena order, preserving
    // event order without per-entity allocations.
    for (const id of this.world.copyActiveIdsInto(this.zoneIdScratch)) {
      const previous = this.world.getActiveZoneIds(id);
      const x = this.world.x[id] ?? 0;
      const y = this.world.y[id] ?? 0;
      const current = this.zoneCurrentScratch;
      current.clear();

      for (const zone of this.arena.zones) {
        if (!this.contains(zone, x, y)) continue;
        current.add(zone.id);
        if (!previous.has(zone.id)) {
          events.push({
            type: 'zoneEntered',
            tick: this.hooks.getTick(),
            entityId: id,
            zoneId: zone.id,
            kind: zone.kind,
            position: { x, y }
          });
        }
        this.applyEffect(id, zone, events);
      }

      for (const zoneId of previous) {
        if (current.has(zoneId)) continue;
        const zone = this.zoneById.get(zoneId);
        if (!zone) continue;
        events.push({
          type: 'zoneExited',
          tick: this.hooks.getTick(),
          entityId: id,
          zoneId,
          kind: zone.kind,
          position: { x, y }
        });
      }
      this.world.setActiveZones(id, current);
    }
  }

  modifiersFor(id: EntityId): EnvironmentModifiers {
    const active = this.world.getActiveZoneIds(id);
    let steering = 1;
    let damping: number | null = null;
    let maxSpeed = 1;

    for (const zoneId of active) {
      const zone = this.zoneById.get(zoneId);
      if (!zone) continue;
      if (zone.kind === 'ice') {
        steering *= Math.max(0.25, 1 - zone.strength);
        damping = Math.max(damping ?? 0, 0.9992);
        maxSpeed *= 1.08;
      } else if (zone.kind === 'water') {
        steering *= Math.max(0.45, zone.strength);
        damping = Math.min(damping ?? 1, 0.988);
        maxSpeed *= 0.82;
      }
    }
    return { steering, damping, maxSpeed };
  }

  private applyEffect(
    id: EntityId,
    zone: ArenaZoneDefinition,
    events: SimulationEvent[]
  ): void {
    if (zone.kind === 'wind') {
      const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
      this.world.vx[id] =
        (this.world.vx[id] ?? 0) + (zone.direction.x / length) * zone.strength;
      this.world.vy[id] =
        (this.world.vy[id] ?? 0) + (zone.direction.y / length) * zone.strength;
      return;
    }

    const tick = this.hooks.getTick();
    const key = `${id}:${zone.id}`;
    const readyTick = this.hazardReadyTick.get(key) ?? 0;
    if (tick < readyTick) return;
    this.hazardReadyTick.set(key, tick + zone.intervalTicks);

    if (zone.statusId) {
      this.hooks.applyStatus(
        id,
        id,
        zone.statusId,
        Math.max(zone.intervalTicks * 2, 60),
        events
      );
    }

    let damage = zone.damage;
    let force = 0;
    if (zone.kind === 'electric' && this.world.hasStatus(id, 'wet')) {
      damage *= 1.75;
    }
    if (zone.kind === 'electric' && zone.strength > 0) {
      const angle = ((id * 97 + tick * 13) % 360) * (Math.PI / 180);
      force = zone.strength;
      const invMass = 1 / this.world.getEffectiveMass(id);
      this.world.vx[id] =
        (this.world.vx[id] ?? 0) + Math.cos(angle) * force * invMass;
      this.world.vy[id] =
        (this.world.vy[id] ?? 0) + Math.sin(angle) * force * invMass;
    }

    if (damage > 0) {
      this.hooks.dealDamage(
        null,
        id,
        damage,
        zone.kind === 'lava'
          ? 'fire'
          : zone.kind === 'electric'
            ? 'electric'
            : 'neutral',
        events
      );
    }
    if (damage > 0 || force > 0) {
      events.push({
        type: 'hazardTriggered',
        tick,
        entityId: id,
        zoneId: zone.id,
        kind: zone.kind,
        position: {
          x: this.world.x[id] ?? 0,
          y: this.world.y[id] ?? 0
        },
        damage,
        force
      });
    }
  }

  private contains(zone: ArenaZoneDefinition, x: number, y: number): boolean {
    if (zone.shape === 'circle') {
      const dx = x - zone.x;
      const dy = y - zone.y;
      return dx * dx + dy * dy <= zone.radius * zone.radius;
    }
    return (
      x >= zone.x &&
      x <= zone.x + zone.width &&
      y >= zone.y &&
      y <= zone.y + zone.height
    );
  }
}
