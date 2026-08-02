import {
  getElementMultiplier,
  getFighter
} from '@kinetic/content';
import type {
  DamageEvent,
  Element,
  EntityId,
  SimulationEvent
} from '@kinetic/protocol';
import type { World } from '../world';

export interface DamageSystemContext {
  getTick(): number;
  friendlyFireEnabled(): boolean;
  damageIsPrevented(targetId: EntityId): boolean;
  clearExternalImpulse(targetId: EntityId): void;
}

/**
 * Owns authoritative health damage, training prevention and death events.
 *
 * The system deliberately receives policy through callbacks so battle rules and
 * mutable training settings remain owned by LocalSimulationRunner.
 */
export class DamageSystem {
  constructor(
    private readonly world: World,
    private readonly context: DamageSystemContext
  ) {}

  dealDamage(
    sourceId: EntityId | null,
    targetId: EntityId,
    rawAmount: number,
    element: Element,
    events: SimulationEvent[]
  ): void {
    if (!this.world.isAlive(targetId) || rawAmount <= 0) return;
    if (
      sourceId !== null
      && sourceId !== targetId
      && this.world.getTeam(sourceId) === this.world.getTeam(targetId)
      && !this.context.friendlyFireEnabled()
    ) {
      return;
    }

    const target = getFighter(this.world.getFighterId(targetId));
    const resistance = target.resistances[element] ?? 1;
    const elementMultiplier = getElementMultiplier(
      element,
      target.classification.elements
    );
    const sourceDamageScale = sourceId !== null
      ? (this.world.damageScale[sourceId] ?? 1)
      : 1;
    const incomingDamageMultiplier = this.world
      .getLoadout(targetId)
      .incomingDamageMultiplier;
    const amount = Math.max(
      0,
      rawAmount
        * sourceDamageScale
        * resistance
        * elementMultiplier
        * incomingDamageMultiplier
    );
    const prevented = this.context.damageIsPrevented(targetId);

    if (!prevented) {
      this.world.hp[targetId] = Math.max(
        0,
        (this.world.hp[targetId] ?? 0) - amount
      );
    }

    const damageEvent: DamageEvent = {
      type: 'damage',
      tick: this.context.getTick(),
      targetId,
      amount,
      element,
      hpAfter: this.world.hp[targetId] ?? 0,
      position: {
        x: this.world.x[targetId] ?? 0,
        y: this.world.y[targetId] ?? 0
      },
      ...(sourceId !== null ? { sourceId } : {}),
      ...(prevented ? { prevented: true } : {})
    };
    events.push(damageEvent);

    if (prevented || (this.world.hp[targetId] ?? 0) > 0) return;

    const position = {
      x: this.world.x[targetId] ?? 0,
      y: this.world.y[targetId] ?? 0
    };
    this.world.kill(targetId);
    this.context.clearExternalImpulse(targetId);
    events.push({
      type: 'death',
      tick: this.context.getTick(),
      entityId: targetId,
      position,
      ...(sourceId !== null ? { killerId: sourceId } : {})
    });
  }
}
