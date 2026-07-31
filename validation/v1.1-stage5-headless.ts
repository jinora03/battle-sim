import type { AbilitySlot, BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trainingBattle(overrides: Partial<BattleDefinition> = {}): BattleDefinition {
  return {
    seed: 515151,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'volt-striker', team: 1, controller: 'player', x: 245, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'replay', x: 745, y: 360, statScale: { hp: 2.5 } }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      training: {
        enabled: true,
        damageEnabled: true,
        cooldownsEnabled: true,
        invulnerableTeams: [2],
        suppressVictory: true
      }
    },
    ...overrides
  };
}

function fireUntilDamage(runner: LocalSimulationRunner, slot: AbilitySlot = 'basic', maxTicks = 160): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let index = 0; index < maxTicks; index += 1) {
    const snapshot = runner.getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1);
    const target = snapshot.entities.find((entity) => entity.team === 2);
    const commands: SimulationCommand[] = [];
    if (index === 0 && self && target) {
      commands.push({ type: 'activateAbility', entityId: self.id, slot, targetId: target.id, direction: { x: 1, y: 0 } });
    }
    events.push(...runner.step(commands));
    if (events.some((event) => event.type === 'damage')) break;
  }
  return events;
}

const invulnerable = new LocalSimulationRunner(trainingBattle());
const targetBefore = invulnerable.getSnapshot().entities.find((entity) => entity.team === 2)!;
const invulnerableEvents = fireUntilDamage(invulnerable);
const preventedDamage = invulnerableEvents.find((event) => event.type === 'damage');
const targetAfter = invulnerable.getSnapshot().entities.find((entity) => entity.team === 2)!;
assert(preventedDamage?.type === 'damage', 'Invulnerable target did not receive a damage report');
assert(preventedDamage.prevented === true, 'Invulnerable damage was not marked prevented');
assert(preventedDamage.amount > 0, 'Calculated damage was not positive');
assert(preventedDamage.position !== undefined, 'Damage position was not reported');
assert(targetAfter.hp === targetBefore.hp, 'Invulnerable target lost HP');
assert(targetAfter.statuses.some((status) => status.statusId === 'shocked'), 'Status application was not visible in snapshot');

const damageOff = new LocalSimulationRunner(trainingBattle());
damageOff.setTrainingRules({ damageEnabled: false, invulnerableTeams: [] });
const damageOffBefore = damageOff.getSnapshot().entities.find((entity) => entity.team === 2)!.hp;
const damageOffEvents = fireUntilDamage(damageOff);
const damageOffEvent = damageOffEvents.find((event) => event.type === 'damage');
const damageOffAfter = damageOff.getSnapshot().entities.find((entity) => entity.team === 2)!.hp;
assert(damageOffEvent?.type === 'damage' && damageOffEvent.prevented === true, 'Damage-off event was not prevented');
assert(damageOffAfter === damageOffBefore, 'Damage-off toggle reduced HP');

const noCooldowns = new LocalSimulationRunner(trainingBattle());
noCooldowns.setTrainingRules({ cooldownsEnabled: false });
let activations = 0;
for (let tick = 0; tick < 45; tick += 1) {
  const snapshot = noCooldowns.getSnapshot();
  const self = snapshot.entities.find((entity) => entity.team === 1)!;
  const target = snapshot.entities.find((entity) => entity.team === 2)!;
  const events = noCooldowns.step([{ type: 'activateAbility', entityId: self.id, slot: 'basic', targetId: target.id, direction: { x: 1, y: 0 } }]);
  activations += events.filter((event) => event.type === 'abilityActivated').length;
}
const basic = noCooldowns.getSnapshot().entities.find((entity) => entity.team === 1)!.abilities.find((ability) => ability.slot === 'basic')!;
assert(activations >= 2, 'Cooldown-off mode did not permit repeated activations');
assert(basic.cooldownRemainingTicks === 0, 'Cooldown remained after cooldowns were disabled');

const victorySuppressed = new LocalSimulationRunner(trainingBattle({
  participants: [
    { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 245, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'replay', x: 330, y: 360, statScale: { hp: 0.04 } }
  ],
  rules: {
    friendlyFire: false,
    teamCollision: 'ghost',
    training: { enabled: true, damageEnabled: true, cooldownsEnabled: false, invulnerableTeams: [], suppressVictory: true }
  }
}));
fireUntilDamage(victorySuppressed, 'basic', 100);
for (let index = 0; index < 15; index += 1) victorySuppressed.step([]);
const victorySnapshot = victorySuppressed.getSnapshot();
assert(!victorySnapshot.entities.some((entity) => entity.team === 2), 'Defeated training dummy remained active');
assert(victorySnapshot.battleEnded === false, 'Training battle ended despite victory suppression');
assert(victorySnapshot.result === null, 'Training battle created a result despite victory suppression');

function deterministicRun(): string {
  const runner = new LocalSimulationRunner(trainingBattle());
  fireUntilDamage(runner);
  for (let index = 0; index < 25; index += 1) runner.step([]);
  return checksumSnapshot(runner.getSnapshot());
}
const checksumA = deterministicRun();
const checksumB = deterministicRun();
assert(checksumA === checksumB, 'Same-seed training scenario diverged');

console.log(JSON.stringify({
  stage: 'v1.1-stage5',
  preventedDamage: {
    amount: preventedDamage.amount,
    hpUnchanged: targetAfter.hp === targetBefore.hp,
    statusApplied: targetAfter.statuses.some((status) => status.statusId === 'shocked')
  },
  damageToggle: { hpUnchanged: damageOffAfter === damageOffBefore },
  cooldownToggle: { activations, cooldownRemainingTicks: basic.cooldownRemainingTicks },
  victorySuppression: { battleEnded: victorySnapshot.battleEnded, remainingTargets: victorySnapshot.entities.filter((entity) => entity.team === 2).length },
  deterministic: { checksum: checksumA, repeated: checksumA === checksumB }
}, null, 2));
