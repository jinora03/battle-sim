import type { MatchupMatrixResult } from './matchupMatrix';

export const BATTLE_INTEL_EXPORT_SCHEMA = 'kinetic-battle-intel' as const;
export const BATTLE_INTEL_EXPORT_SCHEMA_VERSION = 1 as const;

export interface BattleIntelExportContext {
  arenaId: string;
  arenaName: string;
  baseSeed: number;
  selectedFighterId?: string | null;
  selectedMatchup?: {
    fighterAId: string;
    fighterBId: string;
  } | null;
}

export interface BattleIntelExportDocument {
  schema: typeof BATTLE_INTEL_EXPORT_SCHEMA;
  schemaVersion: typeof BATTLE_INTEL_EXPORT_SCHEMA_VERSION;
  generatedAt: string;
  context: BattleIntelExportContext;
  result: MatchupMatrixResult;
}

export function createBattleIntelExport(
  result: MatchupMatrixResult,
  context: BattleIntelExportContext,
  generatedAt = new Date().toISOString()
): BattleIntelExportDocument {
  return {
    schema: BATTLE_INTEL_EXPORT_SCHEMA,
    schemaVersion: BATTLE_INTEL_EXPORT_SCHEMA_VERSION,
    generatedAt,
    context: {
      ...context,
      baseSeed: normalizeSeed(context.baseSeed),
      selectedFighterId: context.selectedFighterId ?? null,
      selectedMatchup: context.selectedMatchup ?? null
    },
    result
  };
}

export function serializeBattleIntelExport(document: BattleIntelExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function createBattleIntelExportFilename(document: BattleIntelExportDocument): string {
  const arena = slugify(document.context.arenaName || document.context.arenaId || 'arena');
  const samples = Math.max(0, Math.trunc(document.result.sampleSizePerMatchup));
  return `kbe-intel-${arena}-seed-${document.context.baseSeed}-${samples}x.json`;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  return Math.trunc(seed) >>> 0 || 1;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'arena';
}
