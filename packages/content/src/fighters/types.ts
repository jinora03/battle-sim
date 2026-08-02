import type { PrimaryAttackDefinition, SkillProjectileDefinition } from '../schemas';

/**
 * Groups all built-in content owned by one fighter without changing the
 * public registry shape. Raw JSON remains schema-validated by the registry.
 */
export interface FighterContentBundle {
  fighter: unknown;
  aiProfile?: unknown;
  abilities: readonly unknown[];
  primaryAttack: PrimaryAttackDefinition;
  skillProjectiles?: readonly SkillProjectileDefinition[];
}
