import { describe, expect, it } from 'vitest';
import { getFighter, listFighters, removeCustomFighter } from '@kinetic/content';
import { migrateFighterBundle, registerFighterBundle, validateFighterBundle, type FighterBundle } from '@kinetic/creator';
import { removeCustomMotionRecipe, removeCustomVisualRecipe } from '@kinetic/visual-engine';
import { LocalSimulationRunner } from '@kinetic/simulation';

const bundle: FighterBundle = {
  schemaVersion: 2,
  fighter: {
    id: 'creator-test-fighter',
    name: 'Creator Test Fighter',
    classification: { archetype: 'striker', elements: ['electric'], traits: ['custom'] },
    physics: { radius: 27, mass: 1.2, restitution: 0.92, linearDamping: 0.993, maxSpeed: 12 },
    stats: { maxHp: 210, moveAcceleration: 0.2 },
    aiProfileId: 'aggressive-brawler',
    primaryAttackId: 'arc-emitter',
    abilitySlots: { skill1: 'surge-dash', skill2: 'kinetic-pulse', skill3: 'undertow', ultimate: 'reactor-overdrive' },
    resistances: { electric: 0.8 },
    visualRecipeId: 'creator-test-fighter-visual',
    animationRecipeId: 'creator-test-fighter-motion',
    audioProfileId: 'custom-hybrid'
  },
  visualRecipe: {
    id: 'creator-test-fighter-visual', shape: 'orb', bodyColor: 0x6655dd, bodyDarkColor: 0x221944,
    coreColor: 0xffee66, auraColor: 0xaa66ff, accentColor: 0x66eeff, horns: false
  },
  motionRecipe: {
    id: 'creator-test-fighter-motion', speedStretch: 0.17, impactSquash: 0.2, lean: 0.14,
    pulseAmount: 0.04, pulseSpeed: 3.1, weaponSpin: 2.2
  }
};

function cleanup() {
  removeCustomFighter(bundle.fighter.id);
  removeCustomVisualRecipe(bundle.visualRecipe.id);
  removeCustomMotionRecipe(bundle.motionRecipe.id);
}

describe('fighter creator content pipeline', () => {
  it('validates, registers and simulates a primary-attack fighter bundle without fighter-specific engine code', () => {
    cleanup();
    expect(validateFighterBundle(bundle).success).toBe(true);
    registerFighterBundle(bundle);
    expect(getFighter(bundle.fighter.id).primaryAttackId).toBe('arc-emitter');
    expect(listFighters().some((fighter) => fighter.id === bundle.fighter.id)).toBe(true);

    const runner = new LocalSimulationRunner({
      seed: 99125,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: bundle.fighter.id, team: 1, controller: 'ai' },
        { fighterId: 'bomber', team: 2, controller: 'ai' }
      ]
    });
    expect(runner.getSnapshot().entities[0]?.fighterId).toBe(bundle.fighter.id);
    cleanup();
  });

  it('migrates a legacy display/gameplay/basic bundle into one authoritative primary attack', () => {
    const legacy = structuredClone(bundle) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const fighter = legacy.fighter as Record<string, unknown>;
    fighter.weaponId = 'arc-rifle';
    delete fighter.primaryAttackId;
    fighter.abilitySlots = { basic: 'static-strike', skill1: 'surge-dash', skill2: 'kinetic-pulse', skill3: 'undertow', ultimate: 'reactor-overdrive' };
    const visual = legacy.visualRecipe as Record<string, unknown>;
    visual.weapon = 'rifle';

    const migration = migrateFighterBundle(legacy);
    const migrated = migration.value as { fighter: { primaryAttackId: string; abilitySlots: Record<string, unknown> }; visualRecipe: Record<string, unknown> };
    expect(migration.migrated).toBe(true);
    expect(migrated.fighter.primaryAttackId).toBe('arc-emitter');
    expect(migrated.fighter.abilitySlots.basic).toBeUndefined();
    expect(migrated.visualRecipe.weapon).toBeUndefined();
    expect(validateFighterBundle(migration.value).success).toBe(true);
  });

  it('rejects missing skill references before registration', () => {
    const invalid = structuredClone(bundle);
    invalid.fighter.id = 'invalid-creator-fighter';
    invalid.fighter.visualRecipeId = 'invalid-creator-fighter-visual';
    invalid.fighter.animationRecipeId = 'invalid-creator-fighter-motion';
    invalid.visualRecipe.id = invalid.fighter.visualRecipeId;
    invalid.motionRecipe.id = invalid.fighter.animationRecipeId;
    invalid.fighter.abilitySlots.skill1 = 'missing-ability';
    const result = validateFighterBundle(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('missing-ability');
  });
});
