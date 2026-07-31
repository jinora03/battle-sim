import { AiController } from '@kinetic/controllers';
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

function passiveContact() {
  const battle: BattleDefinition = { seed: 1201, arenaId: 'iron-pit', modeId: 'duel', participants: [
    { fighterId: 'water-shaper', team: 1, controller: 'player', x: 330, y: 470 },
    { fighterId: 'bomber', team: 2, controller: 'player', x: 385, y: 470 }
  ] };
  const runner = new LocalSimulationRunner(battle);
  const initial = runner.getSnapshot().entities.map((entity) => entity.hp);
  const events = runTicks(runner, 90, () => [
    { type: 'move', entityId: 0, direction: { x: 1, y: 0 } },
    { type: 'move', entityId: 1, direction: { x: -1, y: 0 } }
  ]);
  assert(events.some((event) => event.type === 'impact'), 'Expected physical contact');
  assert(!events.some((event) => event.type === 'damage'), 'Ordinary body contact caused damage');
  assert(JSON.stringify(initial) === JSON.stringify(runner.getSnapshot().entities.map((entity) => entity.hp)), 'HP changed from passive contact');
  return { impacts: events.filter((event) => event.type === 'impact').length, checksum: checksumSnapshot(runner.getSnapshot()) };
}

function explicitRam() {
  const battle: BattleDefinition = { seed: 1202, arenaId: 'iron-pit', modeId: 'duel', participants: [
    { fighterId: 'thorn-colossus', team: 1, controller: 'player', x: 280, y: 470 },
    { fighterId: 'water-shaper', team: 2, controller: 'player', x: 400, y: 470 }
  ] };
  const runner = new LocalSimulationRunner(battle);
  const events = runTicks(runner, 180, (tick) => {
    const commands: SimulationCommand[] = [
      tick < 24 ? { type: 'stop', entityId: 0 } : { type: 'move', entityId: 0, direction: { x: 1, y: 0 } },
      { type: 'stop', entityId: 1 }
    ];
    if (tick === 0) commands.push({ type: 'activateAbility', entityId: 0, slot: 'skill1', targetId: 1, direction: { x: 1, y: 0 } });
    return commands;
  });
  assert(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'bramble-charge'), 'Ram never activated');
  assert(events.some((event) => event.type === 'damage' && event.sourceId === 0 && event.targetId === 1), 'Explicit ram did not damage target');
  return { damageEvents: events.filter((event) => event.type === 'damage').length, checksum: checksumSnapshot(runner.getSnapshot()) };
}

function validationRules() {
  const blocked = new LocalSimulationRunner({ seed: 12031, arenaId: 'pillar-court', modeId: 'duel', participants: [
    { fighterId: 'thorn-colossus', team: 1, controller: 'player', x: 308, y: 370 },
    { fighterId: 'water-shaper', team: 2, controller: 'player', x: 432, y: 370 }
  ] });
  const blockedEvents = blocked.step([{ type: 'activateAbility', entityId: 0, slot: 'skill1', targetId: 1, direction: { x: 1, y: 0 } }]);
  assert(!blockedEvents.some((event) => event.type === 'abilityActivated'), 'Line-of-sight validation accepted a blocked skill');

  const cooldown = new LocalSimulationRunner({ seed: 12032, arenaId: 'iron-pit', modeId: 'duel', participants: [
    { fighterId: 'mech-bruiser', team: 1, controller: 'player', x: 260, y: 470 },
    { fighterId: 'bomber', team: 2, controller: 'player', x: 500, y: 470 }
  ] });
  const cooldownEvents = runTicks(cooldown, 90, () => [{ type: 'activateAbility', entityId: 0, slot: 'skill3' }]);
  const fortifyStarts = cooldownEvents.filter((event) => event.type === 'abilityActivated' && event.entityId === 0 && event.abilityId === 'fortify').length;
  assert(fortifyStarts === 1, `Cooldown accepted ${fortifyStarts} Fortify activations`);
  return { blockedLineOfSight: true, fortifyStarts };
}

function stableResult() {
  const battle: BattleDefinition = { seed: 1204, arenaId: 'iron-pit', modeId: 'duel', participants: [
    { fighterId: 'bomber', team: 1, controller: 'player', x: 300, y: 470, statScale: { damage: 3 } },
    { fighterId: 'water-shaper', team: 2, controller: 'player', x: 410, y: 470, statScale: { hp: 0.08 } }
  ], rules: { maxBattleTicks: 300 } };
  const runner = new LocalSimulationRunner(battle);
  const events = runTicks(runner, 180, (tick) => tick === 0 ? [{ type: 'activateAbility', entityId: 0, slot: 'ultimate', targetId: 1, direction: { x: 1, y: 0 } }] : []);
  const snapshot = runner.getSnapshot();
  assert(events.some((event) => event.type === 'battleEnded'), 'Battle did not end');
  assert(snapshot.result?.winningTeam === 1, 'Expected Team 1 winner');
  assert(snapshot.entities.every((entity) => entity.vx === 0 && entity.vy === 0), 'Winner was not stabilized');
  assert(runner.step([{ type: 'move', entityId: 0, direction: { x: 1, y: 0 } }]).length === 0, 'Ended battle accepted commands');
  return { result: snapshot.result, checksum: checksumSnapshot(snapshot) };
}

function deterministicAi(seed: number) {
  const battle: BattleDefinition = { seed, arenaId: 'pillar-court', modeId: 'duel', participants: [
    { fighterId: 'mech-bruiser', team: 1 }, { fighterId: 'bomber', team: 2 }
  ], rules: { maxBattleTicks: 900 } };
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let maxAbilityCommands = 0;
  for (let tick = 0; tick < 700 && !runner.getSnapshot().battleEnded; tick += 1) {
    const snapshot = runner.getSnapshot();
    const commands = ai.commandsForTick(snapshot);
    for (const entity of snapshot.entities) maxAbilityCommands = Math.max(maxAbilityCommands, commands.filter((command) => command.entityId === entity.id && command.type === 'activateAbility').length);
    runner.step(commands);
  }
  assert(maxAbilityCommands <= 1, 'AI issued multiple competing skill commands in one tick');
  assert(ai.getDecisionDebug().length > 0, 'AI debug decisions are missing');
  return { checksum: checksumSnapshot(runner.getSnapshot()), tick: runner.tick, maxAbilityCommands };
}

const first = deterministicAi(1205);
const second = deterministicAi(1205);
assert(first.checksum === second.checksum, 'Same-seed AI diverged');
console.log(JSON.stringify({ stage: 'v1.1-stage2', passiveContact: passiveContact(), explicitRam: explicitRam(), validationRules: validationRules(), stableResult: stableResult(), ai: first }));
