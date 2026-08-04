import {
  getFighter,
  getPrimaryAttack,
  type PrimaryAttackDefinition,
  type PrimaryConeChannelDefinition,
  type ResolvedFighterLoadout
} from '@kinetic/content';
import type {
  ActivatePrimaryAttackCommand,
  Element,
  EntityId,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';
import type { ActiveCastState, ActiveWeaponAttackState, World } from '../world';
import type { AbilitySystem } from './AbilitySystem';
import type { CooldownSystem } from './CooldownSystem';
import type { DamageSystem } from './DamageSystem';
import type { KnockbackSystem } from './KnockbackSystem';
import type { ProjectileSystem } from './ProjectileSystem';

export interface PrimaryAttackSystemContext {
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

/** Owns primary-attack activation, phase progression and melee hit resolution. */
export class PrimaryAttackSystem {
  private readonly meleeIdScratch: EntityId[] = [];
  private readonly coneIdScratch: EntityId[] = [];

  constructor(
    private readonly world: World,
    private readonly cooldowns: CooldownSystem,
    private readonly projectiles: ProjectileSystem,
    private readonly abilities: AbilitySystem,
    private readonly damage: DamageSystem,
    private readonly knockback: KnockbackSystem,
    private readonly activeCasts: Map<EntityId, ActiveCastState>,
    private readonly activeWeaponAttacks: Map<EntityId, ActiveWeaponAttackState>,
    private readonly context: PrimaryAttackSystemContext
  ) {}

  activate(command: ActivatePrimaryAttackCommand, events: SimulationEvent[]): void {
    if (this.activeCasts.has(command.entityId) || this.activeWeaponAttacks.has(command.entityId)) return;
    const fighter = getFighter(this.world.getFighterId(command.entityId));
    const attack = getPrimaryAttack(fighter.primaryAttackId);
    if (!this.cooldowns.isPrimaryReady(command.entityId, attack.id)) return;
    const target = command.targetId !== undefined && this.world.isAlive(command.targetId)
      ? command.targetId
      : null;
    const direction = this.abilities.resolveDirection(command.entityId, target, command.direction);
    if (!this.isValid(command.entityId, attack, target, direction)) return;
    this.cooldowns.startPrimary(command.entityId, attack);
    const position = {
      x: this.world.x[command.entityId] ?? 0,
      y: this.world.y[command.entityId] ?? 0
    };
    const windupTicks = Math.max(0, attack.windupTicks);
    const loadout = this.world.getLoadout(command.entityId);
    const activeTicks = this.activeTicks(attack, loadout);
    this.activeWeaponAttacks.set(command.entityId, {
      weaponId: attack.id,
      category: attack.behavior,
      style: attack.style,
      phase: windupTicks > 0 ? 'windup' : 'active',
      targetId: target,
      direction: { ...direction },
      remainingTicks: windupTicks > 0 ? windupTicks : activeTicks,
      totalTicks: windupTicks > 0 ? windupTicks : activeTicks,
      executed: false,
      shotsFired: 0,
      hitTargetIds: new Set()
    });
    events.push({
      type: 'weaponAttackStarted',
      tick: this.context.getTick(),
      entityId: command.entityId,
      weaponId: attack.id,
      category: attack.behavior,
      position,
      direction,
      windupTicks
    });
  }

  tick(events: SimulationEvent[]): void {
    for (const source of [...this.activeWeaponAttacks.keys()].sort((a, b) => a - b)) {
      const state = this.activeWeaponAttacks.get(source);
      if (!state) continue;
      if (!this.world.isAlive(source)) {
        this.activeWeaponAttacks.delete(source);
        continue;
      }
      const weapon = getPrimaryAttack(state.weaponId);
      if (state.phase === 'windup') {
        state.remainingTicks -= 1;
        if (state.remainingTicks > 0) continue;
        state.phase = 'active';
        state.remainingTicks = this.activeTicks(weapon, this.world.getLoadout(source));
        state.totalTicks = state.remainingTicks;
        continue;
      }
      if (state.phase === 'active') {
        const loadout = this.world.getLoadout(source);
        const coneChannel = loadout.primaryConeChannel;
        if (coneChannel) {
          this.refreshTrackedDirection(source, state);
          const elapsed = state.totalTicks - state.remainingTicks;
          if (elapsed % coneChannel.hitIntervalTicks === 0) {
            this.resolveConeChannel(
              source,
              weapon,
              state.direction,
              coneChannel,
              loadout,
              state.shotsFired % coneChannel.statusIntervalHits === 0,
              events
            );
            state.shotsFired += 1;
          }
          state.executed = true;
        } else if (weapon.behavior === 'ranged' || weapon.behavior === 'automatic' || weapon.behavior === 'beam') {
          const burstCount = Math.max(1, weapon.burstCount ?? 1);
          const interval = Math.max(1, weapon.burstIntervalTicks ?? 1);
          const elapsed = state.totalTicks - state.remainingTicks;
          if (state.shotsFired < burstCount && elapsed >= state.shotsFired * interval) {
            // A committed burst tracks its selected target between rounds. This
            // keeps the visible cadence coherent against moving targets without
            // changing projectile flight after launch.
            if (weapon.style === 'burst') this.refreshTrackedDirection(source, state);
            this.projectiles.spawn(
              source,
              weapon,
              state.direction,
              events,
              state.shotsFired,
              burstCount,
              state.targetId
            );
            state.shotsFired += 1;
          }
          state.executed = state.shotsFired >= burstCount;
        } else if (!state.executed || ['continuous', 'spin', 'orbit'].includes(weapon.behavior)) {
          if (weapon.behavior === 'throwable') {
            if (!state.executed) {
              this.projectiles.spawn(source, weapon, state.direction, events, 0, 1, state.targetId);
            }
          } else {
            const elapsed = state.totalTicks - state.remainingTicks;
            const repeatInterval = Math.max(1, weapon.repeatHitIntervalTicks ?? 12);
            if (weapon.behavior === 'continuous' && elapsed > 0 && elapsed % repeatInterval === 0) {
              state.hitTargetIds.clear();
            }
            this.resolveMelee(source, weapon, state.direction, state.hitTargetIds, events);
          }
          state.executed = true;
        }
        state.remainingTicks -= 1;
        if (state.remainingTicks > 0) continue;
        const recoveryTicks = Math.max(0, weapon.recoveryTicks);
        if (recoveryTicks === 0) {
          this.activeWeaponAttacks.delete(source);
        } else {
          state.phase = 'recovery';
          state.remainingTicks = recoveryTicks;
          state.totalTicks = recoveryTicks;
        }
        continue;
      }
      state.remainingTicks -= 1;
      if (state.remainingTicks <= 0) this.activeWeaponAttacks.delete(source);
    }
  }

  private isValid(
    self: EntityId,
    attack: PrimaryAttackDefinition,
    target: EntityId | null,
    direction: Vec2
  ): boolean {
    // Player-controlled fighters fire their Basic on demand: a ranged Basic
    // always launches toward the aim direction and a valid enemy target is never
    // rejected for range/angle/line-of-sight. Range gating stays AI-only, so
    // AI-vs-AI simulation/replay checksums are unchanged.
    const isPlayer = this.world.getController(self) === 'player';
    const areaBehavior = ['spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior);
    if (!areaBehavior && target === null) return isPlayer;
    if (target === null) return true;
    if (!this.world.isAlive(target) || this.world.getTeam(target) === this.world.getTeam(self)) return false;
    if (isPlayer) return true;
    const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
    const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
    const distance = Math.hypot(dx, dy);
    const effectiveMaximum = attack.behavior === 'melee'
      || attack.behavior === 'spin'
      || attack.behavior === 'continuous'
      || attack.behavior === 'orbit'
      || attack.behavior === 'slam'
      ? (this.world.radius[self] ?? 0) + attack.range + (this.world.radius[target] ?? 0)
      : attack.range;
    if (distance < attack.minRange || distance > effectiveMaximum) return false;
    if (
      ['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior)
      && !this.abilities.hasLineOfSight(self, target)
    ) {
      return false;
    }
    if (!areaBehavior && attack.attackAngleDegrees < 320) {
      const length = distance || 1;
      const dot = Math.max(
        -1,
        Math.min(1, direction.x * (dx / length) + direction.y * (dy / length))
      );
      const tolerance = Math.max(18, attack.attackAngleDegrees / 2 + 35) * Math.PI / 180;
      if (Math.acos(dot) > tolerance) return false;
    }
    return true;
  }

  private activeTicks(attack: PrimaryAttackDefinition, loadout: ResolvedFighterLoadout): number {
    if (loadout.primaryConeChannel) return loadout.primaryConeChannel.activeTicks;
    const burstTicks = attack.behavior === 'ranged'
      || attack.behavior === 'automatic'
      || attack.behavior === 'beam'
      ? Math.max(
          1,
          ((attack.burstCount ?? 1) - 1) * Math.max(1, attack.burstIntervalTicks ?? 1) + 1
        )
      : 1;
    return Math.max(1, attack.activeTicks, burstTicks);
  }

  private refreshTrackedDirection(source: EntityId, state: ActiveWeaponAttackState): void {
    if (state.targetId === null || !this.world.isAlive(state.targetId)) return;
    const dx = (this.world.x[state.targetId] ?? 0) - (this.world.x[source] ?? 0);
    const dy = (this.world.y[state.targetId] ?? 0) - (this.world.y[source] ?? 0);
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return;
    state.direction.x = dx / length;
    state.direction.y = dy / length;
  }

  private resolveConeChannel(
    source: EntityId,
    weapon: PrimaryAttackDefinition,
    direction: Vec2,
    channel: PrimaryConeChannelDefinition,
    loadout: ResolvedFighterLoadout,
    applyStatuses: boolean,
    events: SimulationEvent[]
  ): void {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const sourceTeam = this.world.getTeam(source);
    const directionLength = Math.hypot(direction.x, direction.y) || 1;
    const nx = direction.x / directionLength;
    const ny = direction.y / directionLength;
    const halfArc = channel.angleDegrees * Math.PI / 360;
    const maximumRange = weapon.range * channel.rangeMultiplier;
    const damage = weapon.damage * loadout.primaryDamageMultiplier * channel.damageMultiplier;
    const knockback = weapon.knockback * loadout.primaryKnockbackMultiplier * channel.knockbackMultiplier;
    const candidates = this.world.copyActiveIdsInto(this.coneIdScratch);

    for (const target of candidates) {
      if (target === source || !this.world.isAlive(target)) continue;
      if (!weapon.friendlyFire && this.world.getTeam(target) === sourceTeam) continue;
      const dx = (this.world.x[target] ?? 0) - sx;
      const dy = (this.world.y[target] ?? 0) - sy;
      const distance = Math.hypot(dx, dy);
      if (distance < weapon.minRange || distance > maximumRange + (this.world.radius[target] ?? 0)) continue;
      const dot = distance > 0 ? (dx / distance) * nx + (dy / distance) * ny : 1;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > halfArc || !this.abilities.hasLineOfSight(source, target)) continue;

      this.damage.dealDamage(source, target, damage, this.primaryElement(source), events);
      if (this.world.isAlive(target)) {
        if (knockback > 0) this.knockback.applyKnockback(source, target, knockback, events, 'weapon');
        if (applyStatuses) {
          for (const status of weapon.onHitStatuses ?? []) {
            this.context.applyStatus(
              source,
              target,
              status.statusId,
              status.durationTicks,
              events,
              status.stacks ?? 1
            );
          }
        }
      }
      events.push({
        type: 'weaponHit',
        tick: this.context.getTick(),
        sourceId: source,
        targetId: target,
        weaponId: weapon.id,
        position: {
          x: this.world.x[target] ?? 0,
          y: this.world.y[target] ?? 0
        },
        damage,
        knockback,
        presentation: 'continuous'
      });
      this.abilities.triggerPassives(
        source,
        'ON_PRIMARY_HIT',
        {
          self: source,
          target,
          impact: knockback,
          normal: direction,
          abilityId: weapon.id
        },
        events
      );
    }
  }

  private resolveMelee(
    source: EntityId,
    weapon: PrimaryAttackDefinition,
    direction: Vec2,
    alreadyHit: Set<EntityId>,
    events: SimulationEvent[]
  ): void {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const sourceTeam = this.world.getTeam(source);
    const dirLength = Math.hypot(direction.x, direction.y) || 1;
    const nx = direction.x / dirLength;
    const ny = direction.y / dirLength;
    const halfArc = weapon.attackAngleDegrees * Math.PI / 360;
    // activeIdList is maintained in ascending id order, so the prior explicit
    // sort was redundant. Reuse a stable buffer since damage can kill mid-loop.
    const candidates = this.world.copyActiveIdsInto(this.meleeIdScratch);
    for (const target of candidates) {
      if (target === source) continue;
      if (alreadyHit.has(target)) continue;
      if (!weapon.friendlyFire && this.world.getTeam(target) === sourceTeam) continue;
      const dx = (this.world.x[target] ?? 0) - sx;
      const dy = (this.world.y[target] ?? 0) - sy;
      const distance = Math.hypot(dx, dy);
      const effectiveReach = (this.world.radius[source] ?? 0)
        + weapon.range
        + (this.world.radius[target] ?? 0);
      if (distance < weapon.minRange || distance > effectiveReach) continue;
      const dot = distance > 0 ? (dx / distance) * nx + (dy / distance) * ny : 1;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > halfArc) continue;
      alreadyHit.add(target);
      const loadout = this.world.getLoadout(source);
      const damage = weapon.damage * loadout.primaryDamageMultiplier;
      const knockback = weapon.knockback * loadout.primaryKnockbackMultiplier;
      this.damage.dealDamage(source, target, damage, this.primaryElement(source), events);
      if (this.world.isAlive(target)) {
        this.knockback.applyKnockback(source, target, knockback, events, 'weapon');
        for (const status of weapon.onHitStatuses ?? []) {
          this.context.applyStatus(
            source,
            target,
            status.statusId,
            status.durationTicks,
            events,
            status.stacks ?? 1
          );
        }
      }
      events.push({
        type: 'weaponHit',
        tick: this.context.getTick(),
        sourceId: source,
        targetId: target,
        weaponId: weapon.id,
        position: {
          x: this.world.x[target] ?? 0,
          y: this.world.y[target] ?? 0
        },
        damage,
        knockback
      });
      this.abilities.triggerPassives(
        source,
        'ON_PRIMARY_HIT',
        {
          self: source,
          target,
          impact: knockback,
          normal: direction,
          abilityId: weapon.id
        },
        events
      );
      if (!['spin', 'continuous', 'orbit', 'slam'].includes(weapon.behavior)) break;
    }
  }

  private primaryElement(id: EntityId): Element {
    return getFighter(this.world.getFighterId(id)).classification.elements[0] ?? 'neutral';
  }
}
