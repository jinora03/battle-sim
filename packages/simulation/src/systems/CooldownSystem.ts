import type {
  AbilityDefinition,
  PrimaryAttackDefinition
} from '@kinetic/content';
import type { EntityId } from '@kinetic/protocol';
import type { World } from '../world';

/** Centralizes tick-based cooldown policy without introducing per-tick work. */
export class CooldownSystem {
  constructor(
    private readonly world: World,
    private readonly getTick: () => number,
    private readonly isEnabled: () => boolean
  ) {}

  clearAll(): void {
    this.world.clearAbilityCooldowns();
  }

  isPrimaryReady(entityId: EntityId, attackId: string): boolean {
    return !this.isEnabled()
      || this.world.isPrimaryAttackReady(entityId, attackId, this.getTick());
  }

  startPrimary(entityId: EntityId, attack: PrimaryAttackDefinition): void {
    if (!this.isEnabled()) return;
    const multiplier = this.world.getLoadout(entityId).primaryCooldownMultiplier;
    const cooldownTicks = Math.max(
      1,
      Math.round(attack.cooldownTicks * multiplier)
    );
    this.world.setPrimaryAttackCooldown(
      entityId,
      attack.id,
      this.getTick() + cooldownTicks
    );
  }

  isAbilityReady(entityId: EntityId, abilityId: string): boolean {
    return !this.isEnabled()
      || this.world.isAbilityReady(entityId, abilityId, this.getTick());
  }

  startAbility(entityId: EntityId, ability: AbilityDefinition): void {
    if (!this.isEnabled()) return;
    this.world.setAbilityCooldown(
      entityId,
      ability.id,
      this.getTick() + ability.cooldownTicks
    );
  }
}
