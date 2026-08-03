import { getFighter, type CombatResourceDefinition } from '@kinetic/content';
import type { Element, EntityId } from '@kinetic/protocol';
import type { World } from '../world';

export interface CombatResourceSystemContext {
  getTick(): number;
  tickRate: number;
}

/**
 * Owns deterministic fighter-resource gain, clamping and delayed decay.
 *
 * Resource rules live in fighter content. The system is intentionally generic:
 * Heat is the first user, but Charge, Rage, Frost and similar resources can use
 * the same state and event hooks without adding fighter-specific simulation code.
 */
export class CombatResourceSystem {
  constructor(
    private readonly world: World,
    private readonly context: CombatResourceSystemContext
  ) {}

  tick(): void {
    const tick = this.context.getTick();
    for (const entityId of this.world.activeIdsView()) {
      if (this.world.getCombatResources(entityId).size === 0) continue;
      const fighter = getFighter(this.world.getFighterId(entityId));
      const loadout = this.world.getLoadout(entityId);
      for (const definition of fighter.combatResources ?? []) {
        if (definition.decayPerSecond <= 0) continue;
        const value = this.world.getCombatResourceValue(entityId, definition.id);
        if (value <= 0) continue;
        const elapsedSinceGain = tick - this.world.getCombatResourceLastGainTick(entityId, definition.id);
        if (elapsedSinceGain < definition.decayDelayTicks) continue;
        this.world.modifyCombatResource(
          entityId,
          definition.id,
          -definition.decayPerSecond
            * (loadout.resourceDecayMultiplier[definition.id] ?? 1)
            / Math.max(1, this.context.tickRate),
          tick,
          false
        );
      }
    }
  }

  recordDamageDealt(
    sourceId: EntityId | null,
    amount: number,
    element: Element
  ): void {
    if (sourceId === null || !this.world.isAlive(sourceId) || amount <= 0) return;
    if (this.world.getCombatResources(sourceId).size === 0) return;
    const fighter = getFighter(this.world.getFighterId(sourceId));
    for (const definition of fighter.combatResources ?? []) {
      for (const rule of definition.gainRules) {
        if (rule.event !== 'DAMAGE_DEALT') continue;
        if (rule.element !== undefined && rule.element !== element) continue;
        const unbounded = amount * rule.amountPerDamage;
        const gain = rule.maximumPerEvent === undefined
          ? unbounded
          : Math.min(rule.maximumPerEvent, unbounded);
        this.gain(sourceId, definition, gain);
      }
    }
  }

  recordStatusApplied(
    sourceId: EntityId,
    targetId: EntityId,
    statusId: string,
    addedStacks: number
  ): void {
    if (sourceId === targetId || !this.world.isAlive(sourceId) || addedStacks <= 0) return;
    if (this.world.getCombatResources(sourceId).size === 0) return;
    const fighter = getFighter(this.world.getFighterId(sourceId));
    for (const definition of fighter.combatResources ?? []) {
      for (const rule of definition.gainRules) {
        if (rule.event !== 'STATUS_APPLIED' || rule.statusId !== statusId) continue;
        this.gain(sourceId, definition, rule.amountPerStack * addedStacks);
      }
    }
  }

  modify(entityId: EntityId, resourceId: string, amount: number): number {
    return this.world.modifyCombatResource(
      entityId,
      resourceId,
      amount,
      this.context.getTick(),
      amount > 0
    );
  }

  private gain(
    entityId: EntityId,
    definition: CombatResourceDefinition,
    amount: number
  ): void {
    if (amount <= 0) return;
    const multiplier = this.world.getLoadout(entityId).resourceGainMultiplier[definition.id] ?? 1;
    this.world.modifyCombatResource(
      entityId,
      definition.id,
      amount * multiplier,
      this.context.getTick(),
      true
    );
  }
}
