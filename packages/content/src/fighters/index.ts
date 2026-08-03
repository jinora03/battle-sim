import { SHARED_PRIMARY_ATTACKS } from '../catalogs/sharedPrimaryAttacks';
import type { PrimaryAttackDefinition, SkillProjectileDefinition } from '../schemas';
import { ballastContent } from './ballast';
import { bomberContent } from './bomber';
import { frostContent } from './frost';
import { gunnerContent } from './gunner';
import { mechContent } from './mech';
import { pyroContent } from './pyro';
import { rocketContent } from './rocket';
import { solarSentinelContent } from './solar-sentinel';
import { thornContent } from './thorn';
import { voidContent } from './void';
import { voltContent } from './volt';
import { waterContent } from './water';
import type { FighterContentBundle } from './types';

/** Fighter order is public through listFighters and must remain stable. */
export const BUILTIN_FIGHTER_CONTENT: readonly FighterContentBundle[] = [
  pyroContent,
  mechContent,
  waterContent,
  bomberContent,
  frostContent,
  voltContent,
  thornContent,
  voidContent,
  gunnerContent,
  rocketContent,
  solarSentinelContent,
  ballastContent
];

export const BUILTIN_FIGHTER_RAW: readonly unknown[] = BUILTIN_FIGHTER_CONTENT.map((content) => content.fighter);
export const BUILTIN_AI_PROFILE_RAW: readonly unknown[] = BUILTIN_FIGHTER_CONTENT.flatMap((content) =>
  content.aiProfile === undefined ? [] : [content.aiProfile]
);
export const BUILTIN_ABILITY_RAW: readonly unknown[] = BUILTIN_FIGHTER_CONTENT.flatMap((content) => content.abilities);

/**
 * Preserve the historical listPrimaryAttacks order independently from fighter
 * presentation order. Some tooling exposes this array directly.
 */
export const BUILTIN_PRIMARY_ATTACKS: readonly PrimaryAttackDefinition[] = [
  pyroContent.primaryAttack,
  mechContent.primaryAttack,
  waterContent.primaryAttack,
  bomberContent.primaryAttack,
  frostContent.primaryAttack,
  voltContent.primaryAttack,
  solarSentinelContent.primaryAttack,
  gunnerContent.primaryAttack,
  rocketContent.primaryAttack,
  thornContent.primaryAttack,
  voidContent.primaryAttack,
  ballastContent.primaryAttack,
  ...SHARED_PRIMARY_ATTACKS
];

/** Skill projectile ordering is also kept byte-for-byte compatible. */
export const BUILTIN_SKILL_PROJECTILES: readonly SkillProjectileDefinition[] = [
  ...(rocketContent.skillProjectiles ?? []),
  ...(gunnerContent.skillProjectiles ?? [])
];
