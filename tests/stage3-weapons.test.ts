import { describe, expect, it } from 'vitest';
import { getPrimaryAttack, listPrimaryAttacks } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function runTicks(runner: LocalSimulationRunner, ticks: number, commandsForTick: (tick: number) => SimulationCommand[] = () => []): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks && !runner.getSnapshot().battleEnded; tick += 1) events.push(...runner.step(commandsForTick(tick)));
  return events;
}

function duel(fighterAId: string, fighterBId: string, ax: number, bx: number, seed = 1301): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterAId, team: 1, controller: 'player', x: ax, y: 470 },
      { fighterId: fighterBId, team: 2, controller: 'player', x: bx, y: 470 }
    ],
    rules: { maxBattleTicks: 900 }
  };
  return new LocalSimulationRunner(battle);
}

const primary = (entityId = 0, targetId = 1): SimulationCommand => ({
  type: 'activatePrimaryAttack', entityId, targetId, direction: { x: 1, y: 0 }
});

describe('v1.1 primary attack system', () => {
  it('registers reusable physical, elemental and behavioral combinations', () => {
    const behaviors = new Set(listPrimaryAttacks().map((attack) => attack.behavior));
    for (const behavior of ['melee', 'ranged', 'throwable', 'automatic', 'spin', 'slam'] as const) {
      expect(behaviors.has(behavior)).toBe(true);
    }
  });

  it('does not start an AI melee attack outside its configured effective range', () => {
    // Range/angle/line-of-sight gating is AI-only: player fighters fire their
    // Basic on demand, so this guard is verified against an AI attacker.
    const battle: BattleDefinition = {
      seed: 1302,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'pyro-brawler', team: 1, controller: 'ai', x: 120, y: 470 },
        { fighterId: 'water-shaper', team: 2, controller: 'ai', x: 690, y: 470 }
      ],
      rules: { maxBattleTicks: 900 }
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runner.step([primary()]);
    expect(events.some((event) => event.type === 'weaponAttackStarted')).toBe(false);
  });

  it('lets a player fire the Basic on demand even outside effective range', () => {
    const runner = duel('pyro-brawler', 'water-shaper', 120, 690, 1302);
    const events = runner.step([primary()]);
    expect(events.some((event) => event.type === 'weaponAttackStarted')).toBe(true);
  });

  it('runs visible melee wind-up, active hit and recovery inside range', () => {
    const runner = duel('pyro-brawler', 'water-shaper', 300, 420, 1303);
    let sawWindup = false;
    let sawActive = false;
    let sawRecovery = false;
    const events = runTicks(runner, 90, (tick) => {
      const snapshot = runner.getSnapshot();
      const attack = snapshot.entities.find((entity) => entity.id === 0)?.weaponAttack;
      sawWindup ||= attack?.phase === 'windup';
      sawActive ||= attack?.phase === 'active';
      sawRecovery ||= attack?.phase === 'recovery';
      return tick === 0 ? [primary()] : [];
    });
    expect(events.some((event) => event.type === 'weaponAttackStarted' && event.weaponId === 'flame-fists')).toBe(true);
    expect(events.some((event) => event.type === 'weaponHit' && event.weaponId === 'flame-fists' && event.targetId === 1)).toBe(true);
    expect(sawWindup).toBe(true);
    expect(sawActive).toBe(true);
    expect(sawRecovery).toBe(true);
  });

  it('creates a real projectile for an elemental ranged primary attack', () => {
    const runner = duel('volt-striker', 'water-shaper', 190, 520, 1304);
    const events = runTicks(runner, 80, (tick) => tick === 0 ? [primary()] : []);
    expect(events.some((event) => event.type === 'projectileSpawned' && event.weaponId === 'arc-emitter')).toBe(true);
    expect(events.some((event) => event.type === 'projectileImpact' && event.weaponId === 'arc-emitter')).toBe(true);
  });

  it('makes Bomber throw an actual bomb projectile before it explodes', () => {
    const runner = duel('bomber', 'water-shaper', 190, 470, 1305);
    const events = runTicks(runner, 160, (tick) => tick === 0 ? [primary()] : []);
    const spawnIndex = events.findIndex((event) => event.type === 'projectileSpawned' && event.weaponId === 'demolition-bomb');
    const impactIndex = events.findIndex((event) => event.type === 'projectileImpact' && event.weaponId === 'demolition-bomb');
    const blastIndex = events.findIndex((event) => event.type === 'blast' && event.abilityId === 'demolition-bomb');
    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(impactIndex).toBeGreaterThan(spawnIndex);
    expect(blastIndex).toBeGreaterThanOrEqual(impactIndex);
  });

  it('keeps projectile and primary-attack state deterministic for the same seed and commands', () => {
    const execute = () => {
      const runner = duel('bomber', 'water-shaper', 190, 470, 1306);
      runTicks(runner, 180, (tick) => tick === 0 ? [primary()] : []);
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(execute()).toBe(execute());
    expect(getPrimaryAttack('demolition-bomb').behavior).toBe('throwable');
  });
});
