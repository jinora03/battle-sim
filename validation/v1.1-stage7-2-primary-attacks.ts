import {
  CONTENT_VERSION,
  getFighter,
  getPrimaryAttack,
  isAttackCombinationAllowed,
  listAbilities,
  listFighters,
  listPrimaryAttacks
} from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import { migrateFighterBundle } from '@kinetic/creator';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import { getSkillPresentation } from '@kinetic/visual-engine';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trainingDuel(fighterA: string, fighterB: string, ax: number, bx: number, seed: number): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: fighterA, team: 1, controller: 'player', x: ax, y: 360 },
      { fighterId: fighterB, team: 2, controller: 'player', x: bx, y: 360 }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1_200,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  };
  return new LocalSimulationRunner(battle);
}

function run(runner: LocalSimulationRunner, ticks: number, first: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(tick === 0 ? [first] : []));
  return events;
}

assert(CONTENT_VERSION === '1.1.2-stage7.2', `Unexpected content version: ${CONTENT_VERSION}`);
for (const fighter of listFighters()) {
  assert(Boolean(fighter.primaryAttackId), `${fighter.id} has no primary attack.`);
  assert(fighter.abilitySlots.basic === undefined, `${fighter.id} still stores a separate Basic ability.`);
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  assert(isAttackCombinationAllowed(primary.form, primary.behavior), `${primary.id} uses an invalid form/behavior pair.`);
}
for (const primary of listPrimaryAttacks()) {
  assert(primary.category === primary.behavior, `${primary.id} category alias does not match behavior.`);
}
for (const ability of listAbilities()) {
  assert(getSkillPresentation(ability.id).shortName !== 'Skill', `${ability.id} is missing a dedicated skill presentation.`);
}
assert(getPrimaryAttack(getFighter('pyro-brawler').primaryAttackId).form === 'fire', 'Pyro still uses a physical sword identity.');
assert(getPrimaryAttack(getFighter('thorn-colossus').primaryAttackId).behavior === 'melee', 'Thorn Claws still spin as their normal Basic.');
assert(getPrimaryAttack(getFighter('gunner').primaryAttackId).behavior === 'automatic', 'Gunner does not use an automatic primary.');
assert(!isAttackCombinationAllowed('rifle', 'spin'), 'Rifle + Spin should be rejected.');
assert(isAttackCombinationAllowed('sword', 'spin'), 'Sword + Spin should be supported.');

const gunner = trainingDuel('gunner', 'mech-bruiser', 220, 620, 77201);
const gunnerSelf = gunner.getSnapshot().entities.find((entity) => entity.team === 1)!;
const gunnerTarget = gunner.getSnapshot().entities.find((entity) => entity.team === 2)!;
const gunnerEvents = run(gunner, 32, {
  type: 'activatePrimaryAttack', entityId: gunnerSelf.id, targetId: gunnerTarget.id, direction: { x: 1, y: 0 }
});
assert(gunnerEvents.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'automatic-rifle').length === 4, 'Gunner did not fire exactly four real projectiles.');

const pyro = trainingDuel('pyro-brawler', 'water-shaper', 240, 420, 77202);
const pyroSelf = pyro.getSnapshot().entities.find((entity) => entity.team === 1)!;
const pyroTarget = pyro.getSnapshot().entities.find((entity) => entity.team === 2)!;
const pyroDistance = Math.hypot(pyroTarget.x - pyroSelf.x, pyroTarget.y - pyroSelf.y);
assert(pyroDistance > getPrimaryAttack('flame-fists').range, 'Broad melee validation scenario is not outside raw range.');
const pyroEvents = run(pyro, 40, {
  type: 'activatePrimaryAttack', entityId: pyroSelf.id, targetId: pyroTarget.id, direction: { x: 1, y: 0 }
});
assert(pyroEvents.some((event) => event.type === 'weaponHit' && event.weaponId === 'flame-fists'), 'Broad effective melee reach failed.');

const skillOnly = trainingDuel('pyro-brawler', 'water-shaper', 240, 350, 77203);
const skillSelf = skillOnly.getSnapshot().entities.find((entity) => entity.team === 1)!;
const skillTarget = skillOnly.getSnapshot().entities.find((entity) => entity.team === 2)!;
const skillEvents = run(skillOnly, 24, {
  type: 'activateAbility', entityId: skillSelf.id, slot: 'skill1', targetId: skillTarget.id, direction: { x: 1, y: 0 }
});
assert(skillEvents.some((event) => event.type === 'abilityActivated'), 'Skill did not activate.');
assert(!skillEvents.some((event) => event.type === 'weaponAttackStarted'), 'A skill incorrectly executed the primary attack.');

const gunnerSkillRunner = new LocalSimulationRunner({
  seed: 77206,
  arenaId: 'training-grid',
  modeId: 'training',
  participants: [
    { fighterId: 'gunner', team: 1, controller: 'player', x: 240, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 540, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 140, y: 360 }
  ],
  rules: {
    friendlyFire: false,
    teamCollision: 'ghost',
    maxBattleTicks: 1_200,
    training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
  }
});
const gunnerSkillSnapshot = gunnerSkillRunner.getSnapshot();
const gunnerSkillSelf = gunnerSkillSnapshot.entities.find((entity) => entity.team === 1)!;
const forwardTarget = gunnerSkillSnapshot.entities.find((entity) => entity.team === 2 && entity.x > gunnerSkillSelf.x)!;
const behindTarget = gunnerSkillSnapshot.entities.find((entity) => entity.team === 2 && entity.x < gunnerSkillSelf.x)!;
const suppressiveEvents = run(gunnerSkillRunner, 24, {
  type: 'activateAbility', entityId: gunnerSkillSelf.id, slot: 'skill2', targetId: forwardTarget.id, direction: { x: 1, y: 0 }
});
assert(suppressiveEvents.some((event) => event.type === 'damage' && event.targetId === forwardTarget.id), 'Suppressive Fire did not damage the forward target.');
assert(!suppressiveEvents.some((event) => event.type === 'damage' && event.targetId === behindTarget.id), 'Suppressive Fire damaged a target behind the Gunner.');
assert(!suppressiveEvents.some((event) => event.type === 'weaponAttackStarted'), 'Suppressive Fire incorrectly started the Basic attack.');

const grenadeRunner = new LocalSimulationRunner({
  seed: 77207,
  arenaId: 'training-grid',
  modeId: 'training',
  participants: [
    { fighterId: 'gunner', team: 1, controller: 'player', x: 180, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 560, y: 360 },
    { fighterId: 'water-shaper', team: 2, controller: 'player', x: 700, y: 390 }
  ],
  rules: {
    friendlyFire: false,
    teamCollision: 'ghost',
    maxBattleTicks: 1_200,
    training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
  }
});
const grenadeSnapshot = grenadeRunner.getSnapshot();
const grenadeSelf = grenadeSnapshot.entities.find((entity) => entity.team === 1)!;
const grenadeTarget = grenadeSnapshot.entities.find((entity) => entity.fighterId === 'mech-bruiser')!;
const grenadeEvents = run(grenadeRunner, 28, {
  type: 'activateAbility', entityId: grenadeSelf.id, slot: 'skill3', targetId: grenadeTarget.id, direction: { x: 1, y: 0 }
});
const grenadeBlast = grenadeEvents.find((event) => event.type === 'blast' && event.abilityId === 'grenade-launcher');
assert(grenadeBlast?.type === 'blast', 'Grenade Launcher produced no target explosion.');
const grenadeDamage = grenadeEvents.find((event) => event.type === 'damage' && event.targetId === grenadeTarget.id);
assert(grenadeDamage?.type === 'damage' && grenadeDamage.position, 'Grenade Launcher did not damage its target.');
assert(Math.hypot(grenadeBlast.position.x - grenadeDamage.position!.x, grenadeBlast.position.y - grenadeDamage.position!.y) < 1, 'Grenade Launcher exploded at the wrong position.');
assert(!grenadeEvents.some((event) => event.type === 'damage' && event.targetId === grenadeSelf.id), 'Grenade Launcher exploded on the Gunner.');

const deterministic = (): string => {
  const runner = trainingDuel('gunner', 'mech-bruiser', 220, 620, 77204);
  const self = runner.getSnapshot().entities.find((entity) => entity.team === 1)!;
  const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
  run(runner, 90, { type: 'activatePrimaryAttack', entityId: self.id, targetId: target.id, direction: { x: 1, y: 0 } });
  return checksumSnapshot(runner.getSnapshot());
};
const checksum = deterministic();
assert(checksum === deterministic(), 'Primary attack scenario is not deterministic.');


const massRoster = ['pyro-brawler', 'mech-bruiser', 'water-shaper', 'bomber', 'frost-warden', 'volt-striker', 'thorn-colossus', 'void-reaper', 'gunner'];
const runMass = (): { checksum: string; elapsedMs: number; ticks: number } => {
  const participants = Array.from({ length: 40 }, (_, index) => ({
    fighterId: massRoster[index % massRoster.length]!,
    team: index < 20 ? 1 : 2,
    controller: 'ai' as const
  }));
  const runner = new LocalSimulationRunner({
    seed: 77205,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
  });
  const ai = new AiController();
  let snapshot = runner.getSnapshot();
  const started = performance.now();
  for (let tick = 0; tick < 450 && !snapshot.battleEnded; tick += 1) {
    runner.step(ai.commandsForTick(snapshot));
    snapshot = runner.getSnapshot();
  }
  return { checksum: checksumSnapshot(snapshot), elapsedMs: performance.now() - started, ticks: snapshot.tick };
};
const firstMass = runMass();
const secondMass = runMass();
assert(firstMass.checksum === secondMass.checksum, '20v20 primary-attack battle is not deterministic.');

const legacy = {
  schemaVersion: 1,
  fighter: {
    id: 'legacy-stage7-2-check', name: 'Legacy Check',
    classification: { archetype: 'test', elements: ['electric'], traits: ['custom'] },
    physics: { radius: 25, mass: 1, restitution: 0.9, linearDamping: 0.99, maxSpeed: 10 },
    stats: { maxHp: 100, moveAcceleration: 0.2 }, aiProfileId: 'ranged-gunner',
    abilitySlots: { basic: 'static-strike', skill1: 'combat-roll', skill2: 'suppressive-fire', skill3: 'grenade-launcher', ultimate: 'overdrive-barrage' },
    resistances: {}, visualRecipeId: 'legacy-visual', animationRecipeId: 'gunner-mobile', audioProfileId: 'legacy', weaponId: 'arc-rifle'
  },
  visualRecipe: { id: 'legacy-visual', shape: 'orb', bodyColor: 1, bodyDarkColor: 2, coreColor: 3, auraColor: 4, accentColor: 5, weapon: 'rifle', horns: false },
  motionRecipe: { id: 'gunner-mobile', speedStretch: 0, impactSquash: 0, lean: 0, pulseAmount: 0, pulseSpeed: 0, weaponSpin: 0 }
};
const migration = migrateFighterBundle(legacy);
const migrated = migration.value as { fighter: { primaryAttackId: string; abilitySlots: Record<string, unknown> }; visualRecipe: Record<string, unknown> };
assert(migration.migrated, 'Legacy fighter bundle was not migrated.');
assert(migrated.fighter.primaryAttackId === 'arc-emitter', 'Legacy rifle did not migrate to Arc Emitter.');
assert(migrated.fighter.abilitySlots.basic === undefined, 'Legacy Basic was not removed.');
assert(migrated.visualRecipe.weapon === undefined, 'Legacy display weapon was not removed.');

console.log(JSON.stringify({
  contentVersion: CONTENT_VERSION,
  fighters: listFighters().length,
  primaryAttacks: listPrimaryAttacks().length,
  gunnerShots: gunnerEvents.filter((event) => event.type === 'projectileSpawned').length,
  deterministicChecksum: checksum,
  massChecksum: firstMass.checksum,
  massTicks: firstMass.ticks,
  massMillisecondsPerTick: Number((firstMass.elapsedMs / Math.max(1, firstMass.ticks)).toFixed(3))
}, null, 2));
