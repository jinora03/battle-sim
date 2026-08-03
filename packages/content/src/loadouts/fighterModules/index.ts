import type { FighterModuleDefinition } from '../../schemas';
import { BALLAST_MODULES } from './ballastModules';
import { GUNNER_MODULES } from './gunnerModules';
import { PYRO_MODULES } from './pyroModules';

export const FIGHTER_MODULES: readonly FighterModuleDefinition[] = [
  ...GUNNER_MODULES,
  ...PYRO_MODULES,
  ...BALLAST_MODULES
];
