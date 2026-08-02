import { getFighter, type ArenaDefinition } from '@kinetic/content';
import type { BattleParticipant, Vec2 } from '@kinetic/protocol';
import type { SeededRng } from '../rng';
import type { World } from '../world';

/** Owns deterministic initial participant placement and spawning. */
export class ParticipantSpawnSystem {
  constructor(
    private readonly world: World,
    private readonly arena: ArenaDefinition,
    private readonly rng: SeededRng
  ) {}

  spawn(participants: readonly BattleParticipant[]): number {
    const count = participants.length;
    const zoneUsage = new Map<string, number>();
    for (let index = 0; index < count; index += 1) {
      const participant = participants[index];
      if (!participant) continue;
      const fallback = this.defaultSpawn(participant, index, count, zoneUsage);
      this.world.spawn(
        participant,
        participant.x ?? fallback.x,
        participant.y ?? fallback.y,
        this.rng
      );
    }

    let maxRadius = 0;
    for (const id of this.world.activeIdsView()) {
      maxRadius = Math.max(maxRadius, this.world.radius[id] ?? 0);
    }
    return maxRadius;
  }

  private defaultSpawn(
    participant: BattleParticipant,
    index: number,
    count: number,
    zoneUsage: Map<string, number>
  ): Vec2 {
    const requested = participant.spawnZoneId
      ? this.arena.spawnZones.find((zone) => zone.id === participant.spawnZoneId)
      : undefined;
    const teamZones = this.arena.spawnZones.filter((zone) => zone.team === participant.team);
    const genericZones = this.arena.spawnZones.filter((zone) => zone.team === undefined);
    const zone = requested
      ?? teamZones[index % Math.max(1, teamZones.length)]
      ?? genericZones[index % Math.max(1, genericZones.length)];
    const fighter = getFighter(participant.fighterId);
    const spawnRadius = fighter.physics.radius * (participant.statScale?.radius ?? 1);
    if (zone) {
      const usage = zoneUsage.get(zone.id) ?? 0;
      zoneUsage.set(zone.id, usage + 1);
      const padding = spawnRadius + 10;
      const spacing = spawnRadius * 2 + 18;
      const usableWidth = Math.max(1, zone.width - padding * 2);
      const columns = Math.max(1, Math.floor(usableWidth / spacing) + 1);
      const row = Math.floor(usage / columns);
      const column = usage % columns;
      const jitterLimit = Math.min(6, Math.max(0, (spacing - spawnRadius * 2) * 0.25));
      const jitterX = this.rng.range(-jitterLimit, jitterLimit);
      const jitterY = this.rng.range(-jitterLimit, jitterLimit);
      return {
        x: zone.x + Math.min(zone.width - padding, padding + column * spacing) + jitterX,
        y: zone.y + Math.min(zone.height - padding, padding + row * spacing) + jitterY
      };
    }

    const centerX = this.arena.width / 2;
    const centerY = this.arena.height / 2;
    const orbitRadius = Math.max(
      spawnRadius + 8,
      Math.min(this.arena.width, this.arena.height) * 0.32 - spawnRadius
    );
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius
    };
  }
}
