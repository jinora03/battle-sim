import type { ProjectileStatusInteraction } from '@kinetic/content';
import type { Vec2 } from '@kinetic/protocol';

export interface ResolvedProjectileStatusInteraction {
  stacks: number;
  bonusDamage: number;
  bonusKnockback: number;
  homingStrengthBonus: number;
  consumeStacks: number | 'all' | null;
  applyStatus: ProjectileStatusInteraction['applyStatusAtStacks'] | null;
}

export function resolveProjectileStatusInteraction(
  interaction: ProjectileStatusInteraction | undefined,
  stacks: number
): ResolvedProjectileStatusInteraction {
  if (!interaction || stacks <= 0) {
    return {
      stacks: 0,
      bonusDamage: 0,
      bonusKnockback: 0,
      homingStrengthBonus: 0,
      consumeStacks: null,
      applyStatus: null
    };
  }

  return {
    stacks,
    bonusDamage: (interaction.bonusDamagePerStack ?? 0) * stacks,
    bonusKnockback: (interaction.bonusKnockbackPerStack ?? 0) * stacks,
    homingStrengthBonus: (interaction.homingStrengthPerStack ?? 0) * stacks,
    consumeStacks: interaction.consumeStacks ?? null,
    applyStatus: interaction.applyStatusAtStacks && stacks >= interaction.applyStatusAtStacks.minimumStacks
      ? interaction.applyStatusAtStacks
      : null
  };
}

export function resolveImpulseDirection(direction: Vec2, mode: 'forward' | 'backward' | 'left' | 'right' = 'forward'): Vec2 {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const x = direction.x / length;
  const y = direction.y / length;
  switch (mode) {
    case 'backward': return { x: -x, y: -y };
    case 'left': return { x: y, y: -x };
    case 'right': return { x: -y, y: x };
    default: return { x, y };
  }
}
