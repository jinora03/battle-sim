import { getAbility, getPrimaryAttack } from '@kinetic/content';
import type { EntityId, Vec2 } from '@kinetic/protocol';
import type { World, ActiveCastState, ActiveWeaponAttackState } from '../world';
import type { ArenaZoneSystem } from './ArenaZoneSystem';
import type { ExternalImpulseState } from './SimulationSystemTypes';

/**
 * Owns controller acceleration and deterministic motion integration.
 *
 * External impact velocity remains separate from locomotion so stop commands,
 * fighter speed caps, and environmental damping cannot erase authored
 * knockback trajectories.
 */
export class MovementSystem {
  constructor(
    private readonly world: World,
    private readonly arenaZones: ArenaZoneSystem,
    private readonly activeCasts: ReadonlyMap<EntityId, ActiveCastState>,
    private readonly activeWeaponAttacks: ReadonlyMap<EntityId, ActiveWeaponAttackState>,
    private readonly externalImpulse: Map<EntityId, ExternalImpulseState>,
    private readonly explicitFacingThisTick: Set<EntityId>
  ) {}

  applyMove(id: EntityId, direction: Vec2, facing?: Vec2): void {
    if (facing) {
      const facingLength = Math.hypot(facing.x, facing.y);
      if (facingLength > 0.0001) {
        this.world.rotation[id] = Math.atan2(facing.y, facing.x);
        this.explicitFacingThisTick.add(id);
      }
    }

    const length = Math.hypot(direction.x, direction.y);
    if (length < 0.0001) return;

    const speedMultiplier = this.world.getSpeedMultiplier(id);
    const activeCast = this.activeCasts.get(id);
    const castAbility = activeCast ? getAbility(activeCast.abilityId) : null;
    const activePrimaryAttack = this.activeWeaponAttacks.get(id);
    const activePrimaryDefinition = activePrimaryAttack
      ? getPrimaryAttack(activePrimaryAttack.weaponId)
      : null;
    const channelMovementMultiplier = activePrimaryAttack?.phase === 'active'
      ? this.world.getLoadout(id).primaryConeChannel?.movementMultiplier ?? 1
      : 1;
    const primaryMovementMultiplier = activePrimaryDefinition
      ? activePrimaryDefinition.movementAllowed
        ? channelMovementMultiplier
        : 0
      : 1;
    const castMovementMultiplier = castAbility ? castAbility.castMovementMultiplier : 1;
    const environment = this.arenaZones.modifiersFor(id);
    const acceleration = (this.world.moveAcceleration[id] ?? 0)
      * speedMultiplier
      * castMovementMultiplier
      * primaryMovementMultiplier
      * environment.steering;

    this.world.vx[id] = (this.world.vx[id] ?? 0) + (direction.x / length) * acceleration;
    this.world.vy[id] = (this.world.vy[id] ?? 0) + (direction.y / length) * acceleration;
  }

  integrate(): void {
    // Read-only over the active set (moves entities, never adds/removes them).
    for (const id of this.world.activeIdsView()) {
      const environment = this.arenaZones.modifiersFor(id);
      const damping = environment.damping ?? (this.world.damping[id] ?? 1);
      const impulse = this.externalImpulse.get(id) ?? {
        x: 0,
        y: 0,
        retention: 0.92,
        maxSpeed: 48,
        minWallBounces: 0,
        wallBounces: 0,
        trailStrength: 0
      };
      let locomotionX = ((this.world.vx[id] ?? 0) - impulse.x) * damping;
      let locomotionY = ((this.world.vy[id] ?? 0) - impulse.y) * damping;
      const locomotionSpeed = Math.hypot(locomotionX, locomotionY);
      const maxSpeed = (this.world.maxSpeed[id] ?? 1)
        * this.world.getSpeedMultiplier(id)
        * environment.maxSpeed;

      if (locomotionSpeed > maxSpeed) {
        const scale = maxSpeed / locomotionSpeed;
        locomotionX *= scale;
        locomotionY *= scale;
      }

      // External impacts decay independently and are intentionally not clamped
      // to walking speed. Ice preserves slides; water damps displacement faster.
      const environmentalRetention = environment.damping !== null
        ? environment.damping >= 0.999
          ? 0.965
          : 0.875
        : 0.92;
      const impulseRetention = Math.max(
        environmentalRetention,
        impulse.retention ?? 0.92
      );
      const impulseX = impulse.x * impulseRetention;
      const impulseY = impulse.y * impulseRetention;

      if (Math.hypot(impulseX, impulseY) > 0.035) {
        this.externalImpulse.set(id, {
          ...impulse,
          x: impulseX,
          y: impulseY
        });
      } else {
        this.externalImpulse.delete(id);
      }

      const vx = locomotionX + impulseX;
      const vy = locomotionY + impulseY;
      const speed = Math.hypot(vx, vy);
      this.world.vx[id] = vx;
      this.world.vy[id] = vy;
      this.world.x[id] = (this.world.x[id] ?? 0) + vx;
      this.world.y[id] = (this.world.y[id] ?? 0) + vy;

      // Movement no longer overrides explicit look direction every tick.
      if (speed > 0.05 && !this.explicitFacingThisTick.has(id)) {
        this.world.rotation[id] = Math.atan2(vy, vx);
      }
    }
  }
}
