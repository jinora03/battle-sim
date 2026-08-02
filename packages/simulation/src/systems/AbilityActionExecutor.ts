import {
  getFighter,
  getPassive,
  getProjectileSource,
  type AbilityAction,
  type AbilityCondition,
  type AbilityDefinition,
  type PassiveTriggerEvent
} from '@kinetic/content';
import type { EntityId, SimulationEvent, Vec2 } from '@kinetic/protocol';
import { resolveImpulseDirection } from '../combatModifiers';
import { World } from '../world';
import type { ProjectileSystem } from './ProjectileSystem';
import {
  normalizeAbilityVector,
  type AbilitySystemContext,
  type AbilityTriggerContext
} from './AbilitySystemTypes';

/** Executes data-driven ability and passive actions in deterministic order. */
export class AbilityActionExecutor {
  constructor(
    private readonly world: World,
    private readonly projectiles: ProjectileSystem,
    private readonly context: AbilitySystemContext
  ) {}

  triggerPassives(
    entityId: EntityId,
    event: PassiveTriggerEvent,
    context: AbilityTriggerContext,
    events: SimulationEvent[]
  ): void {
    if (!this.world.isAlive(entityId)) return;
    const fighter = getFighter(this.world.getFighterId(entityId));
    for (const passiveId of fighter.passiveIds ?? []) {
      const passive = getPassive(passiveId);
      let fired = false;
      for (const trigger of passive.triggers) {
        if (trigger.event !== event) continue;
        if (!trigger.conditions.every((condition) => this.conditionPasses(condition, context))) continue;
        fired = true;
        for (const action of trigger.actions) {
          this.executeAction(action, { ...context, abilityId: passive.id }, events);
        }
      }
      if (fired) {
        events.push({
          type: 'passiveTriggered',
          tick: this.context.getTick(),
          entityId,
          passiveId,
          ...(context.target !== null ? { targetId: context.target } : {})
        });
      }
    }
  }

  executeTriggers(
    ability: AbilityDefinition,
    event: 'ON_ACTIVATE' | 'ON_COLLISION' | 'ON_HEALTH_BELOW',
    context: AbilityTriggerContext,
    events: SimulationEvent[]
  ): boolean {
    let fired = false;
    for (const trigger of ability.triggers) {
      if (trigger.event !== event) continue;
      if (!trigger.conditions.every((condition) => this.conditionPasses(condition, context))) continue;
      fired = true;
      for (const action of trigger.actions) this.executeAction(action, context, events);
    }
    return fired;
  }

  conditionPasses(
    condition: AbilityCondition,
    context: { self: EntityId; target: EntityId | null; impact: number }
  ): boolean {
    if (condition.type === 'IMPACT_ABOVE') return context.impact >= condition.value;
    if (condition.type === 'SELF_HAS_STATUS') {
      return this.world.getStatusStacks(context.self, condition.statusId) >= (condition.minimumStacks ?? 1);
    }
    if (condition.type === 'TARGET_HAS_STATUS') {
      if (context.target === null) return false;
      const stacks = this.world.getStatusStacks(context.target, condition.statusId);
      return stacks >= (condition.minimumStacks ?? 1)
        && stacks <= (condition.maximumStacks ?? Number.POSITIVE_INFINITY);
    }
    return (this.world.hp[context.self] ?? 0)
      / Math.max(1, this.world.maxHp[context.self] ?? 1)
      <= condition.ratio;
  }

  private executeAction(
    action: AbilityAction,
    context: AbilityTriggerContext,
    events: SimulationEvent[]
  ): void {
    const { self, target } = context;
    if (!this.world.isAlive(self)) return;

    switch (action.type) {
      case 'APPLY_IMPULSE_SELF': {
        const impulseDirection = resolveImpulseDirection(context.normal, action.direction);
        this.context.addExternalImpulse(
          self,
          impulseDirection.x * action.magnitude,
          impulseDirection.y * action.magnitude
        );
        break;
      }
      case 'DEAL_DAMAGE_TARGET':
        if (target !== null) this.context.dealDamage(self, target, action.amount, action.element, events);
        break;
      case 'APPLY_STATUS_SELF':
        this.context.applyStatus(
          self,
          self,
          action.statusId,
          action.durationTicks,
          events,
          action.stacks ?? 1
        );
        break;
      case 'APPLY_STATUS_TARGET':
        if (target !== null) {
          this.context.applyStatus(
            self,
            target,
            action.statusId,
            action.durationTicks,
            events,
            action.stacks ?? 1
          );
        }
        break;
      case 'REMOVE_STATUS_SELF':
        this.world.removeStatus(self, action.statusId);
        break;
      case 'REMOVE_STATUS_TARGET':
        if (target !== null) this.world.removeStatusStacks(target, action.statusId, action.stacks ?? 'all');
        break;
      case 'APPLY_KNOCKBACK_TARGET':
        if (target !== null && this.world.isAlive(target)) {
          this.context.applyKnockback(self, target, action.magnitude, events, 'ability');
        }
        break;
      case 'RADIAL_IMPULSE': {
        const sign = action.direction === 'pull' ? -1 : 1;
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => {
          this.context.applyKnockback(self, other, action.magnitude * sign, events, 'ability');
        });
        break;
      }
      case 'RADIAL_DAMAGE':
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => {
          this.context.dealDamage(self, other, action.amount, action.element, events);
        });
        break;
      case 'DIRECTIONAL_DAMAGE':
        this.forEachInCone(
          self,
          action.range,
          action.arcDegrees,
          action.enemiesOnly,
          context.normal,
          (other) => {
            this.context.dealDamage(self, other, action.amount, action.element, events);
            if (action.knockback > 0 && this.world.isAlive(other)) {
              this.context.applyKnockback(self, other, action.knockback, events, 'ability');
            }
          }
        );
        break;
      case 'RADIAL_STATUS':
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => {
          this.context.applyStatus(
            self,
            other,
            action.statusId,
            action.durationTicks,
            events,
            action.stacks ?? 1
          );
        });
        break;
      case 'EXPLODE': {
        const position = { x: this.world.x[self] ?? 0, y: this.world.y[self] ?? 0 };
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => {
          if (action.damage > 0) {
            this.context.dealDamage(self, other, action.damage, action.element, events);
          }
          if (action.impulse > 0 && this.world.isAlive(other)) {
            this.context.applyKnockback(
              self,
              other,
              this.context.damageScaledImpulse(action.impulse, action.damage),
              events,
              'explosion',
              this.context.explosionImpulseOptions(action.damage, context.abilityId)
            );
          }
        });
        events.push({
          type: 'blast',
          tick: this.context.getTick(),
          sourceId: self,
          abilityId: context.abilityId,
          kind: action.kind,
          position,
          radius: action.radius,
          force: this.context.damageScaledImpulse(action.impulse, action.damage),
          damage: action.damage,
          element: action.element
        });
        break;
      }
      case 'EXPLODE_AT_TARGET': {
        if (target === null || !this.world.isAlive(target)) break;
        const position = { x: this.world.x[target] ?? 0, y: this.world.y[target] ?? 0 };
        this.forEachAroundPoint(self, position, action.radius, action.enemiesOnly, (other) => {
          if (action.damage > 0) {
            this.context.dealDamage(self, other, action.damage, action.element, events);
          }
          if (action.impulse > 0 && this.world.isAlive(other)) {
            const fallback = {
              x: (this.world.x[other] ?? 0) - (this.world.x[self] ?? 0),
              y: (this.world.y[other] ?? 0) - (this.world.y[self] ?? 0)
            };
            this.context.applyKnockbackFromPoint(
              self,
              position,
              other,
              this.context.damageScaledImpulse(action.impulse, action.damage),
              events,
              'explosion',
              fallback,
              this.context.explosionImpulseOptions(action.damage, context.abilityId)
            );
          }
        });
        events.push({
          type: 'blast',
          tick: this.context.getTick(),
          sourceId: self,
          abilityId: context.abilityId,
          kind: action.kind,
          position,
          radius: action.radius,
          force: this.context.damageScaledImpulse(action.impulse, action.damage),
          damage: action.damage,
          element: action.element
        });
        break;
      }
      case 'LAUNCH_PROJECTILES': {
        const projectile = getProjectileSource(action.projectileId);
        const candidates = this.hostileTargetsByDistance(self);
        const selectedTarget = target !== null
          && this.world.isAlive(target)
          && this.world.getTeam(target) !== this.world.getTeam(self)
          ? target
          : null;
        const baseDirection = normalizeAbilityVector(context.normal);
        const count = Math.max(1, action.count);
        const intervalTicks = Math.max(0, action.intervalTicks ?? 0);
        for (let index = 0; index < count; index += 1) {
          const targetId = action.targetMode === 'selected'
            ? selectedTarget
            : action.targetMode === 'nearest'
              ? (selectedTarget ?? candidates[0] ?? null)
              : (candidates.length > 0
                  ? candidates[index % candidates.length] ?? null
                  : selectedTarget);
          let direction = baseDirection;
          if (action.pattern === 'radial') {
            const angle = Math.atan2(baseDirection.y, baseDirection.x)
              + (index / count) * Math.PI * 2;
            direction = { x: Math.cos(angle), y: Math.sin(angle) };
          } else if (action.pattern === 'fan' && count > 1) {
            const spread = action.spreadDegrees * Math.PI / 180;
            const angle = Math.atan2(baseDirection.y, baseDirection.x)
              + ((index / (count - 1)) - 0.5) * spread;
            direction = { x: Math.cos(angle), y: Math.sin(angle) };
          } else if (targetId !== null) {
            direction = normalizeAbilityVector({
              x: (this.world.x[targetId] ?? 0) - (this.world.x[self] ?? 0),
              y: (this.world.y[targetId] ?? 0) - (this.world.y[self] ?? 0)
            });
          }

          const delayTicks = index * intervalTicks;
          if (delayTicks === 0) {
            this.projectiles.spawn(self, projectile, direction, events, 0, 1, targetId);
          } else {
            this.projectiles.schedule(
              self,
              action.projectileId,
              direction,
              targetId,
              this.context.getTick() + delayTicks
            );
          }
        }
        break;
      }
      case 'USE_WEAPON':
        // Deprecated. Skills cannot execute the fighter's primary attack in Stage 7.2.
        break;
      case 'HEAL_SELF':
        this.world.hp[self] = Math.min(
          this.world.maxHp[self] ?? 0,
          (this.world.hp[self] ?? 0) + action.amount
        );
        break;
    }
  }

  private hostileTargetsByDistance(source: EntityId): EntityId[] {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const team = this.world.getTeam(source);
    return this.world.activeIds()
      .filter((id) => id !== source && this.world.getTeam(id) !== team)
      .map((id) => {
        const dx = (this.world.x[id] ?? 0) - sx;
        const dy = (this.world.y[id] ?? 0) - sy;
        return { id, distanceSq: dx * dx + dy * dy };
      })
      .sort((a, b) => a.distanceSq - b.distanceSq || a.id - b.id)
      .map((entry) => entry.id);
  }

  private forEachInRadius(
    source: EntityId,
    radius: number,
    enemiesOnly: boolean,
    callback: (id: EntityId) => void
  ): void {
    this.forEachAroundPoint(
      source,
      { x: this.world.x[source] ?? 0, y: this.world.y[source] ?? 0 },
      radius,
      enemiesOnly,
      callback
    );
  }

  private forEachAroundPoint(
    source: EntityId,
    center: Vec2,
    radius: number,
    enemiesOnly: boolean,
    callback: (id: EntityId) => void
  ): void {
    for (const id of this.world.activeIdsView()) {
      if (id === source) continue;
      if (enemiesOnly && this.world.getTeam(id) === this.world.getTeam(source)) continue;
      const dx = (this.world.x[id] ?? 0) - center.x;
      const dy = (this.world.y[id] ?? 0) - center.y;
      if (dx * dx + dy * dy <= radius * radius) callback(id);
    }
  }

  private forEachInCone(
    source: EntityId,
    range: number,
    arcDegrees: number,
    enemiesOnly: boolean,
    direction: Vec2,
    callback: (id: EntityId) => void
  ): void {
    const normalized = normalizeAbilityVector(direction);
    const cosThreshold = Math.cos((arcDegrees * Math.PI / 180) / 2);
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    for (const id of this.world.activeIdsView()) {
      if (id === source) continue;
      if (enemiesOnly && this.world.getTeam(id) === this.world.getTeam(source)) continue;
      const dx = (this.world.x[id] ?? 0) - sx;
      const dy = (this.world.y[id] ?? 0) - sy;
      const distance = Math.hypot(dx, dy);
      if (distance > range || distance <= 0.0001) continue;
      const dot = (dx / distance) * normalized.x + (dy / distance) * normalized.y;
      if (dot >= cosThreshold) callback(id);
    }
  }
}
