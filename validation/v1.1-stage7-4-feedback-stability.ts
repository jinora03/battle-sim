import { CONTENT_VERSION, getPrimaryAttack } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { resolveBlastFeedback } from '../packages/renderer-pixi/src/combatFeedback';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trainingBattle(participants: BattleDefinition['participants']): LocalSimulationRunner {
  return new LocalSimulationRunner({
    seed: 7401,
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
const rifle = getPrimaryAttack('automatic-rifle');
assert(rifle.damage === 3.6, 'Gunner damage tuning changed unexpectedly.');
assert(rifle.burstCount === 4 && rifle.burstIntervalTicks === 3 && rifle.projectile?.speed === 22, 'Gunner cadence or projectile feel was changed.');

const micro = resolveBlastFeedback({ abilityId: 'micro-missile', force: 8, radius: 72 }, 'hero');
const barrage = resolveBlastFeedback({ abilityId: 'rocket-salvo-missile', force: 10, radius: 92 }, 'hero');
assert(micro.freezeMs === 0, 'Micro missiles still apply repeated arena hit-stop.');
assert(barrage.freezeMs <= 5, 'Missile barrage hit-stop is too large.');

const runner = trainingBattle([
  { fighterId: 'bomber', team: 1, controller: 'player', x: 850, y: 360 },
  { fighterId: 'water-shaper', team: 2, controller: 'player', x: 900, y: 360 }
]);
const snapshot = runner.getSnapshot();
const bomber = snapshot.entities.find((entity) => entity.team === 1)!;
const target = snapshot.entities.find((entity) => entity.team === 2)!;
const events = run(runner, 100, {
  type: 'activateAbility', entityId: bomber.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 }
});
const knockback = events.find((event) => event.type === 'knockbackApplied' && event.targetId === target.id && event.kind === 'explosion');
assert(knockback?.type === 'knockbackApplied' && knockback.force > 0, 'Explosion knockback presentation event is missing.');
assert(events.some((event) => event.type === 'wallImpact' && event.entityId === target.id), 'Explosion knockback did not reach the wall within the regression scenario.');

console.log(JSON.stringify({
  contentVersion: CONTENT_VERSION,
  gunnerDamage: rifle.damage,
  gunnerBurst: rifle.burstCount,
  microMissileFreezeMs: micro.freezeMs,
  barrageFreezeMs: barrage.freezeMs,
  knockbackForce: knockback.type === 'knockbackApplied' ? knockback.force : 0,
  wallImpact: true
}, null, 2));
