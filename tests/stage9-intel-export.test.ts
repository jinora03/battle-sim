import { describe, expect, it } from 'vitest';
import {
  BATTLE_INTEL_EXPORT_SCHEMA,
  BATTLE_INTEL_EXPORT_SCHEMA_VERSION,
  createBattleIntelExport,
  createBattleIntelExportFilename,
  serializeBattleIntelExport,
  type MatchupMatrixResult
} from '@kinetic/video-export';

function matrixResult(): MatchupMatrixResult {
  return {
    fighters: [
      { id: 'pyro-brawler', name: 'Pyro' },
      { id: 'bomber', name: 'Bomber' }
    ],
    sampleSizePerMatchup: 50,
    totalPairings: 1,
    totalBattles: 50,
    cells: [],
    fighterSummaries: [],
    abilityAnalytics: { fighters: [] },
    aiDecisionAnalytics: { fighters: [] },
    pacingAnalytics: { overall: {}, fighters: [] },
    findings: []
  } as unknown as MatchupMatrixResult;
}

describe('Battle Intel export tools', () => {
  it('packages the complete matrix result with reproducible run context', () => {
    const result = matrixResult();
    const document = createBattleIntelExport(result, {
      arenaId: 'iron-pit',
      arenaName: 'Iron Pit',
      baseSeed: 9001,
      selectedFighterId: 'pyro-brawler',
      selectedMatchup: { fighterAId: 'pyro-brawler', fighterBId: 'bomber' }
    }, '2026-08-12T07:00:00.000Z');

    expect(document.schema).toBe(BATTLE_INTEL_EXPORT_SCHEMA);
    expect(document.schemaVersion).toBe(BATTLE_INTEL_EXPORT_SCHEMA_VERSION);
    expect(document.generatedAt).toBe('2026-08-12T07:00:00.000Z');
    expect(document.context.baseSeed).toBe(9001);
    expect(document.result).toBe(result);
    expect(createBattleIntelExportFilename(document)).toBe('kbe-intel-iron-pit-seed-9001-50x.json');

    const parsed = JSON.parse(serializeBattleIntelExport(document));
    expect(parsed.result.totalBattles).toBe(50);
    expect(parsed.context.selectedMatchup.fighterBId).toBe('bomber');
  });

  it('normalizes invalid or zero export seeds to a reusable deterministic seed', () => {
    const document = createBattleIntelExport(matrixResult(), {
      arenaId: 'arena',
      arenaName: 'Arena / Test',
      baseSeed: 0
    }, '2026-08-12T07:00:00.000Z');

    expect(document.context.baseSeed).toBe(1);
    expect(document.context.selectedFighterId).toBeNull();
    expect(document.context.selectedMatchup).toBeNull();
    expect(createBattleIntelExportFilename(document)).toBe('kbe-intel-arena-test-seed-1-50x.json');
  });
});
