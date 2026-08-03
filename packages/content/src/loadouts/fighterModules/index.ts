import type { FighterModuleDefinition } from '../../schemas';
import { GUNNER_MODULES } from './gunnerModules';

export const FIGHTER_MODULES: readonly FighterModuleDefinition[] = [
  ...GUNNER_MODULES
];
