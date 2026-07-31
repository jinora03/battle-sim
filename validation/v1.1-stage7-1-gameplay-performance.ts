import {
  getAbilityActivationProfile,
  getFighter,
  getWeapon,
  listWeapons
} from '@kinetic/content';
import { AiController, PlayerController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import { getVisualRecipe, resolveVfxQuality } from '@kinetic/visual-engine';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createMassBattle(seed: number, teamSize = 50): BattleDefinition {
  const teamOne = ['gunner', 'water-shaper', 'pyro-brawler', 'volt-striker', 'thorn-colossus'];
  const teamTwo = ['gunner', 'bomber', 'mech-bruiser', 'frost-warden', 'void-reaper'];
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < teamSize; index += 1) {
    participants.push({ fighterId: teamOne[index % teamOne.length]!, team: 1, controller: 'ai' });
    participants.push({ fighterId: teamTwo[index % teamTwo.length]!, team: 2, controller: 'ai' });
  }
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'soft',
      teamCollisionScale: 0.2,
      collisionDamageCooldownTicks: 12,
      maxBattleTicks: 1_800
    }
  };
}

function runMassBattle(seed: number, ticks = 300) {
  const runner = new LocalSimulationRunner(createMassBattle(seed));
  const ai = new AiController();
  let snapshot = runner.getSnapshot();
  let basicActivations = 0;
  let skillActivations = 0;
  let projectileSpawns = 0;
  let maxProjectiles = 0;
  const started = performance.now();

  for (let index = 0; index < ticks && !snapshot.battleEnded; index += 1) {
    const events = runner.step(ai.commandsForTick(snapshot));
    for (const event of events) {
      if (event.type === 'abilityActivated') {
        if (event.slot === 'basic') basicActivations += 1;
        else skillActivations += 1;
      } else if (event.type === 'projectileSpawned') projectileSpawns += 1;
    }
    snapshot = runner.getSnapshot();
    maxProjectiles = Math.max(maxProjectiles, snapshot.projectiles.length);
    assert(snapshot.metrics.invalidNumericStates === 0, 'Large battle produced invalid numeric state.');
  }
  const elapsedMs = performance.now() - started;
  return {
    snapshot,
    checksum: checksumSnapshot(snapshot),
    elapsedMs,
    msPerTick: elapsedMs / Math.max(1, snapshot.tick),
    basicActivations,
    skillActivations,
    projectileSpawns,
    maxProjectiles
  };
}

function validateAutomaticBurst(): number {
  const battle: BattleDefinition = {
    seed: 711,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 250, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 660, y: 360 }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 600,
      training: { enabled: true, suppressVictory: true }
    }
  };
  const runner = new LocalSimulationRunner(battle);
  const [self, target] = runner.getSnapshot().entities;
  assert(self && target, 'Training fighters did not spawn.');
  let spawned = 0;
  for (let tick = 0; tick < 24; tick += 1) {
    const events: SimulationEvent[] = runner.step(tick === 0 ? [{
      type: 'activateAbility',
      entityId: self.id,
      slot: 'basic',
      targetId: target.id,
      direction: { x: 1, y: 0 }
    }] : []);
    for (const event of events) if (event.type === 'projectileSpawned' && event.weaponId === 'automatic-rifle') spawned += 1;
  }
  return spawned;
}

const gunner = getFighter('gunner');
const rifle = getWeapon('automatic-rifle');
const genericActivation = getAbilityActivationProfile('weapon-basic', gunner);
assert(gunner.weaponId === rifle.id, 'Gunner did not equip the automatic rifle.');
assert(rifle.category === 'ranged' && rifle.burstCount === 4, 'Automatic rifle burst data is invalid.');
assert(genericActivation.maxRange === rifle.range, 'Generic Fighter Lab weapon attack did not resolve equipped range.');
assert(getVisualRecipe('gunner').weapon === 'rifle', 'Gunner rifle visual is not registered.');
assert(listWeapons().some((weapon) => weapon.id === 'automatic-rifle'), 'Automatic rifle is missing from Fighter Lab weapon inventory.');
assert(validateAutomaticBurst() === 4, 'Automatic rifle did not emit four deterministic shots.');

const aimingBattle = new LocalSimulationRunner({
  seed: 712,
  arenaId: 'training-grid',
  modeId: 'training',
  participants: [
    { fighterId: 'gunner', team: 1, controller: 'player', x: 220, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, x: 430, y: 250 },
    { fighterId: 'water-shaper', team: 2, x: 620, y: 410 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 600, training: { enabled: true, suppressVictory: true } }
});
const aimingSnapshot = aimingBattle.getSnapshot();
const playerEntity = aimingSnapshot.entities.find((entity) => entity.controller === 'player');
const aimedEntity = aimingSnapshot.entities.find((entity) => entity.fighterId === 'water-shaper');
assert(playerEntity && aimedEntity, 'Pointer aiming scenario did not spawn.');
const player = new PlayerController();
player.setControlledEntities([playerEntity.id]);
player.setAimAt({ x: aimedEntity.x, y: aimedEntity.y });
player.activate('basic');
const aimedCommand = player.commandsForTick(aimingSnapshot).find((command) => command.type === 'activateAbility');
assert(aimedCommand?.type === 'activateAbility' && aimedCommand.targetId === aimedEntity.id, 'Pointer targeting did not select the aimed enemy.');

const largeQuality = resolveVfxQuality({ effects: true, particleScale: 1, reducedMotion: false, adaptiveQuality: true, performanceScale: 1, fighterCount: 100 });
assert(largeQuality.tier === 'low', '100-fighter VFX did not resolve to low density.');
assert(largeQuality.maxGroundMarks <= 8, 'Large battle ground-mark budget is too high.');

const first = runMassBattle(707_171);
const second = runMassBattle(707_171);
assert(first.checksum === second.checksum, '50v50 deterministic checksum mismatch.');
assert(first.snapshot.tick === second.snapshot.tick, '50v50 deterministic ending tick mismatch.');
assert(first.basicActivations > 0, 'AI never used basic attacks during 50v50 validation.');
assert(first.skillActivations > 0, 'AI never used prioritized skills during 50v50 validation.');
assert(first.projectileSpawns > 0, 'Ranged and throwable projectiles were not exercised.');

console.log(`PASS Gunner automatic rifle: ${rifle.burstCount} shots, ${rifle.range} range`);
console.log(`PASS mouse targeting selected entity ${aimedEntity.id}`);
console.log(`PASS 50v50 checksum ${first.checksum}; tick ${first.snapshot.tick}`);
console.log(`PASS AI activity: ${first.basicActivations} basics, ${first.skillActivations} skills, ${first.projectileSpawns} projectiles`);
console.log(`PASS 50v50 headless timing: ${first.elapsedMs.toFixed(1)} ms total, ${first.msPerTick.toFixed(2)} ms/tick, max ${first.maxProjectiles} projectiles`);
