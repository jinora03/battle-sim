import {
  CONTENT_VERSION,
  getFighter,
  listCompatibleModules,
  listMountedAttachments,
  resolveFighterLoadout
} from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner, SeededRng, World } from '@kinetic/simulation';
import { resolveMountedAttachmentPose } from '../packages/renderer-pixi/src/mountedAttachments';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (tick: number) => SimulationCommand[]
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(commandsForTick(tick)));
  return events;
}

function gunnerDuel(defenderModuleIds: string[] = [], attackerModuleIds: string[] = []): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8101,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 180, y: 470, loadout: { moduleIds: attackerModuleIds } },
      { fighterId: 'gunner', team: 2, controller: 'player', x: 470, y: 470, loadout: { moduleIds: defenderModuleIds } }
    ],
    rules: {
      maxBattleTicks: 900,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  };
  return new LocalSimulationRunner(battle);
}

assert(CONTENT_VERSION === '1.2.1-stage8.1', `Unexpected content version: ${CONTENT_VERSION}`);
const gunner = getFighter('gunner');
assert(listCompatibleModules(gunner, 'offense').some((module) => module.id === 'shoulder-missile-pod'), 'Shoulder Missile Pod is missing.');
assert(listCompatibleModules(gunner, 'defense').some((module) => module.id === 'deflector-plate'), 'Deflector Plate is missing.');
assert(listCompatibleModules(gunner, 'mobility').some((module) => module.id === 'recoil-thrusters'), 'Recoil Thrusters are missing.');

const resolved = resolveFighterLoadout(gunner, {
  moduleIds: ['targeting-drone', 'recoil-thrusters', 'deflector-plate', 'shoulder-missile-pod']
});
assert(resolved.moduleIds.join(',') === 'shoulder-missile-pod,deflector-plate,recoil-thrusters,targeting-drone', 'Module order is not deterministic.');
assert(resolved.mountedAttachments.length === 5, 'Mounted attachment recipes were not resolved.');

const world = new World(4);
const baseId = world.spawn({ fighterId: 'gunner', team: 1, controller: 'player' }, 100, 100, new SeededRng(1));
const thrusterId = world.spawn({ fighterId: 'gunner', team: 2, controller: 'player', loadout: { moduleIds: ['recoil-thrusters'] } }, 200, 100, new SeededRng(1));
assert(Math.abs((world.maxSpeed[thrusterId] ?? 0) / (world.maxSpeed[baseId] ?? 1) - 1.06) < 1e-9, 'Max-speed modifier was not applied at spawn.');
assert(Math.abs((world.moveAcceleration[thrusterId] ?? 0) / (world.moveAcceleration[baseId] ?? 1) - 1.14) < 1e-9, 'Acceleration modifier was not applied at spawn.');
const copiedIds = world.copyActiveIdsInto([]);
assert(copiedIds.length === 2 && new Set(copiedIds).size === 2, 'Active-id buffer contains duplicates.');

function firstPrimaryDamage(defenderModules: string[]): number {
  const runner = gunnerDuel(defenderModules);
  const events = runTicks(runner, 60, (tick) => tick === 0
    ? [{ type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } }, { type: 'stop', entityId: 1 }]
    : [{ type: 'stop', entityId: 1 }]);
  const event = events.find((candidate) => candidate.type === 'damage' && candidate.sourceId === 0 && candidate.targetId === 1);
  assert(event?.type === 'damage', 'Primary damage event was not produced.');
  return event.amount;
}

const standardDamage = firstPrimaryDamage([]);
const platedDamage = firstPrimaryDamage(['deflector-plate']);
assert(Math.abs(platedDamage / standardDamage - 0.9) < 1e-9, 'Deflector Plate damage multiplier is incorrect.');

function firstSuppressiveDamage(attackerModules: string[]): number {
  const runner = gunnerDuel([], attackerModules);
  const events = runTicks(runner, 70, (tick) => tick === 0
    ? [{ type: 'activateAbility', entityId: 0, slot: 'skill2', targetId: 1, direction: { x: 1, y: 0 } }, { type: 'stop', entityId: 1 }]
    : [{ type: 'stop', entityId: 1 }]);
  const event = events.find((candidate) => candidate.type === 'weaponHit' && candidate.weaponId === 'suppressive-round');
  assert(event?.type === 'weaponHit', 'Suppressive projectile did not hit.');
  return event.damage;
}

const standardSkillDamage = firstSuppressiveDamage([]);
const podSkillDamage = firstSuppressiveDamage(['shoulder-missile-pod']);
assert(Math.abs(podSkillDamage / standardSkillDamage - 1.12) < 1e-9, 'Shoulder pod skill damage multiplier is incorrect.');

const [drone] = listMountedAttachments(['targeting-drone']);
assert(drone, 'Targeting Drone visual recipe is missing.');
const pose = resolveMountedAttachmentPose(drone, {
  entityId: 4,
  radius: 35,
  elapsedSeconds: 1.5,
  counterRotation: -0.4,
  reducedMotion: false,
  lod: 'hero'
});
assert(Math.abs(Math.hypot(pose.x, pose.y) - 35 * 1.72) < 1e-9, 'Orbit mount pose is incorrect.');

console.log(JSON.stringify({
  contentVersion: CONTENT_VERSION,
  modules: resolved.moduleIds,
  mountedAttachments: resolved.mountedAttachments.map((attachment) => attachment.id),
  standardDamage,
  platedDamage,
  standardSkillDamage,
  podSkillDamage,
  maxSpeedMultiplier: (world.maxSpeed[thrusterId] ?? 0) / (world.maxSpeed[baseId] ?? 1),
  accelerationMultiplier: (world.moveAcceleration[thrusterId] ?? 0) / (world.moveAcceleration[baseId] ?? 1)
}, null, 2));
