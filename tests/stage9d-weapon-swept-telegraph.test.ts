import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getFighter,
  getMeleeContactProfile,
  getPrimaryAttack,
  resolveMeleeContactReach
} from '@kinetic/content';
import { getSkillPresentation } from '@kinetic/visual-engine';
import {
  MELEE_SWEEP_ARC_MIN_DEGREES,
  isMeleeWeaponTelegraph,
  resolveMeleeTelegraphGeometry,
  resolveMeleeTelegraphKind,
  type MeleeTelegraphInput
} from '../packages/renderer-pixi/src/meleeSkillTelegraph';

/**
 * Stage 9D melee readability: weapon skills and weapon charges should telegraph
 * as a directional swept blade / committed forward lane derived from the real
 * contact envelope, instead of sharing the generic concentric ring with ranged
 * and area abilities. These tests build the telegraph input exactly the way the
 * renderer does (from content + skill presentation) so classification is pinned
 * against real fighter data, and the pure geometry is verified to never close
 * into a full ring and to stay within the previously authored footprint.
 */

const TWO_PI = Math.PI * 2;

/** Mirror of SkillTelegraphRenderer.resolveMeleeTelegraphInput, built from content. */
function telegraphInputFor(
  fighterId: string,
  abilityId: string,
  progress = 1,
  fighterRadius = 46,
  facingRadians = 0
): MeleeTelegraphInput {
  const fighter = getFighter(fighterId);
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  const primaryIsMeleeWeapon = getMeleeContactProfile(primary) !== null;
  const activateActions = getAbility(abilityId).triggers
    .filter((trigger) => trigger.event === 'ON_ACTIVATE')
    .flatMap((trigger) => trigger.actions);
  const strike = activateActions.find((action) => action.type === 'MELEE_WEAPON_STRIKE') as
    | { sweepDegrees?: number; reachMultiplier?: number }
    | undefined;
  const hasMeleeWeaponStrike = strike !== undefined;
  const sweepDegrees = strike ? Number(strike.sweepDegrees ?? 0) : 0;
  const reachMultiplier = strike ? Number(strike.reachMultiplier ?? 1) : 1;
  const isCharge = activateActions.some((action) => action.type === 'APPLY_IMPULSE_SELF');
  const recipe = getSkillPresentation(abilityId);
  return {
    originX: 300,
    originY: 300,
    facingRadians,
    fighterRadius,
    primaryIsMeleeWeapon,
    hasMeleeWeaponStrike,
    sweepDegrees,
    isCharge,
    knockbackStyle: recipe.knockbackStyle,
    weaponReach: primaryIsMeleeWeapon
      ? resolveMeleeContactReach(primary, fighterRadius, 0, reachMultiplier)
      : 0,
    telegraphRadius: recipe.telegraphRadius,
    progress
  };
}

const MELEE_WEAPON_SKILLS: ReadonlyArray<[string, string]> = [
  ['blade-vanguard', 'crosscut'],
  ['blade-vanguard', 'duelist-step'],
  ['blade-vanguard', 'execution-arc'],
  ['blade-vanguard', 'driving-slash'],
  ['iron-lancer', 'pike-sweep'],
  ['iron-lancer', 'vault-thrust'],
  ['iron-lancer', 'lance-charge'],
  ['iron-lancer', 'breakthrough-charge'],
  // Systemic across the melee-weapon roster, not only the captured matchup:
  ['frost-warden', 'glacier-charge'],
  ['thorn-colossus', 'bramble-charge'],
  ['void-reaper', 'phase-lunge']
];

const NON_MELEE_WEAPON_SKILLS: ReadonlyArray<[string, string]> = [
  ['mech-bruiser', 'kinetic-pulse'], // radial nova on a slam fighter: excluded by knockback style
  ['water-shaper', 'pressure-wave'], // ranged primary
  ['water-shaper', 'surge-dash'], // ranged primary, a body dash
  ['bomber', 'mega-bomb'], // thrown explosive
  ['pyro-brawler', 'magma-dash'], // non-contact primary, a body dash
  ['volt-striker', 'lightning-dash'] // ranged primary, a body dash
];

const ARC_SKILLS: ReadonlyArray<[string, string]> = [
  ['blade-vanguard', 'crosscut'],
  ['iron-lancer', 'pike-sweep'],
  ['blade-vanguard', 'execution-arc'],
  ['blade-vanguard', 'duelist-step']
];

const LANE_SKILLS: ReadonlyArray<[string, string]> = [
  ['iron-lancer', 'vault-thrust'],
  ['blade-vanguard', 'driving-slash'],
  ['iron-lancer', 'lance-charge'],
  ['iron-lancer', 'breakthrough-charge'],
  ['frost-warden', 'glacier-charge'],
  ['thorn-colossus', 'bramble-charge'],
  ['void-reaper', 'phase-lunge']
];

describe('weapon-led melee skill telegraph classification', () => {
  it.each(MELEE_WEAPON_SKILLS)('routes %s %s to the weapon telegraph', (fighterId, abilityId) => {
    expect(isMeleeWeaponTelegraph(telegraphInputFor(fighterId, abilityId))).toBe(true);
  });

  it.each(NON_MELEE_WEAPON_SKILLS)('leaves %s %s on the generic telegraph', (fighterId, abilityId) => {
    expect(isMeleeWeaponTelegraph(telegraphInputFor(fighterId, abilityId))).toBe(false);
  });

  it.each(ARC_SKILLS)('fans %s %s as a swept arc', (fighterId, abilityId) => {
    expect(resolveMeleeTelegraphKind(telegraphInputFor(fighterId, abilityId))).toBe('arc');
  });

  it.each(LANE_SKILLS)('projects %s %s as a forward lane', (fighterId, abilityId) => {
    expect(resolveMeleeTelegraphKind(telegraphInputFor(fighterId, abilityId))).toBe('lane');
  });

  it('keeps the arc/lane split threshold sane', () => {
    expect(MELEE_SWEEP_ARC_MIN_DEGREES).toBeGreaterThan(30);
    expect(MELEE_SWEEP_ARC_MIN_DEGREES).toBeLessThan(90);
  });
});

describe('swept arc telegraph geometry', () => {
  it('never closes into a full ring and stays within the authored footprint', () => {
    for (const [fighterId, abilityId] of ARC_SKILLS) {
      const input = telegraphInputFor(fighterId, abilityId);
      const geometry = resolveMeleeTelegraphGeometry(input);
      const footprint = Math.max(input.fighterRadius * 2.2, input.telegraphRadius);
      expect(geometry.kind).toBe('arc');
      expect(geometry.sweepRadians).toBeGreaterThan(0);
      expect(geometry.sweepRadians).toBeLessThan(TWO_PI * 0.98);
      expect(geometry.outerRadius).toBeGreaterThan(geometry.innerRadius);
      expect(geometry.innerRadius).toBeGreaterThan(0);
      expect(geometry.outerRadius).toBeLessThanOrEqual(footprint + 1e-6);
    }
  });

  it('centres the swing on the fighter facing', () => {
    const facing = 0.7;
    const geometry = resolveMeleeTelegraphGeometry(
      telegraphInputFor('iron-lancer', 'pike-sweep', 1, 46, facing)
    );
    expect((geometry.startAngle + geometry.endAngle) / 2).toBeCloseTo(facing, 6);
    expect(geometry.startAngle).toBeLessThan(geometry.endAngle);
  });

  it('sweeps the leading blade from the start edge to the end edge over the cast', () => {
    const start = resolveMeleeTelegraphGeometry(telegraphInputFor('blade-vanguard', 'crosscut', 0));
    const end = resolveMeleeTelegraphGeometry(telegraphInputFor('blade-vanguard', 'crosscut', 1));
    expect(start.leadAngle).toBeCloseTo(start.startAngle, 6);
    expect(end.leadAngle).toBeCloseTo(end.endAngle, 6);
    expect(end.leadAngle).toBeGreaterThan(start.leadAngle);
  });
});

describe('forward lane telegraph geometry', () => {
  it('projects a bounded forward lane, not a bubble', () => {
    for (const [fighterId, abilityId] of LANE_SKILLS) {
      const input = telegraphInputFor(fighterId, abilityId);
      const geometry = resolveMeleeTelegraphGeometry(input);
      const footprint = Math.max(input.fighterRadius * 2.2, input.telegraphRadius);
      expect(geometry.kind).toBe('lane');
      expect(geometry.laneLength).toBeGreaterThan(0);
      expect(geometry.laneLength).toBeLessThanOrEqual(footprint + 1e-6);
      // A directional lane, never wider than half its length or the fighter.
      expect(geometry.laneHalfWidth).toBeLessThan(geometry.laneLength / 2);
      expect(geometry.laneHalfWidth).toBeLessThan(input.fighterRadius);
    }
  });

  it('advances the leading tip forward along the facing as the charge commits', () => {
    const facing = -1.2;
    const start = resolveMeleeTelegraphGeometry(
      telegraphInputFor('iron-lancer', 'lance-charge', 0, 46, facing)
    );
    const end = resolveMeleeTelegraphGeometry(
      telegraphInputFor('iron-lancer', 'lance-charge', 1, 46, facing)
    );
    const dist = (point: { x: number; y: number }) =>
      Math.hypot(point.x - start.originX, point.y - start.originY);
    expect(dist(end.tip)).toBeGreaterThan(dist(start.tip));
    // Tip travels along the facing direction.
    expect(Math.atan2(end.tip.y - end.originY, end.tip.x - end.originX)).toBeCloseTo(facing, 6);
  });
});

describe('telegraph geometry determinism', () => {
  it('produces identical geometry for identical inputs', () => {
    const build = () => resolveMeleeTelegraphGeometry(telegraphInputFor('blade-vanguard', 'execution-arc', 0.5));
    expect(build()).toEqual(build());
  });
});
