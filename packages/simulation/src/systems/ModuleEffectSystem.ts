import type { EntityId, SimulationEvent } from '@kinetic/protocol';
import type { World } from '../world';

export interface ModuleEffectSystemContext {
  getTick(): number;
  applyStatus(
    sourceId: EntityId,
    targetId: EntityId,
    statusId: string,
    durationTicks: number,
    events: SimulationEvent[],
    stacks?: number
  ): void;
}

/** Runs deterministic, content-authored periodic effects supplied by equipped modules. */
export class ModuleEffectSystem {
  constructor(
    private readonly world: World,
    private readonly context: ModuleEffectSystemContext
  ) {}

  tick(events: SimulationEvent[]): void {
    const tick = this.context.getTick();
    for (const sourceId of this.world.activeIdsView()) {
      const pulses = this.world.getLoadout(sourceId).periodicStatusPulses;
      if (pulses.length === 0) continue;
      for (const pulse of pulses) {
        if (tick % pulse.intervalTicks !== 0) continue;
        if (
          pulse.resourceId
          && this.world.getCombatResourceValue(sourceId, pulse.resourceId) < (pulse.minimumResource ?? 0)
        ) {
          continue;
        }
        const sourceX = this.world.x[sourceId] ?? 0;
        const sourceY = this.world.y[sourceId] ?? 0;
        const radiusSquared = pulse.radius * pulse.radius;
        const sourceTeam = this.world.getTeam(sourceId);
        for (const targetId of this.world.activeIdsView()) {
          if (targetId === sourceId || this.world.getTeam(targetId) === sourceTeam) continue;
          const dx = (this.world.x[targetId] ?? 0) - sourceX;
          const dy = (this.world.y[targetId] ?? 0) - sourceY;
          if (dx * dx + dy * dy > radiusSquared) continue;
          this.context.applyStatus(
            sourceId,
            targetId,
            pulse.statusId,
            pulse.durationTicks,
            events,
            pulse.stacks
          );
        }
      }
    }
  }
}
