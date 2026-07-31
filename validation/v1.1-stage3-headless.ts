import { listWeapons } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runTicks(runner: LocalSimulationRunner, ticks: number, commandsForTick: (tick: number) => SimulationCommand[] = () => []): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks && !runner.getSnapshot().battleEnded; tick += 1) events.push(...runner.step(commandsForTick(tick)));
  return events;
}

function makeBattle(fighterAId: string, fighterBId: string, ax: number, bx: number, seed: number): BattleDefinition {
  return { seed, arenaId: 'iron-pit', modeId: 'duel', participants: [
    { fighterId: fighterAId, team: 1, controller: 'player', x: ax, y: 470 },
    { fighterId: fighterBId, team: 2, controller: 'player', x: bx, y: 470 }
  ], rules: { maxBattleTicks: 900 } };
}

function weaponRun(fighterAId: string, fighterBId: string, ax: number, bx: number, seed: number, ticks: number) {
  const runner = new LocalSimulationRunner(makeBattle(fighterAId, fighterBId, ax, bx, seed));
  let windup = false;
  let active = false;
  let recovery = false;
  const events = runTicks(runner, ticks, (tick) => {
    const attack = runner.getSnapshot().entities.find((entity) => entity.id === 0)?.weaponAttack;
    windup ||= attack?.phase === 'windup';
    active ||= attack?.phase === 'active';
    recovery ||= attack?.phase === 'recovery';
    return tick === 0 ? [{ type: 'activateAbility', entityId: 0, slot: 'basic', targetId: 1, direction: { x: 1, y: 0 } }] : [];
  });
  return { runner, events, windup, active, recovery, checksum: checksumSnapshot(runner.getSnapshot()) };
}

const categories = new Set(listWeapons().map((weapon) => weapon.category));
for (const category of ['melee', 'ranged', 'throwable', 'continuous']) assert(categories.has(category as never), `Missing ${category} weapon category`);

const melee = weaponRun('pyro-brawler', 'water-shaper', 300, 385, 2301, 90);
assert(melee.events.some((event) => event.type === 'weaponHit' && event.weaponId === 'ember-sword'), 'Melee weapon did not hit');
assert(melee.windup && melee.active && melee.recovery, 'Melee phases were not exposed');

const outOfRange = weaponRun('pyro-brawler', 'water-shaper', 120, 690, 2302, 20);
assert(!outOfRange.events.some((event) => event.type === 'weaponAttackStarted'), 'Out-of-range melee attack started');

const rifle = weaponRun('volt-striker', 'water-shaper', 190, 520, 2303, 80);
assert(rifle.events.some((event) => event.type === 'projectileSpawned' && event.weaponId === 'arc-rifle'), 'Rifle did not spawn projectile');
assert(rifle.events.some((event) => event.type === 'projectileImpact' && event.weaponId === 'arc-rifle'), 'Rifle projectile did not impact');

const bomb = weaponRun('bomber', 'water-shaper', 190, 470, 2304, 160);
const bombSpawn = bomb.events.findIndex((event) => event.type === 'projectileSpawned' && event.weaponId === 'demolition-bomb');
const bombImpact = bomb.events.findIndex((event) => event.type === 'projectileImpact' && event.weaponId === 'demolition-bomb');
const bombBlast = bomb.events.findIndex((event) => event.type === 'blast' && event.abilityId === 'demolition-bomb');
assert(bombSpawn >= 0 && bombImpact > bombSpawn && bombBlast >= bombImpact, 'Bomber did not throw then detonate a real projectile');

const bombRepeat = weaponRun('bomber', 'water-shaper', 190, 470, 2304, 160);
assert(bomb.checksum === bombRepeat.checksum, 'Same-seed weapon simulation diverged');

console.log(JSON.stringify({
  stage: 'v1.1-stage3',
  weaponCategories: [...categories].sort(),
  melee: { checksum: melee.checksum, phases: { windup: melee.windup, active: melee.active, recovery: melee.recovery }, hits: melee.events.filter((event) => event.type === 'weaponHit').length },
  outOfRangeRejected: true,
  ranged: { checksum: rifle.checksum, spawned: rifle.events.filter((event) => event.type === 'projectileSpawned').length, impacts: rifle.events.filter((event) => event.type === 'projectileImpact').length },
  bomber: { checksum: bomb.checksum, spawned: bombSpawn >= 0, impacted: bombImpact >= 0, exploded: bombBlast >= 0 }
}));
