import type { ModuleSlot } from '@kinetic/protocol';
import type { FighterDefinition } from '../schemas';
import { listCompatibleModules } from './moduleCatalog';

export const MODULE_PARITY_SLOTS: readonly ModuleSlot[] = ['offense', 'defense', 'mobility', 'utility'];

export interface FighterModuleParitySummary {
  fighterId: string;
  fighterName: string;
  slotCounts: Record<ModuleSlot, number>;
  totalModules: number;
  mountedModules: number;
  coveredSlots: number;
  hasFullSlotCoverage: boolean;
}

export interface RosterModuleParitySummary {
  fighters: FighterModuleParitySummary[];
  totalFighters: number;
  fullyCoveredFighters: number;
  coverageRate: number;
  totalModules: number;
  mountedModuleRate: number;
}

export function summarizeFighterModuleParity(fighter: FighterDefinition): FighterModuleParitySummary {
  const slotCounts = Object.fromEntries(
    MODULE_PARITY_SLOTS.map((slot) => [slot, listCompatibleModules(fighter, slot).length])
  ) as Record<ModuleSlot, number>;
  const modules = listCompatibleModules(fighter);
  const coveredSlots = MODULE_PARITY_SLOTS.filter((slot) => slotCounts[slot] > 0).length;
  return {
    fighterId: fighter.id,
    fighterName: fighter.name,
    slotCounts,
    totalModules: modules.length,
    mountedModules: modules.filter((module) => (module.attachments?.length ?? 0) > 0).length,
    coveredSlots,
    hasFullSlotCoverage: coveredSlots === MODULE_PARITY_SLOTS.length
  };
}

export function summarizeRosterModuleParity(fighters: readonly FighterDefinition[]): RosterModuleParitySummary {
  const summaries = fighters.map(summarizeFighterModuleParity);
  const totalModules = summaries.reduce((sum, fighter) => sum + fighter.totalModules, 0);
  const mountedModules = summaries.reduce((sum, fighter) => sum + fighter.mountedModules, 0);
  const fullyCoveredFighters = summaries.filter((fighter) => fighter.hasFullSlotCoverage).length;
  return {
    fighters: summaries,
    totalFighters: summaries.length,
    fullyCoveredFighters,
    coverageRate: summaries.length > 0 ? fullyCoveredFighters / summaries.length : 1,
    totalModules,
    mountedModuleRate: totalModules > 0 ? mountedModules / totalModules : 1
  };
}

export function listModuleParityIssues(fighters: readonly FighterDefinition[]): string[] {
  const issues: string[] = [];
  for (const fighter of fighters) {
    const summary = summarizeFighterModuleParity(fighter);
    for (const slot of MODULE_PARITY_SLOTS) {
      if (summary.slotCounts[slot] === 0) issues.push(`${fighter.name} has no ${slot} module`);
    }
  }
  return issues;
}
