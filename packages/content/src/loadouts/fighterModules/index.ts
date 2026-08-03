import type { FighterModuleDefinition } from '../../schemas';
import { GUNNER_MODULES } from './gunnerModules';
import { PYRO_MODULES } from './pyroModules';

export const FIGHTER_MODULES: readonly FighterModuleDefinition[] = [
  ...GUNNER_MODULES,
  ...PYRO_MODULES
];
