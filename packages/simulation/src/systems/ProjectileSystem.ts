import {
  getPrimaryAttack,
  getProjectileSource,
  type PrimaryAttackDefinition,
  type ProjectileSourceDefinition
} from '@kinetic/content';
import type { EntityId, SimulationEvent, Vec2 } from '@kinetic/protocol';
import { resolveProjectileStatusInteraction } from '../combatModifiers';
import { SpatialHashGrid } from '../spatialHash';
import type { World } from '../world';
import type { ArenaCollisionSystem, RuntimeObstacle } from './ArenaCollisionSystem';
import {
  normalizeVector,
  segmentIntersectsBox,
  segmentIntersectsCircle,
  shortestAngleDelta
} from './ProjectileGeometry';
import type {
  PendingProjectileLaunch,
  ProjectileArenaBounds,
  ProjectileSystemContext,
  RuntimeProjectile
} from './ProjectileSystemTypes';

export type {
  ProjectileImpulseOptions,
  ProjectileSystemContext,
  RuntimeProjectile
} from './ProjectileSystemTypes';

/**
 * Owns projectile lifetime, movement, homing, collision queries, ricochet,
 * piercing and impact resolution. Damage, statuses, passives and knockback
 * remain authoritative runner operations exposed through narrow callbacks.
 */
export class ProjectileSystem {
  private readonly candidateIds: EntityId[] = [];
  private readonly projectiles: RuntimeProjectile[] = [];
  private readonly pendingLaunches: PendingProjectileLaunch[] = [];
  private nextProjectileId = 1;
  private nextPendingSequence = 1;

  constructor(
    private readonly world: World,
    private readonly arena: ProjectileArenaBounds,
    private readonly spatial: SpatialHashGrid,
    private readonly arenaCollisions: ArenaCollisionSystem,
    private readonly context: ProjectileSystemContext
  ) {}

  states(): readonly RuntimeProjectile[] {
    return this.projectiles;
  }

  schedule(
    sourceId: EntityId,
    projectileId: string,
    direction: Vec2,
    targetId: EntityId | null,
    launchTick: number,
    retargetOnLaunch = false
  ): void {
    this.pendingLaunches.push({
      launchTick,
      sequence: this.nextPendingSequence++,
      sourceId,
      projectileId,
      direction,
      targetId,
      retargetOnLaunch
    });
  }

  tickPendingLaunches(events: SimulationEvent[]): void {
    if (this.pendingLaunches.length === 0) return;
    this.pendingLaunches.sort(
      (a, b) => a.launchTick - b.launchTick || a.sequence - b.sequence
    );

    let consumed = 0;
    for (const launch of this.pendingLaunches) {
      if (launch.launchTick > this.context.getTick()) break;
      consumed += 1;
      if (!this.world.isAlive(launch.sourceId)) continue;
      const projectile = getProjectileSource(launch.projectileId);
      const targetId = launch.targetId !== null && this.world.isAlive(launch.targetId)
        ? launch.targetId
        : null;
      const direction = launch.retargetOnLaunch && targetId !== null
        ? normalizeVector({
            x: (this.world.x[targetId] ?? 0) - (this.world.x[launch.sourceId] ?? 0),
            y: (this.world.y[targetId] ?? 0) - (this.world.y[launch.sourceId] ?? 0)
          })
        : launch.direction;
      this.spawn(launch.sourceId, projectile, direction, events, 0, 1, targetId);
    }
    if (consumed > 0) this.pendingLaunches.splice(0, consumed);
  }

  spawn(
    sourceId: EntityId,
    weapon: ProjectileSourceDefinition,
    direction: Vec2,
    events: SimulationEvent[],
    shotIndex = 0,
    shotCount = 1,
    targetId: EntityId | null = null
  ): void {
    const definition = weapon.projectile;
    if (!definition) return;
    const normalized = normalizeVector(direction);
    const baseAngle = Math.atan2(normalized.y, normalized.x);
    const primary = tryGetPrimaryAttack(weapon.id);
    const isPrimaryAttack = primary !== null;
    const loadout = this.world.getLoadout(sourceId);
    const spreadRadians = (primary?.spreadDegrees ?? 0) * Math.PI / 180;
    const offset = shotCount <= 1
      ? 0
      : ((shotIndex / (shotCount - 1)) - 0.5) * spreadRadians;
    const angle = baseAngle + offset;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const spawnDistance = (this.world.radius[sourceId] ?? 20) + definition.radius + 5;
    const totalTicks = Math.max(1, definition.lifetimeTicks);
    const interactionStacks = weapon.statusInteraction && targetId !== null
      ? this.world.getStatusStacks(targetId, weapon.statusInteraction.statusId)
      : 0;
    const interaction = resolveProjectileStatusInteraction(
      weapon.statusInteraction,
      interactionStacks
    );
    const nativeBounce = definition.bounce > 0;
    const projectile: RuntimeProjectile = {
      id: this.nextProjectileId++,
      sourceId,
      team: this.world.getTeam(sourceId),
      weapon,
      targetId,
      isPrimaryAttack,
      x: (this.world.x[sourceId] ?? 0) + nx * spawnDistance,
      y: (this.world.y[sourceId] ?? 0) + ny * spawnDistance,
      prevX: (this.world.x[sourceId] ?? 0) + nx * spawnDistance,
      prevY: (this.world.y[sourceId] ?? 0) + ny * spawnDistance,
      vx: nx * definition.speed,
      vy: ny * definition.speed,
      radius: definition.radius,
      remainingTicks: totalTicks,
      totalTicks,
      ageTicks: 0,
      fuseRemainingTicks: definition.fuseTicks,
      damageMultiplier: isPrimaryAttack
        ? loadout.primaryDamageMultiplier
        : loadout.skillProjectileDamageMultiplier,
      knockbackMultiplier: isPrimaryAttack
        ? loadout.primaryKnockbackMultiplier
        : 1,
      bounceRetention: nativeBounce
        ? Math.max(definition.bounce, loadout.primaryProjectileBounce)
        : loadout.primaryProjectileBounce,
      maxWallBounces: nativeBounce
        ? (definition.maxWallBounces ?? Number.POSITIVE_INFINITY)
          + loadout.primaryProjectileMaxWallBounces
        : loadout.primaryProjectileMaxWallBounces,
      wallBounces: 0,
      penetrationRemaining: isPrimaryAttack
        ? loadout.primaryProjectilePenetration
        : 0,
      hitTargetIds: [],
      homingStrength: Math.max(
        0,
        Math.min(
          1,
          (definition.homingStrength ?? 0)
            * (isPrimaryAttack ? 1 : loadout.skillProjectileHomingMultiplier)
            + interaction.homingStrengthBonus
        )
      ),
      alive: true
    };
    this.projectiles.push(projectile);
    events.push({
      type: 'projectileSpawned',
      tick: this.context.getTick(),
      projectileId: projectile.id,
      sourceId,
      weaponId: weapon.id,
      position: { x: projectile.x, y: projectile.y },
      velocity: { x: projectile.vx, y: projectile.vy },
      ...(targetId !== null ? { targetId } : {})
    });
  }

  update(events: SimulationEvent[]): void {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      const definition = projectile.weapon.projectile;
      if (!definition) {
        projectile.alive = false;
        continue;
      }

      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
      this.steerHomingProjectile(projectile);
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.ageTicks += 1;
      projectile.remainingTicks -= 1;
      if (projectile.fuseRemainingTicks > 0) projectile.fuseRemainingTicks -= 1;

      let impactTarget: EntityId | null = null;
      const queryPadding = projectile.radius + this.context.getMaxEntityRadius();
      this.candidateIds.splice(0);
      this.spatial.forEachInAabb(
        Math.min(projectile.prevX, projectile.x) - queryPadding,
        Math.min(projectile.prevY, projectile.y) - queryPadding,
        Math.max(projectile.prevX, projectile.x) + queryPadding,
        Math.max(projectile.prevY, projectile.y) + queryPadding,
        (id) => this.candidateIds.push(id)
      );
      this.candidateIds.sort((a, b) => a - b);
      for (const target of this.candidateIds) {
        this.context.getMetrics().projectileEntityChecks += 1;
        if (
          !this.world.isAlive(target)
          || target === projectile.sourceId
          || projectile.hitTargetIds.includes(target)
        ) continue;
        if (
          !projectile.weapon.friendlyFire
          && this.world.getTeam(target) === projectile.team
        ) continue;
        const combined = projectile.radius + (this.world.radius[target] ?? 0);
        if (
          segmentIntersectsCircle(
            projectile.prevX,
            projectile.prevY,
            projectile.x,
            projectile.y,
            this.world.x[target] ?? 0,
            this.world.y[target] ?? 0,
            combined
          )
        ) {
          impactTarget = target;
          break;
        }
      }

      let obstacleHit: RuntimeObstacle | null = null;
      for (const obstacle of this.arenaCollisions.activeObstacles()) {
        if (!obstacle.alive) continue;
        this.context.getMetrics().projectileObstacleChecks += 1;
        const item = obstacle.definition;
        const hit = item.shape === 'circle'
          ? segmentIntersectsCircle(
              projectile.prevX,
              projectile.prevY,
              projectile.x,
              projectile.y,
              item.x,
              item.y,
              item.radius + projectile.radius
            )
          : segmentIntersectsBox(
              projectile.prevX,
              projectile.prevY,
              projectile.x,
              projectile.y,
              item.x - item.width / 2 - projectile.radius,
              item.y - item.height / 2 - projectile.radius,
              item.width + projectile.radius * 2,
              item.height + projectile.radius * 2
            );
        if (hit) {
          obstacleHit = obstacle;
          break;
        }
      }

      const hitLeft = projectile.x < projectile.radius;
      const hitRight = projectile.x > this.arena.width - projectile.radius;
      const hitTop = projectile.y < projectile.radius;
      const hitBottom = projectile.y > this.arena.height - projectile.radius;
      const wallHit = hitLeft || hitRight || hitTop || hitBottom;
      const fuseExpired = definition.fuseTicks > 0
        && projectile.fuseRemainingTicks <= 0;
      let penetratedTarget = false;
      if (impactTarget !== null && definition.explosionRadius <= 0) {
        this.resolveDirectHit(projectile, impactTarget, events);
        projectile.hitTargetIds.push(impactTarget);
        if (projectile.penetrationRemaining > 0) {
          projectile.penetrationRemaining -= 1;
          penetratedTarget = true;
          impactTarget = null;
        }
      }

      const canBounce = projectile.bounceRetention > 0
        && projectile.wallBounces < projectile.maxWallBounces
        && !fuseExpired
        && impactTarget === null;
      if ((wallHit || obstacleHit) && canBounce) {
        projectile.wallBounces += 1;
        if (obstacleHit) {
          const item = obstacleHit.definition;
          if (item.shape === 'circle') {
            const nx = projectile.prevX - item.x;
            const ny = projectile.prevY - item.y;
            const length = Math.hypot(nx, ny) || 1;
            const ux = nx / length;
            const uy = ny / length;
            const dot = projectile.vx * ux + projectile.vy * uy;
            projectile.vx = (projectile.vx - 2 * dot * ux)
              * projectile.bounceRetention;
            projectile.vy = (projectile.vy - 2 * dot * uy)
              * projectile.bounceRetention;
          } else {
            const dx = projectile.prevX - item.x;
            const dy = projectile.prevY - item.y;
            if (
              Math.abs(dx) / Math.max(1, item.width)
              > Math.abs(dy) / Math.max(1, item.height)
            ) projectile.vx *= -projectile.bounceRetention;
            else projectile.vy *= -projectile.bounceRetention;
          }
          projectile.x = projectile.prevX;
          projectile.y = projectile.prevY;
        } else {
          if (hitLeft || hitRight) projectile.vx *= -projectile.bounceRetention;
          if (hitTop || hitBottom) projectile.vy *= -projectile.bounceRetention;
          projectile.x = Math.max(
            projectile.radius,
            Math.min(this.arena.width - projectile.radius, projectile.x)
          );
          projectile.y = Math.max(
            projectile.radius,
            Math.min(this.arena.height - projectile.radius, projectile.y)
          );
        }
      } else if (
        (
          impactTarget !== null
          || wallHit
          || obstacleHit !== null
          || fuseExpired
          || projectile.remainingTicks <= 0
        )
        && (
          !penetratedTarget
          || wallHit
          || obstacleHit !== null
          || fuseExpired
          || projectile.remainingTicks <= 0
        )
      ) {
        this.resolveImpact(projectile, impactTarget, events);
      }
    }

    if (this.projectiles.length > 256) {
      for (
        let index = this.projectiles.length - 1;
        index >= 0 && this.projectiles.length > 192;
        index -= 1
      ) {
        if (!this.projectiles[index]?.alive) this.projectiles.splice(index, 1);
      }
    }
  }

  recoverInvalidNumericState(): void {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      if (
        [
          projectile.x,
          projectile.y,
          projectile.prevX,
          projectile.prevY,
          projectile.vx,
          projectile.vy
        ].every(Number.isFinite)
      ) continue;
      projectile.alive = false;
      this.context.getMetrics().invalidNumericStates += 1;
    }
  }

  private resolveDirectHit(
    projectile: RuntimeProjectile,
    targetId: EntityId,
    events: SimulationEvent[]
  ): { damage: number; knockback: number } {
    const interactionStacks = projectile.weapon.statusInteraction
      ? this.world.getStatusStacks(
          targetId,
          projectile.weapon.statusInteraction.statusId
        )
      : 0;
    const interaction = resolveProjectileStatusInteraction(
      projectile.weapon.statusInteraction,
      interactionStacks
    );
    const damage = (projectile.weapon.damage + interaction.bonusDamage)
      * projectile.damageMultiplier;
    const knockback = (projectile.weapon.knockback + interaction.bonusKnockback)
      * projectile.knockbackMultiplier;

    this.context.dealDamage(
      projectile.sourceId,
      targetId,
      damage,
      this.context.primaryElement(projectile.sourceId),
      events
    );
    if (this.world.isAlive(targetId)) {
      this.context.applyKnockback(
        projectile.sourceId,
        targetId,
        knockback,
        events,
        'weapon'
      );
      for (const status of projectile.weapon.onHitStatuses ?? []) {
        this.context.applyStatus(
          projectile.sourceId,
          targetId,
          status.statusId,
          status.durationTicks,
          events,
          status.stacks ?? 1
        );
      }
      if (interaction.applyStatus) {
        this.context.applyStatus(
          projectile.sourceId,
          targetId,
          interaction.applyStatus.statusId,
          interaction.applyStatus.durationTicks,
          events,
          interaction.applyStatus.stacks ?? 1
        );
      }
      if (
        interaction.consumeStacks !== null
        && projectile.weapon.statusInteraction
      ) {
        this.world.removeStatusStacks(
          targetId,
          projectile.weapon.statusInteraction.statusId,
          interaction.consumeStacks
        );
      }
    }

    events.push({
      type: 'weaponHit',
      tick: this.context.getTick(),
      sourceId: projectile.sourceId,
      targetId,
      weaponId: projectile.weapon.id,
      position: { x: projectile.x, y: projectile.y },
      damage,
      knockback
    });
    if (projectile.isPrimaryAttack) {
      this.context.triggerPrimaryHitPassive(
        projectile.sourceId,
        targetId,
        knockback,
        normalizeVector({ x: projectile.vx, y: projectile.vy }),
        projectile.weapon.id,
        events
      );
    }
    return { damage, knockback };
  }

  private resolveImpact(
    projectile: RuntimeProjectile,
    targetId: EntityId | null,
    events: SimulationEvent[]
  ): void {
    if (!projectile.alive) return;
    projectile.alive = false;
    const definition = projectile.weapon.projectile!;
    events.push({
      type: 'projectileImpact',
      tick: this.context.getTick(),
      projectileId: projectile.id,
      sourceId: projectile.sourceId,
      weaponId: projectile.weapon.id,
      position: { x: projectile.x, y: projectile.y },
      ...(targetId !== null ? { targetId } : {})
    });
    if (definition.explosionRadius <= 0) return;

    this.candidateIds.splice(0);
    this.spatial.forEachInAabb(
      projectile.x - definition.explosionRadius,
      projectile.y - definition.explosionRadius,
      projectile.x + definition.explosionRadius,
      projectile.y + definition.explosionRadius,
      (id) => this.candidateIds.push(id)
    );
    this.candidateIds.sort((a, b) => a - b);
    for (const id of this.candidateIds) {
      this.context.getMetrics().projectileEntityChecks += 1;
      if (!this.world.isAlive(id)) continue;
      if (
        !projectile.weapon.friendlyFire
        && this.world.getTeam(id) === projectile.team
      ) continue;
      const dx = (this.world.x[id] ?? 0) - projectile.x;
      const dy = (this.world.y[id] ?? 0) - projectile.y;
      if (
        dx * dx + dy * dy
        > definition.explosionRadius * definition.explosionRadius
      ) continue;
      const directHit = targetId !== null && id === targetId;
      const interactionStacks = directHit && projectile.weapon.statusInteraction
        ? this.world.getStatusStacks(
            id,
            projectile.weapon.statusInteraction.statusId
          )
        : 0;
      const interaction = resolveProjectileStatusInteraction(
        projectile.weapon.statusInteraction,
        interactionStacks
      );
      const explosionDamage = definition.explosionDamage
        * projectile.damageMultiplier;
      const directDamage = directHit
        ? (projectile.weapon.damage + interaction.bonusDamage)
          * projectile.damageMultiplier
        : 0;
      const combinedDamage = explosionDamage + directDamage;
      this.context.dealDamage(
        projectile.sourceId,
        id,
        combinedDamage,
        this.context.primaryElement(projectile.sourceId),
        events
      );
      if (this.world.isAlive(id)) {
        const distance = Math.hypot(dx, dy);
        const distanceRatio = Math.min(
          1,
          distance / Math.max(1, definition.explosionRadius)
        );
        const falloff = 0.58 + (1 - distanceRatio) * 0.42;
        const directKnockback = directHit
          ? projectile.weapon.knockback + interaction.bonusKnockback
          : 0;
        const combinedBaseImpulse = (
          definition.explosionImpulse + directKnockback
        ) * projectile.knockbackMultiplier;
        const impulse = this.context.damageScaledImpulse(
          combinedBaseImpulse,
          combinedDamage
        ) * falloff;
        this.context.applyKnockbackFromPoint(
          projectile.sourceId,
          { x: projectile.x, y: projectile.y },
          id,
          impulse,
          events,
          'explosion',
          { x: projectile.vx, y: projectile.vy },
          this.context.explosionImpulseOptions(
            combinedDamage,
            projectile.weapon.id
          )
        );
        if (directHit) {
          for (const status of projectile.weapon.onHitStatuses ?? []) {
            this.context.applyStatus(
              projectile.sourceId,
              id,
              status.statusId,
              status.durationTicks,
              events,
              status.stacks ?? 1
            );
          }
          if (interaction.applyStatus) {
            this.context.applyStatus(
              projectile.sourceId,
              id,
              interaction.applyStatus.statusId,
              interaction.applyStatus.durationTicks,
              events,
              interaction.applyStatus.stacks ?? 1
            );
          }
          if (
            interaction.consumeStacks !== null
            && projectile.weapon.statusInteraction
          ) {
            this.world.removeStatusStacks(
              id,
              projectile.weapon.statusInteraction.statusId,
              interaction.consumeStacks
            );
          }
        }
      }
    }

    if (targetId !== null) {
      events.push({
        type: 'weaponHit',
        tick: this.context.getTick(),
        sourceId: projectile.sourceId,
        targetId,
        weaponId: projectile.weapon.id,
        position: { x: projectile.x, y: projectile.y },
        damage: (definition.explosionDamage + projectile.weapon.damage)
          * projectile.damageMultiplier,
        knockback: (definition.explosionImpulse + projectile.weapon.knockback)
          * projectile.knockbackMultiplier
      });
      if (projectile.isPrimaryAttack) {
        this.context.triggerPrimaryHitPassive(
          projectile.sourceId,
          targetId,
          (definition.explosionImpulse + projectile.weapon.knockback)
            * projectile.knockbackMultiplier,
          normalizeVector({ x: projectile.vx, y: projectile.vy }),
          projectile.weapon.id,
          events
        );
      }
    }

    const blastDamage = definition.explosionDamage * projectile.damageMultiplier;
    const blastForce = this.context.damageScaledImpulse(
      definition.explosionImpulse * projectile.knockbackMultiplier,
      blastDamage
    );
    events.push({
      type: 'blast',
      tick: this.context.getTick(),
      sourceId: projectile.sourceId,
      abilityId: projectile.weapon.id,
      kind: 'explosion',
      position: { x: projectile.x, y: projectile.y },
      radius: definition.explosionRadius,
      force: blastForce,
      damage: blastDamage,
      element: this.context.primaryElement(projectile.sourceId)
    });
  }

  private steerHomingProjectile(projectile: RuntimeProjectile): void {
    const definition = projectile.weapon.projectile;
    if (
      !definition
      || projectile.homingStrength <= 0
      || projectile.ageTicks < (definition.homingDelayTicks ?? 0)
    ) return;
    const range = definition.homingRange ?? Number.POSITIVE_INFINITY;
    let targetId = projectile.targetId;
    if (
      targetId === null
      || !this.world.isAlive(targetId)
      || this.world.getTeam(targetId) === projectile.team
    ) {
      targetId = this.nearestHostileToPoint(
        projectile.sourceId,
        projectile.x,
        projectile.y,
        range
      );
      projectile.targetId = targetId;
    }
    if (targetId === null) return;
    const dx = (this.world.x[targetId] ?? 0) - projectile.x;
    const dy = (this.world.y[targetId] ?? 0) - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > range) return;
    const speed = Math.hypot(projectile.vx, projectile.vy) || definition.speed;
    const currentAngle = Math.atan2(projectile.vy, projectile.vx);
    const desiredAngle = Math.atan2(dy, dx);
    const delta = shortestAngleDelta(currentAngle, desiredAngle);
    const responsiveness = projectile.homingStrength;
    const maxTurn = definition.homingTurnRadians ?? 0.055;
    const turn = Math.sign(delta)
      * Math.min(Math.abs(delta) * responsiveness, maxTurn);
    const nextAngle = currentAngle + turn;
    projectile.vx = Math.cos(nextAngle) * speed;
    projectile.vy = Math.sin(nextAngle) * speed;
  }

  private nearestHostileToPoint(
    sourceId: EntityId,
    x: number,
    y: number,
    maximumRange: number
  ): EntityId | null {
    const team = this.world.getTeam(sourceId);
    const maximumSquared = maximumRange * maximumRange;
    let best: EntityId | null = null;
    let bestDistance = maximumSquared;
    for (const id of this.world.activeIdsView()) {
      if (id === sourceId || this.world.getTeam(id) === team) continue;
      const dx = (this.world.x[id] ?? 0) - x;
      const dy = (this.world.y[id] ?? 0) - y;
      const distance = dx * dx + dy * dy;
      if (
        distance < bestDistance
        || (distance === bestDistance && (best === null || id < best))
      ) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }
}

function tryGetPrimaryAttack(id: string): PrimaryAttackDefinition | null {
  try {
    return getPrimaryAttack(id);
  } catch {
    return null;
  }
}
