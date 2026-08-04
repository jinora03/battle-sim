import { describe, expect, it } from 'vitest';
import {
  CONTENT_VERSION,
  MIN_FIGHTER_RADIUS,
  getAbility,
  getArena,
  getFighter,
  getGameMode,
  getPrimaryAttack,
  isAttackCombinationAllowed,
  listArenas,
  listFighters,
  listGameModes,
  listPrimaryAttacks
} from '@kinetic/content';
import { getSkillPresentation } from '@kinetic/visual-engine';

const skillSlots = ['skill1', 'skill2', 'skill3', 'ultimate'] as const;

describe('content definitions', () => {
  it('loads the built-in fighter library', () => {
    expect(listFighters().map((fighter) => fighter.id)).toEqual(
      expect.arrayContaining(['pyro-brawler', 'mech-bruiser', 'water-shaper', 'bomber', 'frost-warden', 'volt-striker', 'thorn-colossus', 'void-reaper', 'gunner', 'ballast'])
    );
  });

  it('keeps every built-in fighter at or above the readable radius baseline', () => {
    expect(MIN_FIGHTER_RADIUS).toBe(45);
    for (const fighter of listFighters()) {
      expect(fighter.physics.radius, fighter.id).toBeGreaterThanOrEqual(MIN_FIGHTER_RADIUS);
    }
  });

  it('gives every built-in fighter one primary attack plus four presented skills', () => {
    for (const fighter of listFighters()) {
      expect(getPrimaryAttack(fighter.primaryAttackId)).toBeDefined();
      expect(fighter.abilitySlots.basic).toBeUndefined();
      for (const slot of skillSlots) {
        const abilityId = fighter.abilitySlots[slot];
        expect(abilityId).toBeTruthy();
        expect(getAbility(abilityId!)).toBeDefined();
        expect(getSkillPresentation(abilityId!).shortName).not.toBe('Skill');
      }
    }
  });

  it('registers only allowed attack-form and behavior combinations', () => {
    for (const attack of listPrimaryAttacks()) {
      expect(attack.category).toBe(attack.behavior);
      expect(isAttackCombinationAllowed(attack.form, attack.behavior)).toBe(true);
    }
    expect(isAttackCombinationAllowed('sword', 'melee')).toBe(true);
    expect(isAttackCombinationAllowed('sword', 'spin')).toBe(true);
    expect(isAttackCombinationAllowed('rifle', 'melee')).toBe(false);
  });

  it('registers the current roster, arena and mode catalog', () => {
    expect(CONTENT_VERSION).toBe('1.3.7-stage8.5c');
    expect(listFighters().length).toBeGreaterThanOrEqual(9);
    expect(listArenas().map((arena) => arena.id)).toEqual(
      expect.arrayContaining(['iron-pit', 'pillar-court', 'elemental-foundry', 'war-basin', 'cryo-ring', 'arc-crucible', 'training-grid'])
    );
    expect(listGameModes().map((mode) => mode.id)).toEqual(
      expect.arrayContaining(['duel', 'team-battle', 'battle-royale', 'boss-raid', 'survival', 'mass-skirmish', 'training'])
    );
  });

  it('describes arena geometry, capacity and compatibility through data', () => {
    const pit = getArena('iron-pit');
    const court = getArena('pillar-court');
    const foundry = getArena('elemental-foundry');

    expect(pit.allowedModes).toContain('duel');
    expect(pit.allowedModes).not.toContain('team-battle');
    expect(court.obstacles.length).toBeGreaterThan(0);
    expect(court.obstacles.some((obstacle) => obstacle.destructible)).toBe(true);
    expect(foundry.zones.map((zone) => zone.kind)).toEqual(
      expect.arrayContaining(['ice', 'water', 'lava', 'electric', 'wind'])
    );
    expect(foundry.recommendedUnits.max).toBeGreaterThan(pit.recommendedUnits.max);
  });

  it('stores victory rules in game-mode definitions', () => {
    expect(getGameMode('duel').victory).toBe('LAST_TEAM_STANDING');
    expect(getGameMode('duel').formatLabel).toBe('1v1 only');
    expect(getGameMode('duel').description).toContain('1v1');
    expect(getGameMode('boss-raid').victory).toBe('DEFEAT_BOSS');
    expect(getGameMode('survival').victory).toBe('SURVIVE_TICKS');
  });
});
