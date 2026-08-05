import type { Element } from '@kinetic/protocol';
import { ARENA_RAW, ELEMENT_INTERACTION_RAW, GAME_MODE_RAW, STATUS_RAW } from '../catalogs/worldContent';
import {
  BUILTIN_ABILITY_RAW,
  BUILTIN_AI_PROFILE_RAW,
  BUILTIN_FIGHTER_RAW,
  BUILTIN_PRIMARY_ATTACKS,
  BUILTIN_SKILL_PROJECTILES
} from '../fighters';
import { getFighterModule } from '../loadouts';
import { getPassive } from '../passives';
import {
  abilitySchema,
  aiProfileSchema,
  arenaSchema,
  elementInteractionSchema,
  fighterSchema,
  gameModeSchema,
  statusSchema,
  type AbilityDefinition,
  type AiProfile,
  type ArenaDefinition,
  type ElementInteraction,
  type FighterDefinition,
  type GameModeDefinition,
  type PrimaryAttackDefinition,
  type ProjectileSourceDefinition,
  type SkillProjectileDefinition,
  type StatusDefinition
} from '../schemas';
import { validateAttackCatalog } from '../validation/attackCatalog';

const fighters: FighterDefinition[] = BUILTIN_FIGHTER_RAW.map((raw) => fighterSchema.parse(raw) as FighterDefinition);
const builtinFighterIds = new Set(fighters.map((fighter) => fighter.id));
const customFighterIds = new Set<string>();
const aiProfiles: AiProfile[] = BUILTIN_AI_PROFILE_RAW.map((raw) => aiProfileSchema.parse(raw) as AiProfile);
const abilities: AbilityDefinition[] = BUILTIN_ABILITY_RAW.map((raw) => abilitySchema.parse(raw) as AbilityDefinition);
const primaryAttacks: PrimaryAttackDefinition[] = [...BUILTIN_PRIMARY_ATTACKS];
const skillProjectiles: SkillProjectileDefinition[] = [...BUILTIN_SKILL_PROJECTILES];
const statuses: StatusDefinition[] = STATUS_RAW.map((raw) => statusSchema.parse(raw) as StatusDefinition);
const arenas: ArenaDefinition[] = ARENA_RAW.map((raw) => arenaSchema.parse(raw) as ArenaDefinition);
const gameModes: GameModeDefinition[] = GAME_MODE_RAW.map((raw) => gameModeSchema.parse(raw) as GameModeDefinition);
const interactions: ElementInteraction[] = ELEMENT_INTERACTION_RAW.map((raw) => elementInteractionSchema.parse(raw) as ElementInteraction);

function validateCombatResources(fighter: FighterDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const resource of fighter.combatResources ?? []) {
    if (ids.has(resource.id)) errors.push(`Duplicate combat resource id: ${resource.id}`);
    ids.add(resource.id);
    if (resource.initial > resource.maximum) {
      errors.push(`Combat resource ${resource.id} initial value exceeds maximum`);
    }
  }
  return errors;
}

for (const fighter of fighters) {
  const resourceErrors = validateCombatResources(fighter);
  if (resourceErrors.length > 0) throw new Error(resourceErrors.join('\n'));
}

const fighterMap = new Map<string, FighterDefinition>(fighters.map((item) => [item.id, item]));
const aiMap = new Map<string, AiProfile>(aiProfiles.map((item) => [item.id, item]));
const abilityMap = new Map<string, AbilityDefinition>(abilities.map((item) => [item.id, item]));
const primaryAttackMap = new Map<string, PrimaryAttackDefinition>(primaryAttacks.map((item) => [item.id, item]));
const skillProjectileMap = new Map<string, SkillProjectileDefinition>(skillProjectiles.map((item) => [item.id, item]));
const statusMap = new Map<string, StatusDefinition>(statuses.map((item) => [item.id, item]));
const arenaMap = new Map<string, ArenaDefinition>(arenas.map((item) => [item.id, item]));
const modeMap = new Map<string, GameModeDefinition>(gameModes.map((item) => [item.id, item]));
const interactionBySource = new Map<Element, Map<Element, number>>();

for (const item of interactions) {
  let inner = interactionBySource.get(item.source);
  if (!inner) {
    inner = new Map<Element, number>();
    interactionBySource.set(item.source, inner);
  }
  inner.set(item.target, item.multiplier);
}

validateAttackCatalog(primaryAttacks, skillProjectiles);

function requireFromMap<T>(map: Map<string, T>, id: string, kind: string): T {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${kind}: ${id}`);
  return value;
}

export const getFighter = (id: string) => requireFromMap(fighterMap, id, 'fighter');
export const getAiProfile = (id: string) => requireFromMap(aiMap, id, 'AI profile');
export const getAbility = (id: string) => requireFromMap(abilityMap, id, 'ability');
export const getStatus = (id: string) => requireFromMap(statusMap, id, 'status');
export const getPrimaryAttack = (id: string) => requireFromMap(primaryAttackMap, id, 'primary attack');
export const getSkillProjectile = (id: string) => requireFromMap(skillProjectileMap, id, 'skill projectile');
export const getArena = (id: string) => requireFromMap(arenaMap, id, 'arena');
export const getGameMode = (id: string) => requireFromMap(modeMap, id, 'game mode');

/** Resolves either a fighter primary attack or a skill-owned projectile. */
export function getAttackSource(id: string): PrimaryAttackDefinition | SkillProjectileDefinition {
  return primaryAttackMap.get(id) ?? getSkillProjectile(id);
}

export function getProjectileSource(id: string): ProjectileSourceDefinition {
  const primary = primaryAttackMap.get(id);
  if (primary?.projectile) return primary;
  return getSkillProjectile(id);
}

/** @deprecated Use getPrimaryAttack. */
export const getWeapon = getPrimaryAttack;

export function getElementMultiplier(source: Element, targetElements: Element[]): number {
  const inner = interactionBySource.get(source);
  if (!inner) return 1;
  let multiplier = 1;
  for (const target of targetElements) multiplier *= inner.get(target) ?? 1;
  return multiplier;
}

export interface RegisterFighterOptions {
  replace?: boolean;
}

export function validateFighterReferences(fighter: FighterDefinition): string[] {
  const errors: string[] = validateCombatResources(fighter);
  const compatibilityId = fighter.kitSourceFighterId ?? fighter.id;
  if (fighter.kitSourceFighterId && fighter.kitSourceFighterId === fighter.id) errors.push('kitSourceFighterId must reference a different fighter');
  if (fighter.kitSourceFighterId && !fighterMap.has(fighter.kitSourceFighterId)) errors.push(`Unknown kit source fighter: ${fighter.kitSourceFighterId}`);
  if (fighter.aiProfileId && !aiMap.has(fighter.aiProfileId)) errors.push(`Unknown AI profile: ${fighter.aiProfileId}`);
  for (const [slot, abilityId] of Object.entries(fighter.abilitySlots)) {
    if (abilityId && !abilityMap.has(abilityId)) errors.push(`Unknown ability in ${slot}: ${abilityId}`);
  }
  for (const passiveId of fighter.passiveIds ?? []) {
    try {
      getPassive(passiveId);
    } catch {
      errors.push(`Unknown passive: ${passiveId}`);
    }
  }
  for (const [slot, moduleIds] of Object.entries(fighter.moduleSlots ?? {})) {
    for (const moduleId of moduleIds ?? []) {
      try {
        const module = getFighterModule(moduleId);
        if (module.slot !== slot) errors.push(`Module ${moduleId} is not a ${slot} module`);
        if (!module.compatibleFighterIds.includes(compatibilityId)) errors.push(`Module ${moduleId} is incompatible with ${fighter.id}`);
      } catch {
        errors.push(`Unknown module: ${moduleId}`);
      }
    }
  }
  const defaultModuleSlots = new Set<string>();
  for (const moduleId of fighter.defaultModuleIds ?? []) {
    if (!Object.values(fighter.moduleSlots ?? {}).some((ids) => ids?.includes(moduleId))) errors.push(`Default module is not allowed: ${moduleId}`);
    try {
      const module = getFighterModule(moduleId);
      if (defaultModuleSlots.has(module.slot)) errors.push(`Default loadout has multiple ${module.slot} modules`);
      defaultModuleSlots.add(module.slot);
    } catch {
      // Unknown module is already reported by the approved module-slot loop.
    }
  }
  if (!primaryAttackMap.has(fighter.primaryAttackId)) errors.push(`Unknown primary attack: ${fighter.primaryAttackId}`);
  return errors;
}

export function registerFighter(raw: unknown, options: RegisterFighterOptions = {}): FighterDefinition {
  const fighter = fighterSchema.parse(raw) as FighterDefinition;
  const existing = fighterMap.get(fighter.id);
  if (existing && !options.replace) throw new Error(`Fighter already exists: ${fighter.id}`);
  if (existing && builtinFighterIds.has(fighter.id)) throw new Error(`Built-in fighter IDs cannot be replaced: ${fighter.id}`);
  const referenceErrors = validateFighterReferences(fighter);
  if (referenceErrors.length > 0) throw new Error(referenceErrors.join('\n'));
  const index = fighters.findIndex((item) => item.id === fighter.id);
  if (index >= 0) fighters[index] = fighter;
  else fighters.push(fighter);
  fighterMap.set(fighter.id, fighter);
  customFighterIds.add(fighter.id);
  return fighter;
}

export function removeCustomFighter(id: string): boolean {
  if (!customFighterIds.has(id)) return false;
  customFighterIds.delete(id);
  fighterMap.delete(id);
  const index = fighters.findIndex((fighter) => fighter.id === id);
  if (index >= 0) fighters.splice(index, 1);
  return true;
}

export const hasFighter = (id: string) => fighterMap.has(id);
export const isCustomFighter = (id: string) => customFighterIds.has(id);
export const listFighters = () => [...fighters];
export const listAiProfiles = () => [...aiProfiles];
export const listAbilities = () => [...abilities];
export const listPrimaryAttacks = () => [...primaryAttacks];
/** @deprecated Use listPrimaryAttacks. */
export const listWeapons = listPrimaryAttacks;
export const listArenas = () => [...arenas];
export const listGameModes = () => [...gameModes];
