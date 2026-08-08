import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

interface RunResult {
  checksum: string;
  tick: number;
  events: SimulationEvent[];
  snapshot: ReturnType<LocalSimulationRunner['getSnapshot']>;
}

function runBattle(battle: BattleDefinition, maxTicks = 3000): RunResult {
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  const events: SimulationEvent[] = [];
  for (let index = 0; index < maxTicks && !runner.getSnapshot().battleEnded; index += 1) {
    const before = runner.getSnapshot();
    events.push(...runner.step(ai.commandsForTick(before)));
  }
  const snapshot = runner.getSnapshot();
  return { checksum: checksumSnapshot(snapshot), tick: snapshot.tick, events, snapshot };
}

const foundryBattle: BattleDefinition = {
  seed: 778811,
  arenaId: 'elemental-foundry',
  modeId: 'team-battle',
  participants: [
    { fighterId: 'water-shaper', team: 1 },
    { fighterId: 'water-shaper', team: 1 },
    { fighterId: 'pyro-brawler', team: 1 },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'mech-bruiser', team: 2 }
  ]
};

describe('Phase 0.7 arenas and game modes', () => {
  it('repeats environmental battles deterministically', () => {
    const first = runBattle(foundryBattle);
    const second = runBattle(foundryBattle);

    expect(second.checksum).toBe(first.checksum);
    expect(second.tick).toBe(first.tick);
    expect(first.events.some((event) => event.type === 'zoneEntered')).toBe(true);
    expect(first.events.some((event) => event.type === 'hazardTriggered')).toBe(true);
    expect(first.events.some((event) => event.type === 'obstacleImpact')).toBe(true);
    expect(first.events.some((event) => event.type === 'obstacleDestroyed')).toBe(true);
  }, 20_000);

  it('publishes mutable obstacle state in snapshots', () => {
    const result = runBattle(foundryBattle);
    expect(result.snapshot.obstacles).toHaveLength(3);
    expect(result.snapshot.obstacles.some((obstacle) => obstacle.destructible)).toBe(true);
    expect(result.snapshot.obstacles.some((obstacle) => !obstacle.alive || obstacle.hp < obstacle.maxHp)).toBe(true);
  });

  it('represents a boss raid through mode data and participant scaling', () => {
    const result = runBattle({
      seed: 9917,
      arenaId: 'pillar-court',
      modeId: 'boss-raid',
      participants: [
        { fighterId: 'water-shaper', team: 1 },
        { fighterId: 'pyro-brawler', team: 1 },
        {
          fighterId: 'bomber',
          team: 2,
          statScale: { hp: 4.5, radius: 1.65, mass: 3.2, damage: 1.65, speed: 0.86 }
        }
      ]
    }, 3600);

    const boss = result.snapshot.entities.find((entity) => entity.team === 2);
    expect(result.snapshot.objective.kind).toBe('boss');
    expect(boss?.maxHp).toBeGreaterThan(500);
    expect(boss?.radius).toBeGreaterThan(40);
  });

  it('exposes survival progress as a battle objective', () => {
    const runner = new LocalSimulationRunner({
      seed: 5501,
      arenaId: 'elemental-foundry',
      modeId: 'survival',
      participants: [
        { fighterId: 'water-shaper', team: 1, statScale: { hp: 1.35 } },
        { fighterId: 'bomber', team: 2 },
        { fighterId: 'pyro-brawler', team: 2 }
      ]
    });

    const before = runner.getSnapshot();
    for (let tick = 0; tick < 120 && !runner.getSnapshot().battleEnded; tick += 1) runner.step([]);
    const after = runner.getSnapshot();

    expect(before.objective.kind).toBe('survival');
    expect(after.objective.progress).toBeGreaterThan(before.objective.progress);
    expect(after.objective.remainingTicks).toBe(2700 - after.tick);
  });

  it('rejects incompatible arena and mode combinations', () => {
    expect(() => new LocalSimulationRunner({
      seed: 1,
      arenaId: 'iron-pit',
      modeId: 'team-battle',
      participants: [
        { fighterId: 'water-shaper', team: 1 },
        { fighterId: 'pyro-brawler', team: 1 },
        { fighterId: 'bomber', team: 2 },
        { fighterId: 'mech-bruiser', team: 2 }
      ]
    })).toThrow(/not allowed/i);
  });
});
