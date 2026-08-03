import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getAiProfile,
  getFighter,
  getPassive,
  getPrimaryAttack,
  getStatus,
  listCompatibleModules,
  resolveFighterLoadout,
  type ArenaDefinition
} from '@kinetic/content';
import { selectAbilityAction } from '@kinetic/controllers';
import type {
  BattleDefinition,
  EntityId,
  EntitySnapshot,
  SimulationCommand,
  SimulationEvent,
  SimulationMetricsSnapshot,
  WorldSnapshot
} from '@kinetic/protocol';
import {
  checksumSnapshot,
  LocalSimulationRunner,
  SeededRng,
  SpatialHashGrid,
  World
} from '@kinetic/simulation';
import { getSkillPresentation } from '@kinetic/visual-engine';
import { ArenaCollisionSystem } from '../packages/simulation/src/systems/ArenaCollisionSystem';
import { ProjectileSystem } from '../packages/simulation/src/systems/ProjectileSystem';
import type { ExternalImpulseState } from '../packages/simulation/src/systems/SimulationSystemTypes';

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (tick: number) => SimulationCommand[] = () => []
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks && !runner.getSnapshot().battleEnded; tick += 1) {
    events.push(...runner.step(commandsForTick(tick)));
  }
  return events;
}

function ballastTraining(moduleIds: string[] = [], targetX = 650): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8421,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'ballast', team: 1, controller: 'player', x: 400, y: 470, loadout: { moduleIds } },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: targetX, y: 470 }
    ],
    rules: {
      maxBattleTicks: 1800,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: false,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

const stop = (entityId: number): SimulationCommand => ({ type: 'stop', entityId });

function entity(snapshot: WorldSnapshot, id: number): EntitySnapshot {
  return snapshot.entities.find((candidate) => candidate.id === id)!;
}

function statusStacks(snapshot: WorldSnapshot, id: number, statusId: string): number {
  return entity(snapshot, id).statuses.find((status) => status.statusId === statusId)?.stacks ?? 0;
}

function primaryCommand(runner: LocalSimulationRunner): SimulationCommand {
  const snapshot = runner.getSnapshot();
  const self = entity(snapshot, 0);
  const target = entity(snapshot, 1);
  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    type: 'activatePrimaryAttack',
    entityId: 0,
    targetId: 1,
    direction: { x: dx / length, y: dy / length }
  };
}

function abilityCommand(
  slot: 'skill1' | 'skill2' | 'skill3' | 'ultimate',
  targetId: number | undefined = 1
): SimulationCommand {
  return {
    type: 'activateAbility',
    entityId: 0,
    slot,
    ...(targetId !== undefined ? { targetId } : {}),
    direction: { x: 1, y: 0 }
  };
}

const RICOCHET_ARENA: ArenaDefinition = {
  id: 'stage8-4b-ricochet-box',
  name: 'Stage 8.4B Ricochet Box',
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

function ballastRicochets(moduleIds: string[]): number {
  const world = new World(4);
  const sourceId = world.spawn(
    { fighterId: 'ballast', team: 1, controller: 'player', loadout: { moduleIds } },
    90,
    60,
    new SeededRng(8422)
  );
  const externalImpulse = new Map<EntityId, ExternalImpulseState>();
  const spatial = new SpatialHashGrid(
    RICOCHET_ARENA.width,
    RICOCHET_ARENA.height,
    RICOCHET_ARENA.spatialCellSize
  );
  spatial.rebuild(world.activeIdsView(), (id) => world.x[id] ?? 0, (id) => world.y[id] ?? 0);
  const arenaCollisions = new ArenaCollisionSystem(
    world,
    RICOCHET_ARENA,
    externalImpulse,
    { getTick: () => 0, dealDamage: () => undefined }
  );
  let tick = 0;
  const currentMetrics = metrics();
  const projectiles = new ProjectileSystem(
    world,
    RICOCHET_ARENA,
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
  projectiles.spawn(sourceId, getPrimaryAttack('skip-stone'), { x: -1, y: 0 }, []);
  for (tick = 0; tick < 112; tick += 1) projectiles.update([]);
  return projectiles.states()[0]!.wallBounces;
}

describe('Stage 8.4B full Ballast fighter', () => {
  it('registers the complete mass-control kit and presentation', () => {
    const ballast = getFighter('ballast');
    expect(ballast).toMatchObject({
      name: 'Ballast',
      aiProfileId: 'ballast-mass-controller',
      passiveIds: ['house-rules'],
      primaryAttackId: 'skip-stone'
    });
    expect(getPassive('house-rules').name).toBe('House Rules');
    expect(getPrimaryAttack('skip-stone')).toMatchObject({
      behavior: 'ranged',
      name: 'Skip Stone',
      onHitStatuses: [{ statusId: 'featherlight', durationTicks: 250, stacks: 1 }],
      projectile: { bounce: 0.96, maxWallBounces: 3 }
    });
    expect(getAbility(ballast.abilitySlots.skill1!)).toMatchObject({ id: 'featherfall', name: 'Featherfall' });
    expect(getAbility(ballast.abilitySlots.skill2!)).toMatchObject({ id: 'downbeat', name: 'Downbeat' });
    expect(getAbility(ballast.abilitySlots.skill3!)).toMatchObject({ id: 'dead-weight', name: 'Dead Weight' });
    expect(getAbility(ballast.abilitySlots.ultimate!)).toMatchObject({ id: 'last-call', name: 'Last Call' });
    expect(getSkillPresentation('featherfall').shortName).toBe('Featherfall');
    expect(getSkillPresentation('downbeat').shortName).toBe('Downbeat');
    expect(getSkillPresentation('dead-weight').shortName).toBe('Dead Weight');
    expect(getSkillPresentation('last-call')).toMatchObject({ shortName: 'Last Call', importance: 'ultimate' });
  });

  it('uses Skip Stone to stack Featherlight and trigger House Rules on prepared targets', () => {
    const runner = ballastTraining();
    const first = runTicks(runner, 70, (tick) => tick === 0 ? [primaryCommand(runner), stop(1)] : [stop(1)]);
    expect(first.some((event) => event.type === 'weaponHit' && event.weaponId === 'skip-stone')).toBe(true);
    expect(statusStacks(runner.getSnapshot(), 1, 'featherlight')).toBe(1);

    const second = runTicks(runner, 70, (tick) => tick === 0 ? [primaryCommand(runner), stop(1)] : [stop(1)]);
    expect(second.some((event) => event.type === 'weaponHit' && event.weaponId === 'skip-stone')).toBe(true);
    expect(statusStacks(runner.getSnapshot(), 1, 'featherlight')).toBe(2);
    expect(second.some((event) => event.type === 'passiveTriggered' && event.passiveId === 'house-rules')).toBe(true);
  });

  it('makes Featherfall a non-damaging setup pulse that lightens and gathers multiple enemies', () => {
    const battle: BattleDefinition = {
      seed: 8423,
      arenaId: 'iron-pit',
      modeId: 'battle-royale',
      participants: [
        { fighterId: 'ballast', team: 1, controller: 'player', x: 400, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 610, y: 470 },
        { fighterId: 'water-shaper', team: 3, controller: 'player', x: 400, y: 680 }
      ],
      rules: {
        maxBattleTicks: 900,
        training: {
          enabled: true,
          damageEnabled: false,
          cooldownsEnabled: false,
          invulnerableTeams: [1, 2, 3],
          suppressVictory: true
        }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const before = runner.getSnapshot();
    const distanceBefore = Math.hypot(entity(before, 2).x - entity(before, 0).x, entity(before, 2).y - entity(before, 0).y);
    const events = runTicks(runner, 32, (tick) => tick === 0
      ? [abilityCommand('skill1'), stop(1), stop(2)]
      : [stop(1), stop(2)]);
    const after = runner.getSnapshot();
    const distanceAfter = Math.hypot(entity(after, 2).x - entity(after, 0).x, entity(after, 2).y - entity(after, 0).y);
    expect(statusStacks(after, 1, 'featherlight')).toBe(2);
    expect(statusStacks(after, 2, 'featherlight')).toBe(2);
    expect(distanceAfter).toBeLessThan(distanceBefore);
    expect(events.some((event) => event.type === 'damage' && event.sourceId === 0)).toBe(false);
  });

  it('uses Downbeat as the prepared-target launch payoff', () => {
    const runner = ballastTraining([], 620);
    runTicks(runner, 32, (tick) => tick === 0 ? [abilityCommand('skill1'), stop(1)] : [stop(1)]);
    const beforeX = entity(runner.getSnapshot(), 1).x;
    const events = runTicks(runner, 20, (tick) => tick === 0 ? [abilityCommand('skill2'), stop(1)] : [stop(1)]);
    const after = entity(runner.getSnapshot(), 1);
    expect(events.some((event) => event.type === 'abilityResolved' && event.abilityId === 'downbeat')).toBe(true);
    const targetKnockbacks = events.filter(
      (event) => event.type === 'knockbackApplied' && event.targetId === 1
    );
    expect(targetKnockbacks.length).toBeGreaterThanOrEqual(2);
    expect(events.some(
      (event) => event.type === 'knockbackApplied'
        && event.targetId === 1
        && event.force >= 19
    )).toBe(true);
    expect(after.x).toBeGreaterThan(beforeX);
  });

  it('anchors Ballast with Dead Weight and makes Last Call flip the arena mass state', () => {
    const battle: BattleDefinition = {
      seed: 8424,
      arenaId: 'iron-pit',
      modeId: 'battle-royale',
      participants: [
        { fighterId: 'ballast', team: 1, controller: 'player', x: 400, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 600, y: 470 },
        { fighterId: 'water-shaper', team: 3, controller: 'player', x: 400, y: 650 }
      ],
      rules: {
        maxBattleTicks: 1000,
        training: {
          enabled: true,
          damageEnabled: false,
          cooldownsEnabled: false,
          invulnerableTeams: [1, 2, 3],
          suppressVictory: true
        }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const deadWeightEvents = runTicks(runner, 36, (tick) => tick === 0
      ? [abilityCommand('skill3', undefined), stop(1), stop(2)]
      : [stop(1), stop(2)]);
    expect(deadWeightEvents.some((event) => event.type === 'abilityResolved' && event.abilityId === 'dead-weight')).toBe(true);
    expect(statusStacks(runner.getSnapshot(), 0, 'anchored')).toBe(1);

    const lastCallEvents = runTicks(runner, 64, (tick) => tick === 0
      ? [abilityCommand('ultimate'), stop(1), stop(2)]
      : [stop(1), stop(2)]);
    const snapshot = runner.getSnapshot();
    expect(lastCallEvents.some((event) => event.type === 'blast' && event.abilityId === 'last-call')).toBe(true);
    expect(statusStacks(snapshot, 0, 'last-call')).toBe(1);
    expect(statusStacks(snapshot, 0, 'anchored')).toBe(1);
    expect(statusStacks(snapshot, 1, 'featherlight')).toBe(3);
    expect(statusStacks(snapshot, 2, 'featherlight')).toBe(3);
  });

  it('registers six modules and lets Polished Stone extend the native ricochet budget', () => {
    const ballast = getFighter('ballast');
    expect(listCompatibleModules(ballast).map((module) => module.id)).toEqual([
      'polished-stone',
      'loaded-shaker',
      'floor-bolts',
      'rolling-service',
      'gravity-caddy',
      'closing-time'
    ]);
    const resolved = resolveFighterLoadout(ballast, {
      moduleIds: ['polished-stone', 'floor-bolts', 'rolling-service', 'gravity-caddy']
    });
    expect(resolved.primaryProjectileMaxWallBounces).toBe(2);
    expect(resolved.incomingKnockbackMultiplier).toBe(0.72);
    expect(resolved.statusDurationMultiplier.anchored).toBe(1.3);
    expect(resolved.primaryCooldownMultiplier).toBe(0.9);
    expect(resolved.periodicStatusPulses[0]).toMatchObject({ statusId: 'featherlight', intervalTicks: 150 });
    expect(ballastRicochets([])).toBe(3);
    expect(ballastRicochets(['polished-stone'])).toBe(5);
  });

  it('makes the generic AI prime Featherlight before choosing Downbeat', () => {
    const runner = ballastTraining();
    const snapshot = runner.getSnapshot();
    const self = entity(snapshot, 0);
    const target = entity(snapshot, 1);
    const profile = getAiProfile('ballast-mass-controller');

    const unprimed = selectAbilityAction(snapshot, self, target, profile);
    expect(unprimed.selected).toMatchObject({ kind: 'ability', slot: 'skill1', abilityId: 'featherfall' });
    expect(unprimed.debug.candidates.find((candidate) => candidate.slot === 'skill2')).toMatchObject({
      valid: false,
      reason: 'needs 2 featherlight stacks'
    });

    const primedTarget: EntitySnapshot = {
      ...target,
      statuses: [...target.statuses, { statusId: 'featherlight', remainingTicks: 180, stacks: 3 }]
    };
    const primedSnapshot: WorldSnapshot = { ...snapshot, entities: [self, primedTarget] };
    const primed = selectAbilityAction(primedSnapshot, self, primedTarget, profile);
    expect(primed.selected).toMatchObject({ kind: 'ability', slot: 'skill2', abilityId: 'downbeat' });
  });

  it('keeps the complete setup, launch and ultimate sequence deterministic', () => {
    const execute = () => {
      const runner = ballastTraining(['loaded-shaker', 'floor-bolts', 'gravity-caddy'], 620);
      const events: SimulationEvent[] = [];
      events.push(...runTicks(runner, 70, (tick) => tick === 0 ? [primaryCommand(runner), stop(1)] : [stop(1)]));
      events.push(...runTicks(runner, 32, (tick) => tick === 0 ? [abilityCommand('skill1'), stop(1)] : [stop(1)]));
      events.push(...runTicks(runner, 20, (tick) => tick === 0 ? [abilityCommand('skill2'), stop(1)] : [stop(1)]));
      events.push(...runTicks(runner, 64, (tick) => tick === 0 ? [abilityCommand('ultimate'), stop(1)] : [stop(1)]));
      return {
        checksum: checksumSnapshot(runner.getSnapshot()),
        events,
        snapshot: runner.getSnapshot()
      };
    };
    expect(execute()).toEqual(execute());
  });

  it('keeps the deployed mass status definitions intact', () => {
    expect(getStatus('featherlight')).toMatchObject({ maxStacks: 3, massMultiplierPerStack: 0.63 });
    expect(getStatus('anchored')).toMatchObject({ massMultiplier: 3.2, speedMultiplier: 0.72 });
    expect(getStatus('last-call')).toMatchObject({ maxStacks: 1, speedMultiplier: 1.06 });
  });
});
