import { describe, expect, it } from 'vitest';
import {
  getAiProfile,
  getFighter,
  getPrimaryAttack
} from '@kinetic/content';
import {
  resolveAiEngagementUrgency,
  resolveAiPreferredCombatDistance,
  resolveAiRequiredTargetCount,
  selectAbilityAction
} from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function rocketDuel(): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 9301,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'rocket-vanguard', team: 1, controller: 'ai', x: 200, y: 360 },
      { fighterId: 'bomber', team: 2, controller: 'ai', x: 650, y: 360 }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1200,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

describe('Stage 9C combat and AI refinement', () => {
  it('keeps multi-target AI intent in groups without disabling area skills in duels', () => {
    expect(resolveAiRequiredTargetCount(2, 1)).toBe(1);
    expect(resolveAiRequiredTargetCount(2, 2)).toBe(2);
    expect(resolveAiRequiredTargetCount(3, 6)).toBe(3);

    const snapshot = rocketDuel().getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const selection = selectAbilityAction(snapshot, self, target, getAiProfile('rocket-artillery'));
    const siege = selection.debug?.candidates.find((candidate) => candidate.slot === 'skill3');
    const ultimate = selection.debug?.candidates.find((candidate) => candidate.slot === 'ultimate');

    expect(siege?.valid).toBe(true);
    expect(ultimate?.valid).toBe(true);
  });

  it('preserves normal pacing before 45 seconds and adds deterministic late-fight pressure', () => {
    expect(resolveAiEngagementUrgency(0)).toBe(0);
    expect(resolveAiEngagementUrgency(45 * 60)).toBe(0);
    expect(resolveAiEngagementUrgency(57.5 * 60)).toBeCloseTo(0.5, 6);
    expect(resolveAiEngagementUrgency(70 * 60)).toBe(1);
    expect(resolveAiEngagementUrgency(90 * 60)).toBe(1);
  });

  it('lets throwable identities fight closer than generic ranged spacing', () => {
    const bomberDistance = resolveAiPreferredCombatDistance(45, 'demolition-bomb');
    const gunnerDistance = resolveAiPreferredCombatDistance(410, 'automatic-rifle');

    expect(bomberDistance).toBeGreaterThan(getPrimaryAttack('demolition-bomb').minRange);
    expect(bomberDistance).toBeLessThan(300);
    expect(gunnerDistance).toBe(410);
  });

  it('locks the evidence-based Stage 9C roster correction direction', () => {
    const bomber = getFighter('bomber');
    const ballast = getFighter('ballast');
    const voidReaper = getFighter('void-reaper');
    const solar = getFighter('solar-sentinel');
    const gunner = getFighter('gunner');
    const rocket = getFighter('rocket-vanguard');

    expect(bomber.stats.maxHp).toBeGreaterThan(395);
    expect(ballast.stats.maxHp).toBeGreaterThan(360);
    expect(voidReaper.stats.maxHp).toBeGreaterThan(325);
    expect(solar.stats.maxHp).toBeLessThan(450);
    expect(gunner.stats.maxHp).toBeLessThan(355);
    expect(rocket.stats.maxHp).toBeLessThan(430);

    expect(getPrimaryAttack('demolition-bomb').projectile?.explosionDamage).toBeGreaterThan(12.2);
    expect(getPrimaryAttack('solar-punch').damage).toBeLessThan(19);
    expect(getPrimaryAttack('guided-rocket').projectile?.explosionDamage).toBeLessThan(12.2);
  });
});
