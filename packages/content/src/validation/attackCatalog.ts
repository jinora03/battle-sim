import type { AttackForm, PrimaryAttackDefinition, SkillProjectileDefinition } from '../schemas';

export const ATTACK_FORM_BEHAVIORS: Readonly<Record<AttackForm, readonly PrimaryAttackDefinition['behavior'][]>> = {
  sword: ['melee', 'spin', 'throwable'],
  spear: ['melee', 'spin', 'throwable'],
  hammer: ['melee', 'spin', 'slam', 'throwable'],
  axe: ['melee', 'spin', 'throwable'],
  claws: ['melee', 'spin', 'continuous'],
  rifle: ['ranged', 'automatic', 'continuous', 'beam'],
  launcher: ['ranged', 'throwable'],
  shield: ['melee', 'spin', 'throwable', 'orbit', 'slam'],
  gauntlet: ['melee', 'spin', 'ranged', 'automatic', 'continuous', 'beam', 'slam'],
  fire: ['melee', 'spin', 'ranged', 'automatic', 'continuous', 'beam', 'slam'],
  water: ['melee', 'spin', 'ranged', 'continuous', 'beam', 'orbit'],
  ice: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'slam'],
  lightning: ['melee', 'ranged', 'automatic', 'continuous', 'beam', 'orbit'],
  nature: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'slam'],
  void: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'beam', 'orbit', 'slam']
};

export function isAttackCombinationAllowed(form: AttackForm, behavior: PrimaryAttackDefinition['behavior']): boolean {
  return ATTACK_FORM_BEHAVIORS[form].includes(behavior);
}

export function validateAttackCatalog(
  primaryAttacks: readonly PrimaryAttackDefinition[],
  skillProjectiles: readonly SkillProjectileDefinition[]
): void {
  const ids = new Set<string>();
  for (const attack of primaryAttacks) {
    if (ids.has(attack.id)) throw new Error(`Duplicate primary attack: ${attack.id}`);
    ids.add(attack.id);
    if (attack.category !== attack.behavior) throw new Error(`Primary attack ${attack.id} has mismatched category and behavior.`);
    if (!isAttackCombinationAllowed(attack.form, attack.behavior)) {
      throw new Error(`Primary attack ${attack.id} uses disallowed ${attack.form} + ${attack.behavior}.`);
    }
    const needsProjectile = ['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior);
    if (needsProjectile && !attack.projectile) throw new Error(`Primary attack ${attack.id} requires projectile data.`);
    if (attack.visualScale <= 0 || attack.range <= 0 || attack.cooldownTicks <= 0) {
      throw new Error(`Primary attack ${attack.id} has invalid range, scale, or cooldown.`);
    }
  }
  for (const projectile of skillProjectiles) {
    if (ids.has(projectile.id)) throw new Error(`Duplicate projectile source: ${projectile.id}`);
    ids.add(projectile.id);
    if (!['ranged', 'automatic', 'throwable'].includes(projectile.behavior)) {
      throw new Error(`Skill projectile ${projectile.id} has unsupported behavior ${projectile.behavior}.`);
    }
    if (projectile.projectile.speed <= 0 || projectile.projectile.radius <= 0 || projectile.projectile.lifetimeTicks <= 0) {
      throw new Error(`Skill projectile ${projectile.id} has invalid movement data.`);
    }
  }
}
