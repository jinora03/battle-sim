import { describe, expect, it } from 'vitest';
import {
  getStatus,
  resolveStatusMassMultiplier,
  type ArenaDefinition,
  type SkillProjectileDefinition
} from '@kinetic/content';
import type {
  EntityId,
  SimulationEvent,
  SimulationMetricsSnapshot
} from '@kinetic/protocol';
import { SeededRng, SpatialHashGrid, World } from '@kinetic/simulation';
import { ArenaCollisionSystem } from '../packages/simulation/src/systems/ArenaCollisionSystem';
import { KnockbackSystem } from '../packages/simulation/src/systems/KnockbackSystem';
import { ProjectileSystem } from '../packages/simulation/src/systems/ProjectileSystem';
import type { ExternalImpulseState } from '../packages/simulation/src/systems/SimulationSystemTypes';

function spawnPlayer(world: World, x = 90, y = 60): EntityId {
  return world.spawn(
    { fighterId: 'gunner', team: 1, controller: 'player' },
    x,
    y,
    new SeededRng(8401)
  );
}

function knockbackVelocity(statusId?: 'featherlight' | 'anchored', stacks = 1): number {
  const world = new World(4);
  const target = spawnPlayer(world, 100, 100);
  if (statusId) world.applyStatus(target, statusId, 120, null, stacks);
  const externalImpulse = new Map<EntityId, ExternalImpulseState>();
  const system = new KnockbackSystem(world, externalImpulse, () => 0);
  system.applyKnockbackFromPoint(
    undefined,
    { x: 0, y: 100 },
    target,
    12,
    [],
    'ability'
  );
  return world.vx[target] ?? 0;
}

const TEST_ARENA: ArenaDefinition = {
  id: 'stage8-4a-ricochet-box',
  name: 'Stage 8.4A Ricochet Box',
  size: 'tiny',
  theme: 'iron',
  width: 180,
  height: 120,
  spatialCellSize: 60,
  recommendedUnits: { min: 1, max: 2 },
  allowedModes: ['training'],
  spawnZones: [],
  obstacles: [],
  zones: []
};

function metrics(): SimulationMetricsSnapshot {
  return {
    activeEntities: 1,
    commandsProcessed: 0,
    candidatePairs: 0,
    contactsResolved: 0,
    sameTeamContacts: 0,
    occupiedBroadphaseCells: 0,
    maxBroadphaseBucket: 0,
    projectileEntityChecks: 0,
    projectileObstacleChecks: 0,
    invalidNumericStates: 0
  };
}

function runRicochet(maxWallBounces?: number) {
  const world = new World(4);
  const sourceId = spawnPlayer(world);
  const externalImpulse = new Map<EntityId, ExternalImpulseState>();
  const spatial = new SpatialHashGrid(
    TEST_ARENA.width,
    TEST_ARENA.height,
    TEST_ARENA.spatialCellSize
  );
  spatial.rebuild(world.activeIdsView(), (id) => world.x[id] ?? 0, (id) => world.y[id] ?? 0);
  const arenaCollisions = new ArenaCollisionSystem(
    world,
    TEST_ARENA,
    externalImpulse,
    { getTick: () => 0, dealDamage: () => undefined }
  );
  let tick = 0;
  const currentMetrics = metrics();
  const projectiles = new ProjectileSystem(
    world,
    TEST_ARENA,
    spatial,
    arenaCollisions,
    {
      getTick: () => tick,
      getMetrics: () => currentMetrics,
      getMaxEntityRadius: () => 50,
      primaryElement: () => 'void',
      dealDamage: () => undefined,
      applyKnockback: () => undefined,
      applyKnockbackFromPoint: () => undefined,
      applyStatus: () => undefined,
      triggerPrimaryHitPassive: () => undefined,
      damageScaledImpulse: (value) => value,
      explosionImpulseOptions: () => ({})
    }
  );
  const projectile: SkillProjectileDefinition = {
    id: `stage8-4a-test-stone-${maxWallBounces ?? 'legacy'}`,
    name: 'Test Stone',
    form: 'void',
    behavior: 'ranged',
    damage: 0,
    knockback: 0,
    friendlyFire: false,
    visualId: 'void-orb',
    audioId: 'void-shot',
    projectile: {
      speed: 30,
      radius: 4,
      lifetimeTicks: 240,
      fuseTicks: 0,
      gravity: 0,
      bounce: 0.9,
      ...(maxWallBounces !== undefined ? { maxWallBounces } : {}),
      explosionRadius: 0,
      explosionDamage: 0,
      explosionImpulse: 0
    }
  };
  const events: SimulationEvent[] = [];
  projectiles.spawn(sourceId, projectile, { x: -1, y: 0 }, events);
  for (tick = 0; tick < 48; tick += 1) projectiles.update(events);
  return projectiles.states()[0]!;
}

describe('Stage 8.4A mass-manipulation foundation', () => {
  it('registers stack-scaled Featherlight and fixed Anchored status definitions', () => {
    const featherlight = getStatus('featherlight');
    const anchored = getStatus('anchored');

    expect(featherlight).toMatchObject({
      maxStacks: 3,
      massMultiplierPerStack: 0.63,
      massPresentation: 'light'
    });
    expect(resolveStatusMassMultiplier(featherlight, 3)).toBeCloseTo(0.250047, 6);
    expect(anchored).toMatchObject({
      massMultiplier: 3.2,
      massPresentation: 'heavy'
    });
  });

  it('scales effective mass per Featherlight stack and restores base mass after removal', () => {
    const world = new World(4);
    const target = spawnPlayer(world, 100, 100);
    const baseMass = world.mass[target] ?? 1;

    world.applyStatus(target, 'featherlight', 120, null, 1);
    expect(world.getEffectiveMass(target)).toBeCloseTo(baseMass * 0.63, 8);
    world.applyStatus(target, 'featherlight', 120, null, 1);
    expect(world.getEffectiveMass(target)).toBeCloseTo(baseMass * 0.63 * 0.63, 8);
    world.applyStatus(target, 'featherlight', 120, null, 1);
    expect(world.getEffectiveMass(target)).toBeCloseTo(baseMass * 0.63 * 0.63 * 0.63, 8);

    world.removeStatus(target, 'featherlight');
    expect(world.getEffectiveMass(target)).toBeCloseTo(baseMass, 8);
    world.applyStatus(target, 'anchored', 120, null);
    expect(world.getEffectiveMass(target)).toBeCloseTo(baseMass * 3.2, 8);
  });

  it('makes the same impulse launch light targets farther and anchored targets less', () => {
    const standard = knockbackVelocity();
    const lightOne = knockbackVelocity('featherlight', 1);
    const lightThree = knockbackVelocity('featherlight', 3);
    const heavy = knockbackVelocity('anchored');

    expect(lightOne).toBeGreaterThan(standard);
    expect(lightThree).toBeGreaterThan(lightOne);
    expect(heavy).toBeLessThan(standard);
    expect(knockbackVelocity('featherlight', 3)).toBe(lightThree);
  });

  it('limits native projectile ricochets without changing legacy unlimited bounce behavior', () => {
    const finite = runRicochet(2);
    const legacy = runRicochet();

    expect(finite.wallBounces).toBe(2);
    expect(finite.alive).toBe(false);
    expect(legacy.wallBounces).toBeGreaterThan(2);
    expect(legacy.alive).toBe(true);
  });
});
