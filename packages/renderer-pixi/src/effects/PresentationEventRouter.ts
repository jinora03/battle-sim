import {
  compactMissilePresentationEvents,
  compactMissileSecondaryPresentationEvents,
  isMissileWeapon,
  MissileCascadeTracker,
  shouldPresentDamage
} from '../combatFeedback';
import {
  budgetPresentationEvents,
  resolveMassBattleRenderPolicy,
  selectProjectileVisuals
} from '../massBattlePolicy';
import type {
  EntityId,
  ProjectileSnapshot,
  SimulationEvent,
  WorldSnapshot
} from '@kinetic/protocol';

export interface PresentationFrame {
  playerEntityIds: ReadonlySet<EntityId>;
  renderPolicy: ReturnType<typeof resolveMassBattleRenderPolicy>;
  presentationEvents: readonly SimulationEvent[];
  visibleProjectiles: readonly ProjectileSnapshot[];
  missileBarrageActive: boolean;
  playerHitmarkerFlash: number;
}

/**
 * Converts semantic simulation events into a deterministic, budgeted visual
 * frame and accumulates per-fighter hit feedback for FighterView.
 */
export class PresentationEventRouter {
  readonly impactByEntity = new Map<EntityId, number>();
  readonly damageByEntity = new Map<EntityId, number>();
  private readonly playerEntityIds = new Set<EntityId>();
  private readonly missileCascadeTracker = new MissileCascadeTracker();

  route(
    snapshot: WorldSnapshot,
    events: readonly SimulationEvent[],
    targetRenderFps: 30 | 60,
    performanceScale: number
  ): PresentationFrame {
    this.playerEntityIds.clear();
    for (const entity of snapshot.entities) {
      if (entity.controller === 'player') this.playerEntityIds.add(entity.id);
    }

    const renderPolicy = resolveMassBattleRenderPolicy(
      snapshot.entities.length,
      targetRenderFps,
      performanceScale
    );
    const missileCausalFrame = this.missileCascadeTracker.shouldSuppressFreeze(
      events,
      snapshot.tick
    );
    const compactedEvents = compactMissilePresentationEvents(events);
    const missileBarrageActive = missileCausalFrame
      || snapshot.projectiles.some((projectile) => isMissileWeapon(projectile.weaponId));
    const unbudgetedPresentationEvents = missileBarrageActive
      ? compactMissileSecondaryPresentationEvents(compactedEvents)
      : compactedEvents;
    const presentationEvents = budgetPresentationEvents(
      unbudgetedPresentationEvents,
      renderPolicy.maxPresentationEvents,
      this.playerEntityIds
    );
    const visibleProjectiles = selectProjectileVisuals(
      snapshot.projectiles,
      renderPolicy.maxProjectileVisuals,
      this.playerEntityIds
    );

    let playerHitmarkerFlash = 0;
    for (const event of events) {
      if (event.type === 'impact') {
        this.impactByEntity.set(
          event.a,
          Math.max(this.impactByEntity.get(event.a) ?? 0, event.magnitude)
        );
        this.impactByEntity.set(
          event.b,
          Math.max(this.impactByEntity.get(event.b) ?? 0, event.magnitude)
        );
      } else if (event.type === 'damage' && shouldPresentDamage(event)) {
        this.damageByEntity.set(
          event.targetId,
          Math.max(this.damageByEntity.get(event.targetId) ?? 0, event.amount)
        );
        if (
          event.sourceId !== undefined
          && this.playerEntityIds.has(event.sourceId)
          && !this.playerEntityIds.has(event.targetId)
        ) {
          playerHitmarkerFlash = Math.max(
            playerHitmarkerFlash,
            Math.min(1, 0.66 + event.amount / 28)
          );
        }
      }
    }

    return {
      playerEntityIds: this.playerEntityIds,
      renderPolicy,
      presentationEvents,
      visibleProjectiles,
      missileBarrageActive,
      playerHitmarkerFlash
    };
  }

  reset(): void {
    this.playerEntityIds.clear();
    this.missileCascadeTracker.reset();
  }
}
