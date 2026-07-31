import {
  CONTENT_VERSION,
  getAiProfile,
  getFighter,
  getPrimaryAttack,
  getProjectileSource,
  listFighters
} from '@kinetic/content';
import { selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { evaluatePlayerAim, resolvePlayerTargetingPreview } from '../packages/renderer-pixi/src/playerTargeting';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

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
      maxBattleTicks: 1_500,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  });
}

function run(runner: LocalSimulationRunner, ticks: number, first?: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(tick === 0 && first ? [first] : []));
  return events;
}

assert(CONTENT_VERSION === '1.1.6-stage7.5', `Unexpected content version: ${CONTENT_VERSION}`);
assert(listFighters().some((fighter) => fighter.id === 'rocket-vanguard'), 'Rocket Vanguard is not registered.');
assert(getFighter('rocket-vanguard').primaryAttackId === 'guided-rocket', 'Rocket Vanguard has the wrong primary attack.');
assert((getProjectileSource('micro-missile').projectile?.homingStrength ?? 0) > 0, 'Micro missiles are not homing.');
assert(getPrimaryAttack('automatic-rifle').damage <= 4, 'Gunner nerf was not applied.');
assert((getPrimaryAttack('demolition-bomb').projectile?.speed ?? 0) >= 15, 'Bomber Basic remains too slow.');

const rangeRunner = trainingBattle([
  { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 200, y: 360 },
  { fighterId: 'bomber', team: 2, controller: 'ai', x: 650, y: 360 }
], 7310);
const rangeSnapshot = rangeRunner.getSnapshot();
const rangePlayer = rangeSnapshot.entities.find((entity) => entity.controller === 'player')!;
for (const slot of ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'] as const) {
  const preview = resolvePlayerTargetingPreview(rangePlayer, slot);
  assert(preview.label.length > 0, `${slot} has no targeting label.`);
  assert(preview.maxRange >= preview.minRange, `${slot} has an invalid range.`);
}
const basicPreview = resolvePlayerTargetingPreview(rangePlayer, 'basic');
assert(evaluatePlayerAim(rangeSnapshot, rangePlayer, { x: rangePlayer.x + basicPreview.maxRange + 40, y: rangePlayer.y }, basicPreview).reason === 'out-of-range', 'Player range validation did not reject an invalid aim point.');

const aiRunner = trainingBattle([
  { fighterId: 'rocket-vanguard', team: 1, controller: 'ai', x: 70, y: 360 },
  { fighterId: 'bomber', team: 2, controller: 'ai', x: 970, y: 360 }
], 7311);
const aiSnapshot = aiRunner.getSnapshot();
const aiSelf = aiSnapshot.entities.find((entity) => entity.team === 1)!;
const aiTarget = aiSnapshot.entities.find((entity) => entity.team === 2)!;
const selection = selectAbilityAction(aiSnapshot, aiSelf, aiTarget, getAiProfile('rocket-artillery'));
assert(!selection.debug.candidates.some((candidate) => ['skill1', 'skill3', 'ultimate'].includes(candidate.slot) && candidate.valid), 'AI considered an out-of-range offensive skill valid.');
assert(!['skill1', 'skill3', 'ultimate'].includes(selection.selected?.slot ?? ''), 'AI issued an out-of-range offensive skill.');

function executeUltimate(): { spawned: number; checksum: string; allTargeted: boolean } {
  const runner = trainingBattle([
    { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 360, y: 360 },
    { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 680, y: 360 }
  ], 7312);
  const snapshot = runner.getSnapshot();
  const self = snapshot.entities.find((entity) => entity.team === 1)!;
  const target = snapshot.entities.find((entity) => entity.team === 2)!;
  const events = run(runner, 80, {
    type: 'activateAbility', entityId: self.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 }
  });
  const missiles = events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'micro-missile');
  return {
    spawned: missiles.length,
    allTargeted: missiles.every((event) => event.type === 'projectileSpawned' && event.targetId === target.id),
    checksum: checksumSnapshot(runner.getSnapshot())
  };
}
const firstUltimate = executeUltimate();
const secondUltimate = executeUltimate();
assert(firstUltimate.spawned === 16, `Expected 16 micro missiles, received ${firstUltimate.spawned}.`);
assert(firstUltimate.allTargeted, 'Starburst missiles did not converge on the selected target.');
assert(firstUltimate.checksum === secondUltimate.checksum, 'Starburst Convergence is not deterministic.');

const wallRunner = trainingBattle([
  { fighterId: 'bomber', team: 1, controller: 'player', x: 850, y: 360 },
  { fighterId: 'water-shaper', team: 2, controller: 'player', x: 900, y: 360 }
], 7313);
const wallSnapshot = wallRunner.getSnapshot();
const bomber = wallSnapshot.entities.find((entity) => entity.team === 1)!;
const wallTarget = wallSnapshot.entities.find((entity) => entity.team === 2)!;
const wallEvents = run(wallRunner, 90, {
  type: 'activateAbility', entityId: bomber.id, slot: 'ultimate', targetId: wallTarget.id, direction: { x: 1, y: 0 }
});
assert(wallEvents.some((event) => event.type === 'blast' && event.force > 0), 'Bomber ultimate has no explosion force.');
assert(wallEvents.some((event) => event.type === 'wallImpact' && event.entityId === wallTarget.id), 'Explosion knockback did not create a wall impact.');

console.log(JSON.stringify({
  contentVersion: CONTENT_VERSION,
  fighterCount: listFighters().length,
  gunnerBulletDamage: getPrimaryAttack('automatic-rifle').damage,
  bomberProjectileSpeed: getPrimaryAttack('demolition-bomb').projectile?.speed,
  starburstMissiles: firstUltimate.spawned,
  deterministicChecksum: firstUltimate.checksum,
  playerSkillRanges: ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'].map((slot) => resolvePlayerTargetingPreview(rangePlayer, slot as 'basic' | 'skill1' | 'skill2' | 'skill3' | 'ultimate').maxRange)
}, null, 2));
