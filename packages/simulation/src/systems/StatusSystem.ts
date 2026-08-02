import { getStatus } from '@kinetic/content';
import type { Element, EntityId, SimulationEvent } from '@kinetic/protocol';
import type { World } from '../world';

export type PeriodicDamageHandler = (
  sourceId: EntityId | null,
  targetId: EntityId,
  amount: number,
  element: Element,
  events: SimulationEvent[]
) => void;

/** Owns deterministic status countdown and periodic-damage processing. */
export class StatusSystem {
  private readonly activeIdScratch: EntityId[] = [];

  constructor(
    private readonly world: World,
    private readonly dealPeriodicDamage: PeriodicDamageHandler
  ) {}

  tick(events: SimulationEvent[]): void {
    // Periodic damage can kill an entity mid-loop, so use a stable reusable
    // copy rather than iterating the mutable active-id view directly.
    for (const entityId of this.world.copyActiveIdsInto(this.activeIdScratch)) {
      if (!this.world.hasAnyStatus(entityId)) continue;

      const statuses = this.world.getStatuses(entityId);
      for (const [statusId, status] of [...statuses.entries()]) {
        const definition = getStatus(statusId);
        status.remainingTicks -= 1;

        if (definition.periodicDamage && definition.periodTicks) {
          status.pulseCountdown -= 1;
          if (status.pulseCountdown <= 0) {
            this.dealPeriodicDamage(
              status.sourceId,
              entityId,
              definition.periodicDamage,
              definition.element ?? 'neutral',
              events
            );
            status.pulseCountdown = definition.periodTicks;
          }
        }

        if (status.remainingTicks <= 0) statuses.delete(statusId);
      }
    }
  }
}
