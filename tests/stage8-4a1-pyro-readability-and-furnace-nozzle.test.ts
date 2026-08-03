import { describe, expect, it } from 'vitest';
import {
  getAiProfile,
  getFighter,
  resolveFighterLoadout
} from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import type {
  BattleDefinition,
  MoveCommand,
  SimulationCommand,
  SimulationEvent
} from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

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

function aiDuel(targetX: number): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8411,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'ai', x: 400, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: targetX, y: 470 }
    ],
    rules: {
      maxBattleTicks: 900,
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

function aiMove(runner: LocalSimulationRunner): MoveCommand {
  const command = new AiController(false)
    .commandsForTick(runner.getSnapshot())
    .find((candidate): candidate is MoveCommand => candidate.type === 'move' && candidate.entityId === 0);
  if (!command) throw new Error('Pyro AI did not emit a movement command');
  return command;
}

function flamethrowerBattle(): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8412,
    arenaId: 'iron-pit',
    modeId: 'battle-royale',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 350, y: 470, loadout: { moduleIds: ['furnace-nozzle'] } },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 570, y: 470 },
      { fighterId: 'water-shaper', team: 3, controller: 'player', x: 590, y: 490 },
      { fighterId: 'gunner', team: 4, controller: 'player', x: 410, y: 720 }
    ],
    rules: {
      maxBattleTicks: 900,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: false,
        invulnerableTeams: [1, 2, 3, 4],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

function stopAll(): SimulationCommand[] {
  return [0, 1, 2, 3].map((entityId) => ({ type: 'stop', entityId }));
}

function burnStacks(runner: LocalSimulationRunner, entityId: number): number {
  return runner.getSnapshot().entities
    .find((entity) => entity.id === entityId)
    ?.statuses.find((status) => status.statusId === 'burn')
    ?.stacks ?? 0;
}

describe('Stage 8.4A.1 Pyro readability and Furnace Nozzle', () => {
  it('gives Pyro a dedicated orbit profile and restrains Cinder Rush to real engages', () => {
    const pyro = getFighter('pyro-brawler');
    expect(pyro.aiProfileId).toBe('pyro-combo-bruiser');
    const profile = getAiProfile('pyro-combo-bruiser');
    expect(profile).toMatchObject({
      movementStyle: 'orbit',
      preferredDistance: 230,
      aggression: 0.88,
      orbitStrength: 0.34
    });
    expect(profile.abilityUsage.find((rule) => rule.slot === 'skill1')).toMatchObject({
      minDistance: 240,
      maxDistance: 520,
      priority: 5
    });
  });

  it('orbits at Flame Jet range, backs away up close, and holds its lane while firing', () => {
    const lane = aiMove(aiDuel(595));
    expect(Math.abs(lane.direction.x)).toBeLessThan(0.2);
    expect(Math.abs(lane.direction.y)).toBeGreaterThan(0.8);

    const crowded = aiMove(aiDuel(520));
    expect(crowded.direction.x).toBeLessThan(-0.6);

    const approaching = aiDuel(625);
    const before = aiMove(approaching);
    expect(before.direction.x).toBeGreaterThan(0.45);
    approaching.step([
      { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } },
      { type: 'stop', entityId: 1 }
    ]);
    const committed = aiMove(approaching);
    expect(Math.abs(committed.direction.x)).toBeLessThan(0.2);
    expect(Math.abs(committed.direction.y)).toBeGreaterThan(0.8);
  });

  it('resolves Furnace Nozzle as a visible cone-channel primary conversion', () => {
    const pyro = getFighter('pyro-brawler');
    const baseline = resolveFighterLoadout(pyro);
    const nozzle = resolveFighterLoadout(pyro, { moduleIds: ['furnace-nozzle'] });
    expect(baseline.primaryConeChannel).toBeNull();
    expect(nozzle.moduleIds).toEqual(['furnace-nozzle']);
    expect(nozzle.primaryConeChannel).toEqual({
      activeTicks: 72,
      hitIntervalTicks: 6,
      statusIntervalHits: 3,
      rangeMultiplier: 0.95,
      angleDegrees: 36,
      damageMultiplier: 0.68,
      knockbackMultiplier: 0.22,
      movementMultiplier: 0.72
    });
    expect(nozzle.mountedAttachments.map((attachment) => attachment.id)).toEqual([
      'pyro-furnace-nozzle',
      'pyro-furnace-tank'
    ]);
    expect(() => resolveFighterLoadout(pyro, { moduleIds: ['accelerant-nozzle', 'furnace-nozzle'] }))
      .toThrow(/only one offense module/i);
  });

  it('channels a projectile-free cone, hits every target inside it and applies Burn periodically', () => {
    const runner = flamethrowerBattle();
    const events = runTicks(runner, 90, (tick) => tick === 0
      ? [
          { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } },
          ...stopAll()
        ]
      : stopAll());

    expect(events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'flame-fists')).toHaveLength(0);
    const flameHits = events.filter((event) => event.type === 'weaponHit' && event.weaponId === 'flame-fists');
    expect(flameHits.every((event) => event.type === 'weaponHit' && event.presentation === 'continuous')).toBe(true);
    expect(flameHits.filter((event) => event.type === 'weaponHit' && event.targetId === 1)).toHaveLength(12);
    expect(flameHits.filter((event) => event.type === 'weaponHit' && event.targetId === 2)).toHaveLength(12);
    expect(flameHits.some((event) => event.type === 'weaponHit' && event.targetId === 3)).toBe(false);
    expect(burnStacks(runner, 1)).toBe(4);
    expect(burnStacks(runner, 2)).toBe(4);
    expect(burnStacks(runner, 3)).toBe(0);
  });

  it('keeps the Furnace Nozzle channel deterministic', () => {
    const execute = () => {
      const runner = flamethrowerBattle();
      const events = runTicks(runner, 90, (tick) => tick === 0
        ? [
            { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } },
            ...stopAll()
          ]
        : stopAll());
      return {
        checksum: checksumSnapshot(runner.getSnapshot()),
        hits: events.filter((event) => event.type === 'weaponHit' && event.weaponId === 'flame-fists')
          .map((event) => event.type === 'weaponHit' ? [event.tick, event.targetId, event.damage] : null)
      };
    };
    expect(execute()).toEqual(execute());
  });
});
