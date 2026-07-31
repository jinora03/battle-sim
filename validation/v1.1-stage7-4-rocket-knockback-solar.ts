import { CONTENT_VERSION, getAbility, getFighter, getPrimaryAttack } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { compactMissilePresentationEvents } from '../packages/renderer-pixi/src/combatFeedback';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trainingBattle(participants: BattleDefinition['participants'], seed: number): LocalSimulationRunner {
  return new LocalSimulationRunner({
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 2_000,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  });
}

assert(CONTENT_VERSION === '1.1.6-stage7.5', `Unexpected content version: ${CONTENT_VERSION}`);
assert(getPrimaryAttack('automatic-rifle').damage === 3.4, 'Gunner damage changed.');
assert(getFighter('solar-sentinel').abilitySlots.ultimate === 'solar-laser', 'Solar Sentinel is missing the laser ultimate.');
assert(getAbility('solar-laser').castTicks === 210 && getAbility('solar-laser').castMovementMultiplier === 0, 'Solar laser channel configuration is invalid.');

const presentationInput: SimulationEvent[] = [];
for (let index = 0; index < 8; index += 1) {
  presentationInput.push({ type: 'projectileSpawned', tick: 5, projectileId: index + 1, sourceId: 1, weaponId: 'micro-missile', position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, targetId: 2 });
  presentationInput.push({ type: 'blast', tick: 5, sourceId: 1, abilityId: 'micro-missile', kind: 'explosion', position: { x: index, y: 0 }, radius: 72, force: 8, damage: 6.5, element: 'neutral' });
}
const compacted = compactMissilePresentationEvents(presentationInput);
assert(compacted.filter((event) => event.type === 'projectileSpawned').length === 3, 'Missile launches were not compacted to three.');
assert(compacted.filter((event) => event.type === 'blast').length === 1, 'Missile blasts were not combined to one presentation event.');

const rocketRunner = trainingBattle([
  { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 220, y: 360 },
  { fighterId: 'water-shaper', team: 2, controller: 'player', x: 760, y: 360 }
], 7414);
const rocketStart = rocketRunner.getSnapshot();
const rocketFighter = rocketStart.entities.find((entity) => entity.team === 1)!;
const rocketTarget = rocketStart.entities.find((entity) => entity.team === 2)!;
const rocketEvents: SimulationEvent[] = [];
for (let tick = 0; tick < 50; tick += 1) {
  const commands: SimulationCommand[] = [];
  if (tick === 0) commands.push({ type: 'activateAbility', entityId: rocketFighter.id, slot: 'skill1', targetId: rocketTarget.id, direction: { x: 1, y: 0 } });
  rocketEvents.push(...rocketRunner.step(commands));
}
const salvoLaunchTicks = rocketEvents
  .filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'rocket-salvo-missile')
  .map((event) => event.tick);
assert(salvoLaunchTicks.length === 3, `Expected three salvo launches, received ${salvoLaunchTicks.length}.`);
assert(salvoLaunchTicks[1] === salvoLaunchTicks[0]! + 5 && salvoLaunchTicks[2] === salvoLaunchTicks[0]! + 10, `Salvo was not staged: ${salvoLaunchTicks.join(', ')}.`);

const solarRunner = trainingBattle([
  { fighterId: 'solar-sentinel', team: 1, controller: 'player', x: 260, y: 330 },
  { fighterId: 'water-shaper', team: 2, controller: 'player', x: 760, y: 330 }
], 7416);
const solarStart = solarRunner.getSnapshot();
const solar = solarStart.entities.find((entity) => entity.team === 1)!;
const solarTarget = solarStart.entities.find((entity) => entity.team === 2)!;
const solarEvents: SimulationEvent[] = [];
solarEvents.push(...solarRunner.step([{ type: 'activateAbility', entityId: solar.id, slot: 'ultimate', targetId: solarTarget.id, direction: { x: 1, y: 0 } }]));
for (let tick = 0; tick < 170; tick += 1) {
  solarEvents.push(...solarRunner.step([
    { type: 'move', entityId: solar.id, direction: { x: -1, y: 1 }, facing: { x: -1, y: 0 } },
    { type: 'activatePrimaryAttack', entityId: solar.id, targetId: solarTarget.id, direction: { x: 1, y: 0 } },
    { type: 'move', entityId: solarTarget.id, direction: { x: 0, y: 1 }, facing: { x: -1, y: 0 } }
  ]));
}
const solarAfter = solarRunner.getSnapshot().entities.find((entity) => entity.id === solar.id)!;
const solarDamage = solarEvents.filter((event) => event.type === 'damage' && event.sourceId === solar.id);
assert(Math.abs(solarAfter.x - solar.x) < 0.000001 && Math.abs(solarAfter.y - solar.y) < 0.000001, 'Solar Sentinel moved during the laser channel.');
assert(solarDamage.length > 20, `Solar laser produced only ${solarDamage.length} damage pulses.`);
assert(solarDamage.some((event) => event.type === 'damage' && event.amount === 5.2), 'Solar laser did not reach its final damage ramp.');

const runner = trainingBattle([
  { fighterId: 'bomber', team: 1, controller: 'player', x: 510, y: 360 },
  { fighterId: 'water-shaper', team: 2, controller: 'player', x: 590, y: 360 }
], 7415);
const start = runner.getSnapshot();
const bomber = start.entities.find((entity) => entity.team === 1)!;
const target = start.entities.find((entity) => entity.team === 2)!;
const events: SimulationEvent[] = [];
for (let tick = 0; tick < 220; tick += 1) {
  const commands: SimulationCommand[] = [{ type: 'stop', entityId: target.id }];
  if (tick === 0) commands.push({ type: 'activateAbility', entityId: bomber.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 } });
  events.push(...runner.step(commands));
}
const wallBounces = events.filter((event) => event.type === 'wallImpact' && event.entityId === target.id).length;
assert(wallBounces >= 3, `Mega Bomb produced only ${wallBounces} wall bounces.`);

console.log(JSON.stringify({
  contentVersion: CONTENT_VERSION,
  gunnerDamage: getPrimaryAttack('automatic-rifle').damage,
  missilePresentationBlasts: compacted.filter((event) => event.type === 'blast').length,
  stagedSalvoLaunchTicks: salvoLaunchTicks,
  megaBombWallBounces: wallBounces,
  solarUltimate: getFighter('solar-sentinel').abilitySlots.ultimate,
  solarDamagePulses: solarDamage.length
}, null, 2));
