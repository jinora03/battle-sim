import type { ModuleSlot } from '@kinetic/protocol';
import type { FighterDefinition, FighterModuleDefinition } from '../schemas';
import { FIGHTER_MODULES } from './fighterModules';
import { cloneModule } from './internal';
import { validateModuleCatalog } from './moduleValidation';
import { SHARED_MODULES } from './sharedModules';

const MODULES: readonly FighterModuleDefinition[] = [
  ...SHARED_MODULES,
  ...FIGHTER_MODULES
];

validateModuleCatalog(MODULES);

const MODULE_BY_ID = new Map(MODULES.map((module) => [module.id, module]));

export function listFighterModules(): FighterModuleDefinition[] {
  return MODULES.map(cloneModule);
}

export function getFighterModule(id: string): FighterModuleDefinition {
  const module = MODULE_BY_ID.get(id);
  if (!module) throw new Error(`Unknown fighter module: ${id}`);
  return module;
}

export function listCompatibleModules(fighter: FighterDefinition, slot?: ModuleSlot): FighterModuleDefinition[] {
  const compatibilityId = fighter.kitSourceFighterId ?? fighter.id;
  return MODULES
    .filter((module) => (!slot || module.slot === slot)
      && module.compatibleFighterIds.includes(compatibilityId)
      && (fighter.moduleSlots?.[module.slot] ?? []).includes(module.id))
    .map(cloneModule);
}
