import { describe, expect, it } from 'vitest';
import {
  getFighter,
  listCompatibleModules,
  listFighters,
  listModuleParityIssues,
  resolveFighterLoadout,
  summarizeRosterModuleParity
} from '@kinetic/content';

const BUILTIN_IDS = [
  'pyro-brawler',
  'mech-bruiser',
  'water-shaper',
  'bomber',
  'frost-warden',
  'volt-striker',
  'thorn-colossus',
  'void-reaper',
  'gunner',
  'rocket-vanguard',
  'solar-sentinel',
  'ballast',
  'blade-vanguard',
  'iron-lancer'
] as const;

describe('Stage 9B roster and module parity', () => {
  it('gives every built-in fighter offense, defense, mobility and utility choices', () => {
    const fighters = BUILTIN_IDS.map((id) => getFighter(id));
    const parity = summarizeRosterModuleParity(fighters);

    expect(parity.totalFighters).toBe(14);
    expect(parity.fullyCoveredFighters).toBe(14);
    expect(parity.coverageRate).toBe(1);
    expect(listModuleParityIssues(fighters)).toEqual([]);

    for (const fighter of parity.fighters) {
      expect(fighter.slotCounts.offense, `${fighter.fighterName} offense`).toBeGreaterThan(0);
      expect(fighter.slotCounts.defense, `${fighter.fighterName} defense`).toBeGreaterThan(0);
      expect(fighter.slotCounts.mobility, `${fighter.fighterName} mobility`).toBeGreaterThan(0);
      expect(fighter.slotCounts.utility, `${fighter.fighterName} utility`).toBeGreaterThan(0);
      expect(fighter.totalModules).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps every approved module visible through at least one mounted attachment', () => {
    const fighters = BUILTIN_IDS.map((id) => getFighter(id));
    const parity = summarizeRosterModuleParity(fighters);
    expect(parity.mountedModuleRate).toBe(1);

    for (const fighter of fighters) {
      for (const module of listCompatibleModules(fighter)) {
        expect(module.attachments?.length ?? 0, `${fighter.name} / ${module.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('resolves representative identity modules through the generic loadout system', () => {
    const frost = resolveFighterLoadout(getFighter('frost-warden'), { moduleIds: ['razor-rime', 'ice-runners', 'permafrost-core'] });
    expect(frost.primaryDamageMultiplier).toBeCloseTo(1.11);
    expect(frost.abilitySelfImpulseMultiplier['glacier-charge']).toBeCloseTo(1.2);
    expect(frost.abilityRadiusMultiplier['absolute-zero']).toBeCloseTo(1.13);
    expect(frost.mountedAttachments).toHaveLength(3);

    const rocket = resolveFighterLoadout(getFighter('rocket-vanguard'), { moduleIds: ['warhead-rack', 'guidance-array'] });
    expect(rocket.skillProjectileDamageMultiplier).toBeCloseTo(1.12);
    expect(rocket.skillProjectileHomingMultiplier).toBeCloseTo(1.2);

    const water = resolveFighterLoadout(getFighter('water-shaper'), { moduleIds: ['undertow-focus'] });
    expect(water.abilityRadiusMultiplier['tidal-cataclysm']).toBeCloseTo(1.12);
  });

  it('still rejects cross-fighter modules and duplicate modules in the same slot', () => {
    expect(() => resolveFighterLoadout(getFighter('bomber'), { moduleIds: ['razor-rime'] })).toThrow(/cannot equip/i);
    expect(() => resolveFighterLoadout(getFighter('frost-warden'), { moduleIds: ['razor-rime', 'glacier-plating'] })).not.toThrow();
    expect(() => resolveFighterLoadout(getFighter('pyro-brawler'), { moduleIds: ['accelerant-nozzle', 'furnace-nozzle'] })).toThrow(/only one offense/i);
  });

  it('does not alter the public built-in roster order', () => {
    const roster = listFighters().filter((fighter) => BUILTIN_IDS.includes(fighter.id as typeof BUILTIN_IDS[number]));
    expect(roster.map((fighter) => fighter.id)).toEqual(BUILTIN_IDS);
  });
});
