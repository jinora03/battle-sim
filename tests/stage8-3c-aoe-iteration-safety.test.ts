import { describe, expect, it } from 'vitest';
import type {
  AbilitySlot,
  BattleDefinition,
  SimulationCommand,
  SimulationEvent,
  WorldSnapshot
} from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

const ENEMY_IDS = [1, 2, 3] as const;

function ability(slot: AbilitySlot, targetId?: number): SimulationCommand {
  return {
    type: 'activateAbility',
    entityId: 0,
    slot,
    ...(targetId !== undefined ? { targetId } : {}),
    direction: { x: 1, y: 0 }
  };
}

function stopEnemies(): SimulationCommand[] {
  return ENEMY_IDS.map((entityId) => ({ type: 'stop', entityId }));
}

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (tick: number) => SimulationCommand[]
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    events.push(...runner.step(commandsForTick(tick)));
  }
  return events;
}

function lowHpEnemy(fighterId: string, team: number, x: number, y: number) {
  return {
    fighterId,
    team,
    controller: 'player' as const,
    x,
    y,
    statScale: { hp: 0.01, radius: 0.2 }
  };
}

function trainingBattle(
  seed: number,
  enemies: BattleDefinition['participants']
): BattleDefinition {
  return {
    seed,
    arenaId: 'iron-pit',
    modeId: 'battle-royale',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 360, y: 470 },
      ...enemies
    ],
    rules: {
      maxBattleTicks: 300,
      training: {
        enabled: true,
        damageEnabled: true,
        cooldownsEnabled: false,
        invulnerableTeams: [],
        suppressVictory: true
      }
    }
  };
}

function deathIds(events: readonly SimulationEvent[]): number[] {
  return events
    .filter((event): event is Extract<SimulationEvent, { type: 'death' }> => event.type === 'death')
    .map((event) => event.entityId)
    .sort((a, b) => a - b);
}

function damageCounts(events: readonly SimulationEvent[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== 0 || !ENEMY_IDS.includes(event.targetId as 1 | 2 | 3)) {
      continue;
    }
    counts.set(event.targetId, (counts.get(event.targetId) ?? 0) + 1);
  }
  return counts;
}

function survivingEnemyIds(snapshot: WorldSnapshot): number[] {
  return snapshot.entities
    .filter((entity) => ENEMY_IDS.includes(entity.id as 1 | 2 | 3))
    .map((entity) => entity.id)
    .sort((a, b) => a - b);
}

describe('Stage 8.3C lethal AoE iteration safety', () => {
  it('applies Meltdown lethal radial damage to every eligible target exactly once', () => {
    const battle = trainingBattle(83301, [
      lowHpEnemy('mech-bruiser', 2, 470, 470),
      lowHpEnemy('water-shaper', 3, 360, 610),
      lowHpEnemy('gunner', 4, 245, 470)
    ]);
    const run = () => {
      const runner = new LocalSimulationRunner(battle);
      const events = runTicks(runner, 60, (tick) => [
        ...(tick === 0 ? [ability('ultimate', 1)] : []),
        ...stopEnemies()
      ]);
      return { runner, events, checksum: checksumSnapshot(runner.getSnapshot()) };
    };

    const first = run();
    const second = run();
    const counts = damageCounts(first.events);

    expect(deathIds(first.events)).toEqual([...ENEMY_IDS]);
    expect(survivingEnemyIds(first.runner.getSnapshot())).toEqual([]);
    expect(ENEMY_IDS.map((id) => counts.get(id) ?? 0)).toEqual([1, 1, 1]);
    expect(deathIds(second.events)).toEqual([...ENEMY_IDS]);
    expect(second.checksum).toBe(first.checksum);
  });

  it('keeps target-centered Fire Vortex iteration stable when its selected target dies first', () => {
    const battle = trainingBattle(83302, [
      lowHpEnemy('mech-bruiser', 2, 500, 470),
      lowHpEnemy('water-shaper', 3, 500, 590),
      lowHpEnemy('gunner', 4, 500, 350)
    ]);
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 30, (tick) => [
      ...(tick === 0 ? [ability('skill2', 1)] : []),
      ...stopEnemies()
    ]);
    const counts = damageCounts(events);

    expect(deathIds(events)).toEqual([...ENEMY_IDS]);
    expect(survivingEnemyIds(runner.getSnapshot())).toEqual([]);
    expect(ENEMY_IDS.map((id) => counts.get(id) ?? 0)).toEqual([1, 1, 1]);
  });

  it('applies Cinder Rush lethal cone damage to every target in the cone', () => {
    const battle = trainingBattle(83303, [
      lowHpEnemy('mech-bruiser', 2, 470, 470),
      lowHpEnemy('water-shaper', 3, 455, 535),
      lowHpEnemy('gunner', 4, 455, 405)
    ]);
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 18, (tick) => [
      ...(tick === 0 ? [ability('skill1')] : []),
      ...stopEnemies()
    ]);
    const counts = damageCounts(events);

    expect(deathIds(events)).toEqual([...ENEMY_IDS]);
    expect(survivingEnemyIds(runner.getSnapshot())).toEqual([]);
    expect(ENEMY_IDS.map((id) => counts.get(id) ?? 0)).toEqual([1, 1, 1]);
  });
});
