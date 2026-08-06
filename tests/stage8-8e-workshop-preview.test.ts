import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_VERSION,
  getFighter,
  listCompatibleModules,
  resolveFighterLoadout
} from '@kinetic/content';
import { validateFighterBundle, type FighterBundle } from '@kinetic/creator';
import { ENGINE_VERSION } from '@kinetic/simulation';
import { getMotionRecipe, getVisualRecipe } from '@kinetic/visual-engine';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

function gunnerDerivedBundle(): FighterBundle {
  const source = getFighter('gunner');
  const id = 'stage88e-gunner-derived';
  return {
    schemaVersion: 2,
    fighter: {
      ...structuredClone(source),
      id,
      name: 'Stage 8.8E Gunner Derived',
      kitSourceFighterId: source.id,
      classification: { ...source.classification, traits: [...source.classification.traits, 'custom'] },
      defaultModuleIds: ['targeting-drone'],
      visualRecipeId: `${id}-visual`,
      animationRecipeId: `${id}-motion`
    },
    visualRecipe: { ...getVisualRecipe(source.visualRecipeId), id: `${id}-visual` },
    motionRecipe: { ...getMotionRecipe(source.animationRecipeId), id: `${id}-motion` }
  };
}

describe('Stage 8.8E workshop and unified fighter preview', () => {
  it('allows sourced custom fighters to reuse only their authored module catalog', () => {
    const bundle = gunnerDerivedBundle();
    const result = validateFighterBundle(bundle);
    expect(result.success).toBe(true);

    const modules = listCompatibleModules(bundle.fighter);
    expect(modules.some((module) => module.id === 'targeting-drone')).toBe(true);
    expect(resolveFighterLoadout(bundle.fighter).moduleIds).toEqual(['targeting-drone']);
  });

  it('rejects weapons and skills borrowed from a different fighter kit', () => {
    const weaponMismatch = gunnerDerivedBundle();
    weaponMismatch.fighter.primaryAttackId = 'demolition-bomb';
    const weaponResult = validateFighterBundle(weaponMismatch);
    expect(weaponResult.success).toBe(false);
    expect(weaponResult.errors.join(' ')).toContain('Primary attack must come from Gunner');

    const skillMismatch = gunnerDerivedBundle();
    skillMismatch.fighter.abilitySlots.skill1 = 'blast-dash';
    const skillResult = validateFighterBundle(skillMismatch);
    expect(skillResult.success).toBe(false);
    expect(skillResult.errors.join(' ')).toContain('skill1 must come from Gunner');
  });

  it('uses one authored portrait component in Creator, Battle Setup and Roster', () => {
    const portrait = read('../apps/game/src/ui/FighterPortrait.tsx');
    const creator = read('../apps/game/src/features/creator/DeveloperFighterWorkshop.tsx');
    const setup = read('../apps/game/src/features/battle/BattleFighterPreview.tsx');
    const roster = read('../apps/game/src/RosterView.tsx');

    expect(portrait).toContain('body-only');
    expect(portrait).not.toContain('listMountedAttachments');
    expect(portrait).not.toContain('shared-portrait-weapon');
    expect(portrait).not.toContain('shared-portrait-attachment');
    expect(creator).toContain('<FighterPortrait');
    expect(setup).toContain('<FighterPortrait');
    expect(roster).toContain('<FighterPortrait');
  });

  it('revamps the workshop preview, module loadout and compact field spacing', () => {
    const creator = read('../apps/game/src/features/creator/DeveloperFighterWorkshop.tsx');
    const styles = read('../apps/game/src/styles/70-fighter-previews.css');

    expect(creator).toContain('creator-stat-board');
    expect(creator).toContain('Default module loadout');
    expect(creator).toContain('Locked kit source');
    expect(creator).toContain('creator-passive-summary');
    expect(creator).not.toContain('creator-preview-modules');
    expect(creator).not.toContain('creator-preview-note');
    expect(styles).toContain('.creator-passive-summary');
    expect(styles).toContain('.creator-stat-board');
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
