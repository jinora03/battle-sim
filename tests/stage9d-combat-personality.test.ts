import { describe, expect, it } from 'vitest';
import { getAbility, getFighter, getPrimaryAttack, getProjectileSource } from '@kinetic/content';
import { getSkillPresentation } from '@kinetic/visual-engine';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { BASELINE_FIGHT_HP_SCALE } from '../packages/simulation/src/world';
import { resolveKnockbackAngularImpulse } from '../packages/renderer-pixi/src/fighterReactions';
import {
  resolvePrimaryAttackVisualMounts,
  resolveWeaponVisualMountPose
} from '../packages/renderer-pixi/src/weaponMounts';

const COLLISION_KNOCKBACKS = [
  ['blast-dash', 'blast-dash', 60],
  ['lightning-dash', 'overcharged', 60],
  ['surge-dash', 'surge', 55],
  ['phase-lunge', 'phased', 60]
] as const;

const SIGNATURE_KNOCKBACK_STYLES = {
  'magma-dash': 'tackle',
  'blast-dash': 'explosive-ram',
  'glacier-charge': 'weapon-charge',
  'kinetic-pulse': 'shockwave',
  'surge-dash': 'flowing-shove',
  'lightning-dash': 'electric-tackle',
  'bramble-charge': 'juggernaut',
  'phase-lunge': 'phase-strike',
  'pinning-round': 'precision-shot',
  'blast-jump': 'rocket-recoil',
  'solar-rush': 'power-charge',
  downbeat: 'gravity-punt'
} as const;

describe('Stage 9D combat personality and physical spectacle', () => {
  it('keeps current roster weapons centered while retaining future left/right mount support', () => {
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('automatic-rifle')).map((mount) => mount.side)).toEqual(['center']);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('guided-rocket')).map((mount) => mount.side)).toEqual(['center']);
    expect(getPrimaryAttack('automatic-rifle').muzzleOffsetScale).toBeCloseTo(2.55, 6);
    expect(getPrimaryAttack('guided-rocket').muzzleOffsetScale).toBeCloseTo(2.02, 6);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('frost-halberd')).map((mount) => mount.side)).toEqual(['center']);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('hydraulic-gauntlet')).map((mount) => mount.side)).toEqual(['center']);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('solar-punch')).map((mount) => mount.side)).toEqual(['center']);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('void-scythe')).map((mount) => mount.side)).toEqual(['center']);
    expect(resolvePrimaryAttackVisualMounts(getPrimaryAttack('thorn-claws')).map((mount) => mount.side)).toEqual(['center']);

    const [left, right] = resolvePrimaryAttackVisualMounts({
      style: 'swing',
      visualMounts: [
        { id: 'left-test', side: 'left' },
        { id: 'right-test', side: 'right' }
      ]
    });
    expect(resolveWeaponVisualMountPose(left!, 50).y).toBeLessThan(0);
    expect(resolveWeaponVisualMountPose(right!, 50).y).toBeGreaterThan(0);
  });

  it('turns glancing knockback into mass-aware presentation rotation without rotating centered hits', () => {
    const centered = resolveKnockbackAngularImpulse({
      direction: { x: 1, y: 0 }, facingRadians: 0, force: 14, mass: 1, kind: 'ability'
    });
    const lightSideHit = resolveKnockbackAngularImpulse({
      direction: { x: 0, y: 1 }, facingRadians: 0, force: 14, mass: 1, kind: 'ability'
    });
    const heavySideHit = resolveKnockbackAngularImpulse({
      direction: { x: 0, y: 1 }, facingRadians: 0, force: 14, mass: 4.2, kind: 'ability'
    });
    const weakSideHit = resolveKnockbackAngularImpulse({
      direction: { x: 0, y: 1 }, facingRadians: 0, force: 7, mass: 1, kind: 'ability'
    });
    const oppositeSide = resolveKnockbackAngularImpulse({
      direction: { x: 0, y: -1 }, facingRadians: 0, force: 14, mass: 1, kind: 'ability'
    });

    expect(centered).toBeCloseTo(0, 6);
    expect(lightSideHit).toBeGreaterThan(0);
    expect(oppositeSide).toBeLessThan(0);
    expect(Math.abs(lightSideHit)).toBeGreaterThan(Math.abs(heavySideHit));
    expect(Math.abs(lightSideHit)).toBeGreaterThan(Math.abs(weakSideHit));
    expect(Math.abs(lightSideHit)).toBeGreaterThan(10);
  });

  it('upgrades existing movement skills into one-hit collision knockback instead of adding ability slots', () => {
    for (const [abilityId, statusId, magnitude] of COLLISION_KNOCKBACKS) {
      const ability = getAbility(abilityId);
      const trigger = ability.triggers.find((candidate) => candidate.event === 'ON_COLLISION');
      expect(trigger, abilityId).toBeDefined();
      expect(trigger?.conditions).toContainEqual(expect.objectContaining({ type: 'SELF_HAS_STATUS', statusId }));
      expect(trigger?.actions).toContainEqual({ type: 'APPLY_KNOCKBACK_TARGET', magnitude });
      expect(trigger?.actions).not.toContainEqual({ type: 'REMOVE_STATUS_SELF', statusId });
      expect(ability.slot).toBe('skill1');
    }
  });

  it('gives every roster identity a distinct signature knockback presentation language', () => {
    expect(Object.keys(SIGNATURE_KNOCKBACK_STYLES)).toHaveLength(12);
    for (const [abilityId, style] of Object.entries(SIGNATURE_KNOCKBACK_STYLES)) {
      expect(getSkillPresentation(abilityId).knockbackStyle, abilityId).toBe(style);
    }

    expect(getSkillPresentation('magma-dash').motion).toBe('spiral');
    expect(getSkillPresentation('glacier-charge').motion).toBe('sweep');
    expect(getSkillPresentation('surge-dash').motion).toBe('flow');
    expect(getSkillPresentation('phase-lunge').motion).toBe('phase');
    expect(getSkillPresentation('downbeat').motion).toBe('pivot');
  });

  it('raises baseline roster mobility while keeping heavy and fast identities distinct', () => {
    expect(getFighter('pyro-brawler').physics.maxSpeed).toBe(15.6);
    expect(getFighter('volt-striker').physics.maxSpeed).toBe(17.8);
    expect(getFighter('thorn-colossus').physics.maxSpeed).toBe(9.4);
    expect(getFighter('mech-bruiser').stats.moveAcceleration).toBe(0.156);
    expect(getFighter('volt-striker').stats.moveAcceleration).toBe(0.319);
  });

  it('makes every roster family expose at least one unmistakably forceful existing skill', () => {
    const force = (abilityId: string, actionType: string, field: string) => {
      const ability = getAbility(abilityId);
      const hit = ability.triggers.flatMap((trigger) => trigger.actions).find((candidate) => candidate.type === actionType) as unknown as Record<string, unknown> | undefined;
      return Number(hit?.[field] ?? 0);
    };
    expect(force('magma-dash', 'APPLY_KNOCKBACK_TARGET', 'magnitude')).toBeGreaterThanOrEqual(55);
    expect(force('shrapnel-burst', 'EXPLODE', 'impulse')).toBeGreaterThanOrEqual(46);
    expect(force('glacier-charge', 'APPLY_KNOCKBACK_TARGET', 'magnitude')).toBeGreaterThanOrEqual(60);
    expect(force('kinetic-pulse', 'RADIAL_IMPULSE', 'magnitude')).toBeGreaterThanOrEqual(60);
    expect(force('pressure-wave', 'EXPLODE', 'impulse')).toBeGreaterThanOrEqual(46);
    expect(force('lightning-dash', 'APPLY_KNOCKBACK_TARGET', 'magnitude')).toBeGreaterThanOrEqual(60);
    expect(force('bramble-charge', 'APPLY_KNOCKBACK_TARGET', 'magnitude')).toBeGreaterThanOrEqual(62);
    expect(force('phase-lunge', 'APPLY_KNOCKBACK_TARGET', 'magnitude')).toBeGreaterThanOrEqual(60);
    expect(getProjectileSource('pinning-round-projectile').knockback).toBeGreaterThanOrEqual(42);
    expect(force('blast-jump', 'EXPLODE', 'impulse')).toBeGreaterThanOrEqual(60);
    expect(force('solar-rush', 'DIRECTIONAL_DAMAGE', 'knockback')).toBeGreaterThanOrEqual(60);
    expect(force('downbeat', 'DIRECTIONAL_DAMAGE', 'knockback')).toBeGreaterThanOrEqual(60);
  });

  it('starts ranged projectiles at the visible muzzle instead of inside the fighter body', () => {
    const runner = new LocalSimulationRunner({
      seed: 90731,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'gunner', team: 1, controller: 'player', x: 300, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 760, y: 470 }
      ]
    });
    runner.step([{ type: 'activatePrimaryAttack', entityId: 0, direction: { x: 1, y: 0 } }]);
    for (let tick = 0; tick < 8 && runner.getSnapshot().projectiles.length === 0; tick += 1) runner.step([]);
    const snapshot = runner.getSnapshot();
    const gunner = snapshot.entities.find((entity) => entity.id === 0)!;
    const bullet = snapshot.projectiles[0];
    expect(bullet).toBeDefined();
    expect((bullet?.x ?? gunner.x) - gunner.x).toBeGreaterThan(gunner.radius * 2.4);
  });

  it('uses a lower runtime HP baseline without rewriting fighter content identity values', () => {
    expect(BASELINE_FIGHT_HP_SCALE).toBe(0.65);
    const fighter = getFighter('mech-bruiser');
    const runner = new LocalSimulationRunner({
      seed: 90732,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'mech-bruiser', team: 1, controller: 'player' },
        { fighterId: 'gunner', team: 2, controller: 'player' }
      ]
    });
    const mech = runner.getSnapshot().entities.find((entity) => entity.fighterId === 'mech-bruiser')!;
    expect(mech.maxHp).toBeCloseTo(fighter.stats.maxHp * 0.65, 6);
  });

});
