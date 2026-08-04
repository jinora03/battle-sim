import { describe, expect, it } from 'vitest';
import {
  CONTENT_VERSION,
  getAbility,
  getProjectileSource,
  getStatus
} from '@kinetic/content';
import type {
  BattleDefinition,
  MoveCommand,
  ProjectileSpawnedEvent,
  SimulationCommand,
  SimulationEvent
} from '@kinetic/protocol';
import { checksumSnapshot, ENGINE_VERSION, LocalSimulationRunner } from '@kinetic/simulation';

function trainingBattle(): BattleDefinition {
  return {
    seed: 8520,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 170, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 650, y: 470 }
    ],
    rules: {
      maxBattleTicks: 900,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
}

function move(entityId: number, x: number, y: number): MoveCommand {
  return { type: 'move', entityId, direction: { x, y } };
}

function runTrackedKillZone(): { spawns: ProjectileSpawnedEvent[]; checksum: string } {
  const runner = new LocalSimulationRunner(trainingBattle());
  const spawns: ProjectileSpawnedEvent[] = [];
  let firstRoundLaunched = false;

  for (let tick = 0; tick < 100; tick += 1) {
    const commands: SimulationCommand[] = tick === 0
      ? [
          { type: 'activateAbility', entityId: 0, slot: 'ultimate', targetId: 1, direction: { x: 1, y: 0 } },
          move(1, 0, 0)
        ]
      : [move(1, 0, firstRoundLaunched ? 1 : 0)];
    const events = runner.step(commands);
    for (const event of events) {
      if (event.type === 'projectileSpawned' && event.weaponId === 'kill-zone-round') {
        spawns.push(event);
      }
    }
    if (spawns.length > 0) firstRoundLaunched = true;
  }

  return { spawns, checksum: checksumSnapshot(runner.getSnapshot()) };
}

function runSuppressiveBurst(): { events: SimulationEvent[]; checksum: string; suppressed: boolean } {
  const runner = new LocalSimulationRunner(trainingBattle());
  const events: SimulationEvent[] = [];

  for (let tick = 0; tick < 80; tick += 1) {
    const commands: SimulationCommand[] = tick === 0
      ? [
          { type: 'activateAbility', entityId: 0, slot: 'skill2', targetId: 1, direction: { x: 1, y: 0 } },
          { type: 'stop', entityId: 1 }
        ]
      : [{ type: 'stop', entityId: 1 }];
    events.push(...runner.step(commands));
  }

  const target = runner.getSnapshot().entities.find((entity) => entity.id === 1);
  return {
    events,
    checksum: checksumSnapshot(runner.getSnapshot()),
    suppressed: target?.statuses.some((status) => status.statusId === 'suppressed') ?? false
  };
}

describe('Stage 8.5C Gunner functionality correction', () => {
  it('fires Kill Zone as one straight tracked gatling lane instead of a precomputed fan', () => {
    const ability = getAbility('kill-zone');
    const launch = ability.triggers[0]?.actions.find((action) => action.type === 'LAUNCH_PROJECTILES');
    expect(launch).toMatchObject({
      type: 'LAUNCH_PROJECTILES',
      projectileId: 'kill-zone-round',
      count: 24,
      pattern: 'forward',
      spreadDegrees: 0,
      intervalTicks: 2,
      retargetEachLaunch: true
    });

    const round = getProjectileSource('kill-zone-round');
    expect(round.projectile?.homingStrength ?? 0).toBe(0);
    expect(round.statusInteraction?.homingStrengthPerStack ?? 0).toBe(0);
  });

  it('re-aims later gatling rounds at a moving target without bending bullets already launched', () => {
    const first = runTrackedKillZone();
    const second = runTrackedKillZone();

    expect(first.spawns).toHaveLength(24);
    expect(first.spawns.at(-1)!.velocity.y).toBeGreaterThan(first.spawns[0]!.velocity.y + 0.5);
    expect(first.checksum).toBe(second.checksum);
  });

  it('turns Suppressive Burst into a reliable tracked six-round firing lane', () => {
    const ability = getAbility('suppressive-fire');
    const launch = ability.triggers[0]?.actions.find((action) => action.type === 'LAUNCH_PROJECTILES');
    expect(launch).toMatchObject({
      type: 'LAUNCH_PROJECTILES',
      projectileId: 'suppressive-round',
      count: 6,
      pattern: 'forward',
      spreadDegrees: 0,
      intervalTicks: 2,
      retargetEachLaunch: true
    });
    expect(getStatus('suppressed').speedMultiplier).toBe(0.7);

    const first = runSuppressiveBurst();
    const second = runSuppressiveBurst();
    expect(first.events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'suppressive-round')).toHaveLength(6);
    expect(first.events.filter((event) => event.type === 'weaponHit' && event.weaponId === 'suppressive-round').length).toBeGreaterThanOrEqual(5);
    expect(first.suppressed).toBe(true);
    expect(first.checksum).toBe(second.checksum);
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
