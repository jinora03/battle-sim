import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getFighter,
  getPrimaryAttack,
  listCompatibleModules,
  listFighters,
  validateFighterReferences
} from '@kinetic/content';
import { getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';

function actionOf<T extends string>(abilityId: string, type: T) {
  const ability = getAbility(abilityId);
  return ability.triggers.flatMap((trigger) => trigger.actions).find((action) => action.type === type);
}

describe('Stage 9D sword and spear roster expansion', () => {
  it('appends Blade Vanguard and Iron Lancer without disturbing the original roster order', () => {
    const ids = listFighters().map((fighter) => fighter.id);
    expect(ids.slice(-2)).toEqual(['blade-vanguard', 'iron-lancer']);
    expect(ids).toHaveLength(14);
    expect(validateFighterReferences(getFighter('blade-vanguard'))).toEqual([]);
    expect(validateFighterReferences(getFighter('iron-lancer'))).toEqual([]);
  });

  it('gives the new fighters distinct centered sword and spear primary weapons', () => {
    const sword = getPrimaryAttack('vanguard-longsword');
    const spear = getPrimaryAttack('war-spear');

    expect(sword.form).toBe('sword');
    expect(sword.style).toBe('swing');
    expect(sword.visualMounts?.[0]?.side).toBe('center');
    expect(spear.form).toBe('spear');
    expect(spear.style).toBe('thrust');
    expect(spear.visualMounts?.[0]?.side).toBe('center');
    expect(spear.range).toBeGreaterThan(sword.range);
  });

  it('makes the signature charges real launch payoffs instead of cosmetic dashes', () => {
    const drivingImpulse = actionOf('driving-slash', 'APPLY_IMPULSE_SELF');
    const drivingKnockback = actionOf('driving-slash', 'APPLY_KNOCKBACK_TARGET');
    const lanceImpulse = actionOf('lance-charge', 'APPLY_IMPULSE_SELF');
    const lanceKnockback = actionOf('lance-charge', 'APPLY_KNOCKBACK_TARGET');
    const breakthroughImpulse = actionOf('breakthrough-charge', 'APPLY_IMPULSE_SELF');
    const breakthroughKnockback = actionOf('breakthrough-charge', 'APPLY_KNOCKBACK_TARGET');

    expect(drivingImpulse && 'magnitude' in drivingImpulse ? drivingImpulse.magnitude : 0).toBeGreaterThanOrEqual(19);
    expect(drivingKnockback && 'magnitude' in drivingKnockback ? drivingKnockback.magnitude : 0).toBeGreaterThanOrEqual(36);
    expect(lanceImpulse && 'magnitude' in lanceImpulse ? lanceImpulse.magnitude : 0).toBeGreaterThanOrEqual(23);
    expect(lanceKnockback && 'magnitude' in lanceKnockback ? lanceKnockback.magnitude : 0).toBeGreaterThanOrEqual(44);
    expect(breakthroughImpulse && 'magnitude' in breakthroughImpulse ? breakthroughImpulse.magnitude : 0).toBeGreaterThanOrEqual(31);
    expect(breakthroughKnockback && 'magnitude' in breakthroughKnockback ? breakthroughKnockback.magnitude : 0).toBeGreaterThanOrEqual(62);
  });

  it('telegraphs sword load-up into a sweep and spear load-up into a committed charge', () => {
    const drivingSlash = getSkillPresentation('driving-slash');
    const lanceCharge = getSkillPresentation('lance-charge');
    const breakthrough = getSkillPresentation('breakthrough-charge');

    expect(drivingSlash.motion).toBe('charge-sweep');
    expect(drivingSlash.knockbackStyle).toBe('weapon-charge');
    expect(lanceCharge.motion).toBe('charge');
    expect(lanceCharge.knockbackStyle).toBe('weapon-charge');
    expect(breakthrough.importance).toBe('ultimate');
    expect(breakthrough.knockbackStyle).toBe('power-charge');
  });

  it('ships full four-slot module parity and distinct body recipes', () => {
    for (const fighterId of ['blade-vanguard', 'iron-lancer']) {
      const fighter = getFighter(fighterId);
      const modules = listCompatibleModules(fighter);
      expect(new Set(modules.map((module) => module.slot))).toEqual(new Set(['offense', 'defense', 'mobility', 'utility']));
      expect(modules).toHaveLength(4);
      expect(modules.every((module) => (module.attachments?.length ?? 0) > 0)).toBe(true);
      expect(getVisualRecipe(fighter.visualRecipeId).id).toBe(fighter.visualRecipeId);
    }
  });
});
