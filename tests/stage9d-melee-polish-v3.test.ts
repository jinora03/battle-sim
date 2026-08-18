import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getAiProfile,
  getPrimaryAttack,
  resolveMeleeContactReach
} from '@kinetic/content';
import { getAiChargedMeleeRepeatLockTicks } from '@kinetic/controllers';
import { resolveChargeWeaponTipScale } from '../packages/renderer-pixi/src/chargePresentation';

function actionTypes(abilityId: string): string[] {
  return getAbility(abilityId).triggers.flatMap((trigger) => trigger.actions.map((action) => action.type));
}

describe('Stage 9D melee polish V3', () => {
  it('makes the sword visibly longer and gives AI a contact range based on the held weapon', () => {
    const sword = getPrimaryAttack('vanguard-longsword');
    expect(sword.visualScale).toBeGreaterThanOrEqual(1.8);
    expect(sword.range).toBeGreaterThanOrEqual(220);
    expect(resolveChargeWeaponTipScale('sword')).toBeGreaterThan(resolveChargeWeaponTipScale('spear'));
    expect(resolveMeleeContactReach(sword, 45, 45, 1.16)).toBeGreaterThan(245);
  });

  it('uses weapon-envelope strikes for Blade and Lancer non-charge melee skills', () => {
    for (const abilityId of ['crosscut', 'duelist-step', 'execution-arc', 'pike-sweep', 'vault-thrust']) {
      const types = actionTypes(abilityId);
      expect(types, abilityId).toContain('MELEE_WEAPON_STRIKE');
      expect(types, abilityId).not.toContain('DIRECTIONAL_DAMAGE');
    }
  });

  it('paces charges far below the normal melee skill cadence', () => {
    const blade = getAiProfile('blade-duelist');
    const lancer = getAiProfile('iron-charger');
    const bladeRules = new Map(blade.abilityUsage.map((rule) => [rule.slot, rule]));
    const lancerRules = new Map(lancer.abilityUsage.map((rule) => [rule.slot, rule]));

    expect(getAiChargedMeleeRepeatLockTicks('driving-slash')).toBeGreaterThanOrEqual(540);
    expect(getAiChargedMeleeRepeatLockTicks('lance-charge')).toBeGreaterThanOrEqual(600);
    expect(bladeRules.get('skill2')!.everyTicks).toBeLessThan(bladeRules.get('skill1')!.everyTicks);
    expect(bladeRules.get('skill3')!.everyTicks).toBeLessThan(bladeRules.get('skill1')!.everyTicks);
    expect(lancerRules.get('skill2')!.everyTicks).toBeLessThan(lancerRules.get('skill1')!.everyTicks);
    expect(lancerRules.get('skill3')!.everyTicks).toBeLessThan(lancerRules.get('skill1')!.everyTicks);
    expect(bladeRules.get('skill2')!.priority).toBeGreaterThan(bladeRules.get('skill1')!.priority);
    expect(lancerRules.get('skill2')!.priority).toBeGreaterThan(lancerRules.get('skill1')!.priority);
  });

  it('requires a real runway before Blade or Lancer considers the main charge', () => {
    const bladeCharge = getAiProfile('blade-duelist').abilityUsage.find((rule) => rule.slot === 'skill1')!;
    const lancerCharge = getAiProfile('iron-charger').abilityUsage.find((rule) => rule.slot === 'skill1')!;
    expect(bladeCharge.minDistance).toBeGreaterThanOrEqual(240);
    expect(lancerCharge.minDistance).toBeGreaterThanOrEqual(300);
  });
});
