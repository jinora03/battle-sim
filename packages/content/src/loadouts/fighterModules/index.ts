import type { FighterModuleDefinition } from '../../schemas';
import { BALLAST_MODULES } from './ballastModules';
import { BOMBER_MODULES } from './bomberModules';
import { FROST_MODULES } from './frostModules';
import { GUNNER_MODULES } from './gunnerModules';
import { MECH_MODULES } from './mechModules';
import { PYRO_MODULES } from './pyroModules';
import { ROCKET_MODULES } from './rocketModules';
import { SOLAR_MODULES } from './solarModules';
import { THORN_MODULES } from './thornModules';
import { VOID_MODULES } from './voidModules';
import { VOLT_MODULES } from './voltModules';
import { WATER_MODULES } from './waterModules';

export const FIGHTER_MODULES: readonly FighterModuleDefinition[] = [
  // Preserve the historical catalog order for the three existing module rosters.
  ...GUNNER_MODULES,
  ...PYRO_MODULES,
  ...BALLAST_MODULES,
  // Stage 9B appends parity modules for the remaining built-in fighters.
  ...MECH_MODULES,
  ...WATER_MODULES,
  ...BOMBER_MODULES,
  ...FROST_MODULES,
  ...VOLT_MODULES,
  ...THORN_MODULES,
  ...VOID_MODULES,
  ...ROCKET_MODULES,
  ...SOLAR_MODULES
];
