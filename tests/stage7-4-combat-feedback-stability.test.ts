import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, getAbility, getElementMultiplier, getFighter, getPrimaryAttack } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { compactMissilePresentationEvents, compactMissileSecondaryPresentationEvents, isMissileCascadeFrame, MissileCascadeTracker, resolveBlastFeedback, resolveUltimateFreezeMs, resolveWeaponHitFreezeMs, shouldPresentDamage } from '../packages/renderer-pixi/src/combatFeedback';
import { LocalSimulationRunner } from '@kinetic/simulation';

function trainingBattle(participants: BattleDefinition['participants'], seed = 7401): LocalSimulationRunner {
  return new LocalSimulationRunner({
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1_500,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  });
}

function run(runner: LocalSimulationRunner, ticks: number, first?: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(tick === 0 && first ? [first] : []));
  return events;
}

describe('v1.1 Stage 7.4 combat feedback and stability', () => {
  it('keeps Gunner cadence and projectile feel while retaining only the damage nerf', () => {
    expect(CONTENT_VERSION).toBe('1.1.6-stage7.5');
    const rifle = getPrimaryAttack('automatic-rifle');
    expect(rifle.damage).toBe(3.4);
    expect(rifle.burstCount).toBe(4);
    expect(rifle.burstIntervalTicks).toBe(4);
    expect(rifle.cooldownTicks).toBe(34);
    expect(rifle.projectile?.speed).toBe(21);
    expect(rifle.visualScale).toBe(1.75);
  });

  it('slows Bomber basic attack to the Guided Rocket cadence', () => {
    expect(getPrimaryAttack('demolition-bomb').cooldownTicks).toBe(getPrimaryAttack('guided-rocket').cooldownTicks);
    expect(getPrimaryAttack('demolition-bomb').cooldownTicks).toBe(92);
  });

  it('never applies repeated hit-stop to micro-missile cascades', () => {
    const micro = resolveBlastFeedback({ abilityId: 'micro-missile', force: 8, radius: 72 }, 'hero');
    const crowdMicro = resolveBlastFeedback({ abilityId: 'micro-missile', force: 8, radius: 72 }, 'crowd');
    const barrage = resolveBlastFeedback({ abilityId: 'rocket-salvo-missile', force: 10, radius: 92 }, 'hero');
    const heavy = resolveBlastFeedback({ abilityId: 'mega-bomb', force: 18, radius: 260 }, 'hero');
    expect(micro.freezeMs).toBe(0);
    expect(crowdMicro.freezeMs).toBe(0);
    expect(barrage.freezeMs).toBe(0);
    expect(resolveWeaponHitFreezeMs({ weaponId: 'micro-missile', damage: 12 })).toBe(0);
    expect(resolveWeaponHitFreezeMs({ weaponId: 'guided-rocket', damage: 16 })).toBe(0);
    expect(resolveUltimateFreezeMs({ abilityId: 'starburst-convergence' }, 'mega-bomb')).toBe(0);
    expect(isMissileCascadeFrame([{ type: 'abilityResolved', tick: 20, entityId: 1, abilityId: 'starburst-convergence', slot: 'ultimate', position: { x: 0, y: 0 }, direction: { x: 1, y: 0 } }])).toBe(true);
    expect(isMissileCascadeFrame([{ type: 'projectileImpact', tick: 21, projectileId: 5, sourceId: 1, weaponId: 'guided-rocket', position: { x: 0, y: 0 } }])).toBe(true);
    expect(isMissileCascadeFrame([{ type: 'blast', tick: 22, sourceId: 1, abilityId: 'guided-rocket', kind: 'explosion', position: { x: 0, y: 0 }, radius: 118, force: 13, damage: 16, element: 'fire' }])).toBe(true);
    expect(heavy.freezeMs).toBeGreaterThan(barrage.freezeMs);
  });

  it('keeps missile-caused wall, body and death feedback from reintroducing hit-stop', () => {
    const tracker = new MissileCascadeTracker(12);
    expect(tracker.shouldSuppressFreeze([
      { type: 'weaponHit', tick: 10, sourceId: 1, targetId: 2, weaponId: 'guided-rocket', position: { x: 900, y: 360 }, damage: 16, knockback: 13 },
      { type: 'damage', tick: 10, sourceId: 1, targetId: 2, amount: 16, element: 'fire', hpAfter: 84, position: { x: 900, y: 360 } },
      { type: 'knockbackApplied', tick: 10, sourceId: 1, targetId: 2, kind: 'explosion', position: { x: 900, y: 360 }, direction: { x: 1, y: 0 }, force: 13 }
    ], 10)).toBe(true);
    expect(tracker.shouldSuppressFreeze([
      { type: 'wallImpact', tick: 16, entityId: 2, position: { x: 1010, y: 360 }, magnitude: 12 }
    ], 16)).toBe(true);
    expect(tracker.shouldSuppressFreeze([
      { type: 'wallImpact', tick: 17, entityId: 99, position: { x: 1010, y: 200 }, magnitude: 12 }
    ], 17)).toBe(false);
    expect(tracker.shouldSuppressFreeze([
      { type: 'wallImpact', tick: 23, entityId: 2, position: { x: 1010, y: 360 }, magnitude: 12 }
    ], 23)).toBe(false);
  });

  it('presents prevented Ability Lab damage with the same combat feedback policy', () => {
    expect(shouldPresentDamage({ amount: 3.6, prevented: true })).toBe(true);
    expect(shouldPresentDamage({ amount: 0, prevented: true })).toBe(false);
    expect(shouldPresentDamage({ amount: 3.6, prevented: false })).toBe(true);
  });


  it('compacts a missile swarm to three launches and one combined impact without changing gameplay events', () => {
    const events: SimulationEvent[] = [];
    for (let index = 0; index < 8; index += 1) {
      events.push({ type: 'projectileSpawned', tick: 20, projectileId: index + 1, sourceId: 1, weaponId: 'micro-missile', position: { x: 100, y: 100 }, velocity: { x: 1, y: 0 }, targetId: 2 });
      events.push({ type: 'blast', tick: 20, sourceId: 1, abilityId: 'micro-missile', kind: 'explosion', position: { x: 200 + index, y: 100 }, radius: 72, force: 8, damage: 6.5, element: 'neutral' });
      events.push({ type: 'damage', tick: 20, sourceId: 1, targetId: 2, amount: 6.5, element: 'neutral', hpAfter: 100, position: { x: 200, y: 100 } });
      events.push({ type: 'knockbackApplied', tick: 20, sourceId: 1, targetId: 2, kind: 'explosion', position: { x: 200, y: 100 }, direction: { x: 1, y: 0 }, force: 8 });
    }
    const compacted = compactMissilePresentationEvents(events);
    expect(compacted.filter((event) => event.type === 'projectileSpawned')).toHaveLength(3);
    expect(compacted.filter((event) => event.type === 'blast')).toHaveLength(1);
    expect(compacted.filter((event) => event.type === 'damage')).toHaveLength(1);
    expect(compacted.filter((event) => event.type === 'knockbackApplied')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'blast')).toHaveLength(8);
  });

  it('stages multi-rocket abilities instead of spawning every missile on one simulation tick', () => {
    const intervals = [
      ['rocket-salvo', 5],
      ['siege-marker', 5],
      ['starburst-convergence', 3]
    ] as const;
    for (const [abilityId, expectedInterval] of intervals) {
      const launch = getAbility(abilityId).triggers.flatMap((trigger) => trigger.actions).find((action) => action.type === 'LAUNCH_PROJECTILES');
      expect(launch?.type).toBe('LAUNCH_PROJECTILES');
      expect(launch?.type === 'LAUNCH_PROJECTILES' ? launch.intervalTicks : undefined).toBe(expectedInterval);
    }

    const runner = trainingBattle([
      { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 220, y: 360 },
      { fighterId: 'water-shaper', team: 2, controller: 'player', x: 760, y: 360 }
    ], 7410);
    const snapshot = runner.getSnapshot();
    const rocket = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const events = run(runner, 50, {
      type: 'activateAbility', entityId: rocket.id, slot: 'skill1', targetId: target.id, direction: { x: 1, y: 0 }
    });
    const launches = events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'rocket-salvo-missile');
    expect(launches).toHaveLength(3);
    expect(launches.map((event) => event.tick)).toEqual([launches[0]!.tick, launches[0]!.tick + 5, launches[0]!.tick + 10]);
  });

  it('bounds secondary collision presentation while a missile cascade is active', () => {
    const events: SimulationEvent[] = [];
    for (let index = 0; index < 6; index += 1) {
      events.push({ type: 'wallImpact', tick: 30, entityId: index + 1, position: { x: 100, y: 100 }, magnitude: 12 });
      events.push({ type: 'impact', tick: 30, a: index + 1, b: index + 20, position: { x: 100, y: 100 }, normal: { x: 1, y: 0 }, magnitude: 10 });
    }
    const compacted = compactMissileSecondaryPresentationEvents(events);
    expect(compacted.filter((event) => event.type === 'wallImpact')).toHaveLength(1);
    expect(compacted.filter((event) => event.type === 'impact')).toHaveLength(1);
    expect(events).toHaveLength(12);
  });

  it('channels the Solar Sentinel laser as a stationary, tracking damage ramp', () => {
    const fighter = getFighter('solar-sentinel');
    expect(fighter.primaryAttackId).toBe('solar-punch');
    expect(fighter.abilitySlots.ultimate).toBe('solar-laser');
    const laser = getAbility('solar-laser');
    expect(laser.slot).toBe('ultimate');
    expect(laser.castMovementMultiplier).toBe(0);
    expect(laser.castTicks).toBe(210);

    const runner = trainingBattle([
      { fighterId: 'solar-sentinel', team: 1, controller: 'player', x: 260, y: 330 },
      { fighterId: 'water-shaper', team: 2, controller: 'player', x: 760, y: 330 }
    ], 7416);
    const start = runner.getSnapshot();
    const sentinel = start.entities.find((entity) => entity.team === 1)!;
    const target = start.entities.find((entity) => entity.team === 2)!;
    const events: SimulationEvent[] = [];

    events.push(...runner.step([{
      type: 'activateAbility', entityId: sentinel.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 }
    }]));

    for (let tick = 0; tick < 47; tick += 1) {
      events.push(...runner.step([
        { type: 'move', entityId: sentinel.id, direction: { x: -1, y: 1 }, facing: { x: -1, y: 0 } },
        { type: 'move', entityId: target.id, direction: { x: 0, y: 1 }, facing: { x: -1, y: 0 } }
      ]));
    }
    expect(events.some((event) => event.type === 'damage' && event.sourceId === sentinel.id)).toBe(false);

    for (let tick = 47; tick < 170; tick += 1) {
      events.push(...runner.step([
        { type: 'move', entityId: sentinel.id, direction: { x: -1, y: 1 }, facing: { x: -1, y: 0 } },
        { type: 'activatePrimaryAttack', entityId: sentinel.id, targetId: target.id, direction: { x: 1, y: 0 } },
        { type: 'activateAbility', entityId: sentinel.id, slot: 'skill1', targetId: target.id, direction: { x: 1, y: 0 } },
        { type: 'move', entityId: target.id, direction: { x: 0, y: 1 }, facing: { x: -1, y: 0 } }
      ]));
    }

    const after = runner.getSnapshot();
    const afterSentinel = after.entities.find((entity) => entity.id === sentinel.id)!;
    const afterTarget = after.entities.find((entity) => entity.id === target.id)!;
    const activeLaser = afterSentinel.abilities.find((ability) => ability.abilityId === 'solar-laser')!;
    const beamDamage = events.filter((event) => event.type === 'damage' && event.sourceId === sentinel.id && event.targetId === target.id);
    const additionalStarts = events.filter((event) => event.type === 'abilityActivated' && event.entityId === sentinel.id && event.abilityId !== 'solar-laser');
    const weaponStarts = events.filter((event) => event.type === 'weaponAttackStarted' && event.entityId === sentinel.id);

    expect(afterSentinel.x).toBeCloseTo(sentinel.x, 6);
    expect(afterSentinel.y).toBeCloseTo(sentinel.y, 6);
    expect(activeLaser.phase).toBe('casting');
    expect(beamDamage.length).toBeGreaterThan(20);
    const targetDefinition = getFighter(afterTarget.fighterId);
    const fireDamageMultiplier =
      (targetDefinition.resistances.fire ?? 1)
      * getElementMultiplier('fire', targetDefinition.classification.elements);
    const hasLaserDamageStage = (rawDamage: number): boolean =>
      beamDamage.some(
        (event) => event.type === 'damage'
          && Math.abs(event.amount - rawDamage * fireDamageMultiplier) < 0.000001
      );

    expect(hasLaserDamageStage(2.2)).toBe(true);
    expect(hasLaserDamageStage(3.5)).toBe(true);
    expect(hasLaserDamageStage(5.2)).toBe(true);
    expect(additionalStarts).toHaveLength(0);
    expect(weaponStarts).toHaveLength(0);

    const expectedAngle = Math.atan2(afterTarget.y - afterSentinel.y, afterTarget.x - afterSentinel.x);
    expect(afterSentinel.rotation).toBeCloseTo(expectedAngle, 4);
  });

  it('applies centered explosion knockback, exposes a presentation event and reaches the wall', () => {
    const runner = trainingBattle([
      { fighterId: 'bomber', team: 1, controller: 'player', x: 850, y: 360 },
      { fighterId: 'water-shaper', team: 2, controller: 'player', x: 900, y: 360 }
    ]);
    const snapshot = runner.getSnapshot();
    const bomber = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const events: SimulationEvent[] = [];
    let maxTargetX = target.x;
    for (let tick = 0; tick < 150; tick += 1) {
      const commands: SimulationCommand[] = [{ type: 'stop', entityId: target.id }];
      if (tick === 0) commands.push({
        type: 'activateAbility',
        entityId: bomber.id,
        slot: 'ultimate',
        targetId: target.id,
        direction: { x: 1, y: 0 }
      });
      events.push(...runner.step(commands));
      const currentTarget = runner.getSnapshot().entities.find((entity) => entity.id === target.id);
      if (currentTarget) maxTargetX = Math.max(maxTargetX, currentTarget.x);
    }
    const knockback = events.find((event) => event.type === 'knockbackApplied' && event.targetId === target.id && event.kind === 'explosion');
    expect(knockback).toBeDefined();
    expect(knockback?.type === 'knockbackApplied' ? knockback.force : 0).toBeGreaterThan(0);
    expect(maxTargetX - target.x).toBeGreaterThan(40);
    expect(events.filter((event) => event.type === 'wallImpact' && event.entityId === target.id).length).toBeGreaterThanOrEqual(3);
  });
});
