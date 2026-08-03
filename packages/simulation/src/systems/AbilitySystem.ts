import {
  getAbility,
  getAbilityActivationProfile,
  getFighter,
  type AbilityDefinition,
  type PassiveTriggerEvent
} from '@kinetic/content';
import type {
  AbilityRejectionReason,
  AbilitySlot,
  ActivateAbilityCommand,
  EntityId,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';
import type { ActiveCastState, ArmedAbilityState } from '../world';
import { World } from '../world';
import { AbilityActionExecutor } from './AbilityActionExecutor';
import type { ArenaCollisionSystem } from './ArenaCollisionSystem';
import type { CooldownSystem } from './CooldownSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import {
  normalizeAbilityVector,
  type AbilityCollisionContext,
  type AbilitySystemContext,
  type AbilityTriggerContext
} from './AbilitySystemTypes';

const SOLAR_LASER_ABILITY_ID = 'solar-laser';
const SOLAR_LASER_EYE_CHARGE_TICKS = 30;
const SOLAR_LASER_LOCK_TICKS = 18;
const SOLAR_LASER_WARMUP_TICKS = SOLAR_LASER_EYE_CHARGE_TICKS + SOLAR_LASER_LOCK_TICKS;
const SOLAR_LASER_DAMAGE_INTERVAL_TICKS = 6;
const SOLAR_LASER_RAMP_STAGE_TICKS = 54;
const SOLAR_LASER_RANGE = 1080;
const SOLAR_LASER_HALF_WIDTH = 9;

/** Owns ability activation, casts, collision windows, and channel lifecycle. */
export class AbilitySystem {
  private readonly actions: AbilityActionExecutor;

  constructor(
    private readonly world: World,
    private readonly arenaCollisions: ArenaCollisionSystem,
    private readonly cooldowns: CooldownSystem,
    projectiles: ProjectileSystem,
    private readonly activeCasts: Map<EntityId, ActiveCastState>,
    private readonly armedAbilities: Map<EntityId, Map<string, ArmedAbilityState>>,
    private readonly context: AbilitySystemContext
  ) {
    this.actions = new AbilityActionExecutor(world, projectiles, context);
  }

  activate(command: ActivateAbilityCommand, activeWeaponAttack: boolean, events: SimulationEvent[]): void {
    const fighter = getFighter(this.world.getFighterId(command.entityId));
    const abilityId = fighter.abilitySlots[command.slot];
    if (!abilityId) return;
    const ability = getAbility(abilityId);
    if (this.activeCasts.has(command.entityId) || activeWeaponAttack) {
      this.rejectPlayerActivation(command, ability.id, 'busy', events);
      return;
    }
    if (!this.cooldowns.isAbilityReady(command.entityId, ability.id)) {
      this.rejectPlayerActivation(command, ability.id, 'cooldown', events);
      return;
    }

    const target = command.targetId !== undefined && this.world.isAlive(command.targetId)
      ? command.targetId
      : null;
    const direction = this.resolveDirection(command.entityId, target, command.direction);
    const rejection = this.activationRejectionReason(command.entityId, ability, target, direction);
    if (rejection) {
      this.rejectPlayerActivation(command, ability.id, rejection, events);
      return;
    }

    const castTicks = ability.castTicks;
    this.cooldowns.startAbility(command.entityId, ability);
    events.push({
      type: 'abilityActivated',
      tick: this.context.getTick(),
      entityId: command.entityId,
      abilityId: ability.id,
      slot: command.slot,
      position: {
        x: this.world.x[command.entityId] ?? 0,
        y: this.world.y[command.entityId] ?? 0
      },
      direction,
      castTicks
    });
    if (castTicks <= 0) {
      this.resolveActivatedAbility(command.entityId, ability, command.slot, target, direction, events);
      return;
    }

    this.activeCasts.set(command.entityId, {
      abilityId: ability.id,
      slot: command.slot,
      targetId: target,
      direction,
      remainingTicks: castTicks,
      totalTicks: castTicks,
      anchorX: this.world.x[command.entityId] ?? 0,
      anchorY: this.world.y[command.entityId] ?? 0
    });
  }

  tickCasts(events: SimulationEvent[]): void {
    const ids = [...this.activeCasts.keys()].sort((a, b) => a - b);
    for (const entityId of ids) {
      const cast = this.activeCasts.get(entityId);
      if (!cast) continue;
      if (!this.world.isAlive(entityId)) {
        this.activeCasts.delete(entityId);
        continue;
      }

      if (cast.abilityId === SOLAR_LASER_ABILITY_ID) {
        this.tickSolarLaserCast(entityId, cast, events);
      }

      cast.remainingTicks -= 1;
      if (cast.remainingTicks > 0) continue;
      this.activeCasts.delete(entityId);
      const ability = getAbility(cast.abilityId);
      const target = cast.targetId !== null && this.world.isAlive(cast.targetId)
        ? cast.targetId
        : null;
      this.resolveActivatedAbility(entityId, ability, cast.slot, target, cast.direction, events);
    }
  }

  isSolarLaserChanneling(entityId: EntityId): boolean {
    return this.activeCasts.get(entityId)?.abilityId === SOLAR_LASER_ABILITY_ID;
  }

  lockSolarLaserCaster(entityId: EntityId): void {
    const cast = this.activeCasts.get(entityId);
    if (!cast || cast.abilityId !== SOLAR_LASER_ABILITY_ID) return;
    this.world.x[entityId] = cast.anchorX;
    this.world.y[entityId] = cast.anchorY;
    this.world.prevX[entityId] = cast.anchorX;
    this.world.prevY[entityId] = cast.anchorY;
    this.world.vx[entityId] = 0;
    this.world.vy[entityId] = 0;
    if (cast.targetId !== null && this.world.isAlive(cast.targetId)) {
      const dx = (this.world.x[cast.targetId] ?? 0) - cast.anchorX;
      const dy = (this.world.y[cast.targetId] ?? 0) - cast.anchorY;
      if (Math.hypot(dx, dy) > 0.0001) {
        cast.direction = normalizeAbilityVector({ x: dx, y: dy });
        this.world.rotation[entityId] = Math.atan2(cast.direction.y, cast.direction.x);
      }
    }
    this.context.removeExternalImpulse(entityId);
  }

  enforceSolarLaserLocks(): void {
    for (const entityId of this.activeCasts.keys()) {
      if (this.isSolarLaserChanneling(entityId)) this.lockSolarLaserCaster(entityId);
    }
  }

  expireArmedAbilities(): void {
    const tick = this.context.getTick();
    for (const [entityId, armed] of this.armedAbilities) {
      if (!this.world.isAlive(entityId)) {
        this.armedAbilities.delete(entityId);
        continue;
      }
      for (const [abilityId, state] of armed) {
        if (state.expiresTick <= tick) armed.delete(abilityId);
      }
      if (armed.size === 0) this.armedAbilities.delete(entityId);
    }
  }

  triggerCollisionAbilities(context: AbilityCollisionContext, events: SimulationEvent[]): void {
    const armed = this.armedAbilities.get(context.self);
    if (!armed || armed.size === 0) return;
    const fighter = getFighter(this.world.getFighterId(context.self));
    const slotByAbility = new Map<string, AbilitySlot>();
    for (const slot of ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'] as AbilitySlot[]) {
      const abilityId = fighter.abilitySlots[slot];
      if (abilityId) slotByAbility.set(abilityId, slot);
    }

    for (const abilityId of [...armed.keys()].sort()) {
      const state = armed.get(abilityId);
      if (!state || state.expiresTick <= this.context.getTick()) continue;
      const slot = slotByAbility.get(abilityId);
      if (!slot) continue;
      const ability = getAbility(abilityId);
      const triggerContext: AbilityTriggerContext = { ...context, abilityId: ability.id };
      const fired = this.actions.executeTriggers(ability, 'ON_COLLISION', triggerContext, events);
      if (!fired) continue;
      armed.delete(abilityId);
      const position = {
        x: this.world.x[context.self] ?? 0,
        y: this.world.y[context.self] ?? 0
      };
      events.push({
        type: 'abilityResolved',
        tick: this.context.getTick(),
        entityId: context.self,
        abilityId: ability.id,
        slot,
        position,
        direction: context.normal
      });
      this.actions.triggerPassives(context.self, 'ON_ABILITY_RESOLVED', triggerContext, events);
    }
    if (armed.size === 0) this.armedAbilities.delete(context.self);
  }

  triggerBattleStartPassives(events: SimulationEvent[]): void {
    for (const entityId of this.world.activeIdsView()) {
      this.actions.triggerPassives(entityId, 'ON_BATTLE_START', {
        self: entityId,
        target: null,
        impact: 0,
        normal: { x: 1, y: 0 },
        abilityId: 'battle-start'
      }, events);
    }
  }

  triggerPassives(
    entityId: EntityId,
    event: PassiveTriggerEvent,
    context: AbilityTriggerContext,
    events: SimulationEvent[]
  ): void {
    this.actions.triggerPassives(entityId, event, context, events);
  }

  resolveDirection(self: EntityId, target: EntityId | null, requested?: Vec2): Vec2 {
    if (requested && Math.hypot(requested.x, requested.y) > 0.001) return requested;
    if (target !== null) {
      const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
      const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    }
    const vx = this.world.vx[self] ?? 0;
    const vy = this.world.vy[self] ?? 0;
    const length = Math.hypot(vx, vy) || 1;
    return { x: vx / length, y: vy / length };
  }

  hasLineOfSight(self: EntityId, target: EntityId): boolean {
    return this.arenaCollisions.hasLineOfSight(
      this.world.x[self] ?? 0,
      this.world.y[self] ?? 0,
      this.world.x[target] ?? 0,
      this.world.y[target] ?? 0
    );
  }

  private tickSolarLaserCast(entityId: EntityId, cast: ActiveCastState, events: SimulationEvent[]): void {
    let targetId = cast.targetId;
    if (
      targetId === null
      || !this.world.isAlive(targetId)
      || this.world.getTeam(targetId) === this.world.getTeam(entityId)
    ) {
      targetId = this.hostileTargetsByDistance(entityId)[0] ?? null;
      cast.targetId = targetId;
    }

    if (targetId !== null) {
      const dx = (this.world.x[targetId] ?? 0) - (this.world.x[entityId] ?? 0);
      const dy = (this.world.y[targetId] ?? 0) - (this.world.y[entityId] ?? 0);
      const distance = Math.hypot(dx, dy);
      if (distance > 0.0001) {
        cast.direction = { x: dx / distance, y: dy / distance };
        this.world.rotation[entityId] = Math.atan2(cast.direction.y, cast.direction.x);
      }

      const elapsedTicks = cast.totalTicks - cast.remainingTicks;
      const beamTicks = elapsedTicks - SOLAR_LASER_WARMUP_TICKS;
      const beamActive = beamTicks >= 0;
      const damagePulse = beamActive && beamTicks % SOLAR_LASER_DAMAGE_INTERVAL_TICKS === 0;
      if (damagePulse && this.solarLaserHitsTarget(entityId, targetId, cast.direction)) {
        const rampStage = beamTicks < SOLAR_LASER_RAMP_STAGE_TICKS
          ? 0
          : beamTicks < SOLAR_LASER_RAMP_STAGE_TICKS * 2
            ? 1
            : 2;
        const damage = rampStage === 0 ? 2.2 : rampStage === 1 ? 3.5 : 5.2;
        this.context.dealDamage(entityId, targetId, damage, 'fire', events);
      }
    }

    this.lockSolarLaserCaster(entityId);
  }

  private solarLaserHitsTarget(entityId: EntityId, targetId: EntityId, direction: Vec2): boolean {
    if (!this.world.isAlive(entityId) || !this.world.isAlive(targetId)) return false;
    if (!this.hasLineOfSight(entityId, targetId)) return false;

    const originX = this.world.x[entityId] ?? 0;
    const originY = this.world.y[entityId] ?? 0;
    const targetX = this.world.x[targetId] ?? 0;
    const targetY = this.world.y[targetId] ?? 0;
    const beamDirection = normalizeAbilityVector(direction);
    const offsetX = targetX - originX;
    const offsetY = targetY - originY;
    const projection = offsetX * beamDirection.x + offsetY * beamDirection.y;
    const targetRadius = this.world.radius[targetId] ?? 0;

    if (projection < -targetRadius || projection > SOLAR_LASER_RANGE + targetRadius) return false;

    const closestX = originX + beamDirection.x * Math.max(0, projection);
    const closestY = originY + beamDirection.y * Math.max(0, projection);
    const perpendicularX = targetX - closestX;
    const perpendicularY = targetY - closestY;
    const hitRadius = targetRadius + SOLAR_LASER_HALF_WIDTH;
    return perpendicularX * perpendicularX + perpendicularY * perpendicularY <= hitRadius * hitRadius;
  }

  private resolveActivatedAbility(
    entityId: EntityId,
    ability: AbilityDefinition,
    slot: AbilitySlot,
    target: EntityId | null,
    direction: Vec2,
    events: SimulationEvent[]
  ): void {
    if (!this.world.isAlive(entityId)) return;
    const hasCollisionTrigger = ability.triggers.some((trigger) => trigger.event === 'ON_COLLISION');
    this.actions.executeTriggers(
      ability,
      'ON_ACTIVATE',
      { self: entityId, target, impact: 0, normal: direction, abilityId: ability.id },
      events
    );

    if (hasCollisionTrigger) {
      this.armCollisionAbility(entityId, ability);
      return;
    }

    events.push({
      type: 'abilityResolved',
      tick: this.context.getTick(),
      entityId,
      abilityId: ability.id,
      slot,
      position: { x: this.world.x[entityId] ?? 0, y: this.world.y[entityId] ?? 0 },
      direction
    });
    this.actions.triggerPassives(
      entityId,
      'ON_ABILITY_RESOLVED',
      { self: entityId, target, impact: 0, normal: direction, abilityId: ability.id },
      events
    );
  }

  private armCollisionAbility(entityId: EntityId, ability: AbilityDefinition): void {
    const activation = getAbilityActivationProfile(ability, this.world.getFighterId(entityId));
    if (activation.collisionWindowTicks <= 0) return;
    const armed = this.armedAbilities.get(entityId) ?? new Map<string, ArmedAbilityState>();
    armed.set(ability.id, {
      abilityId: ability.id,
      expiresTick: this.context.getTick() + activation.collisionWindowTicks,
      totalTicks: activation.collisionWindowTicks
    });
    this.armedAbilities.set(entityId, armed);
  }

  private activationRejectionReason(
    self: EntityId,
    ability: AbilityDefinition,
    target: EntityId | null,
    direction: Vec2
  ): AbilityRejectionReason | null {
    const activation = getAbilityActivationProfile(ability, this.world.getFighterId(self));
    if (activation.targeting !== 'self' && target === null && activation.targeting !== 'direction') {
      return 'target-required';
    }

    if (target !== null) {
      if (!this.world.isAlive(target) || this.world.getTeam(target) === this.world.getTeam(self)) {
        return 'invalid-target';
      }
      const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
      const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
      const distance = Math.hypot(dx, dy);
      if (distance < activation.minRange || distance > activation.maxRange) return 'out-of-range';
      if (activation.requiresLineOfSight && !this.hasLineOfSight(self, target)) return 'line-of-sight';
      if (activation.aimToleranceDegrees < 180) {
        const length = distance || 1;
        const dot = Math.max(
          -1,
          Math.min(1, direction.x * (dx / length) + direction.y * (dy / length))
        );
        const angle = Math.acos(dot) * 180 / Math.PI;
        if (angle > activation.aimToleranceDegrees) return 'aim-tolerance';
      }
    }

    if (activation.targeting === 'area' && activation.minimumTargets > 0) {
      const nearby = this.world.activeIds().filter((id) => {
        if (id === self || this.world.getTeam(id) === this.world.getTeam(self)) return false;
        const dx = (this.world.x[id] ?? 0) - (this.world.x[self] ?? 0);
        const dy = (this.world.y[id] ?? 0) - (this.world.y[self] ?? 0);
        return dx * dx + dy * dy <= activation.maxRange * activation.maxRange;
      }).length;
      if (nearby < activation.minimumTargets) return 'minimum-targets';
    }
    const activateTriggers = ability.triggers.filter((trigger) => trigger.event === 'ON_ACTIVATE');
    if (activateTriggers.length > 0) {
      const context: AbilityTriggerContext = {
        self,
        target,
        impact: 0,
        normal: direction,
        abilityId: ability.id
      };
      if (!activateTriggers.some((trigger) =>
        trigger.conditions.every((condition) => this.actions.conditionPasses(condition, context)))) {
        return 'requirements-not-met';
      }
    }
    return null;
  }

  private rejectPlayerActivation(
    command: ActivateAbilityCommand,
    abilityId: string,
    reason: AbilityRejectionReason,
    events: SimulationEvent[]
  ): void {
    if (this.world.getController(command.entityId) !== 'player') return;
    events.push({
      type: 'abilityRejected',
      tick: this.context.getTick(),
      entityId: command.entityId,
      abilityId,
      slot: command.slot,
      reason,
      ...(command.targetId !== undefined ? { targetId: command.targetId } : {})
    });
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
}
