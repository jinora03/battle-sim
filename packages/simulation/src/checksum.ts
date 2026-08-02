import type { WorldSnapshot } from '@kinetic/protocol';

export function checksumSnapshot(snapshot: WorldSnapshot): string {
  let hash = 2166136261 >>> 0;
  const feed = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  };
  feed(`${snapshot.tick}|${snapshot.battleEnded}|${snapshot.winningTeam ?? 'n'}|${snapshot.result?.reason ?? 'none'}|${snapshot.objective.kind}|${snapshot.objective.remainingTicks ?? 'n'}`);
  for (const obstacle of snapshot.obstacles) {
    feed(`o:${obstacle.id}:${obstacle.alive}:${obstacle.hp.toFixed(4)}`);
  }
  for (const entity of snapshot.entities) {
    feed(`${entity.id}|${entity.fighterId}|${entity.team}|${entity.x.toFixed(5)}|${entity.y.toFixed(5)}|${entity.vx.toFixed(5)}|${entity.vy.toFixed(5)}|${entity.hp.toFixed(5)}|${entity.activeZoneIds.join(',')}|${entity.statuses.map((status) => `${status.statusId}:${status.stacks}:${status.remainingTicks}`).join(',')}|${entity.moduleIds.join(',')}|${entity.primaryAttackId}|${entity.weaponAttack?.weaponId ?? 'idle'}:${entity.weaponAttack?.phase ?? 'idle'}:${entity.weaponAttack?.remainingTicks ?? 0}`);
    for (const ability of entity.abilities) {
      feed(`|${ability.slot}:${ability.abilityId}:${ability.phase}:${ability.cooldownRemainingTicks}:${ability.castRemainingTicks}:${ability.armedRemainingTicks}`);
    }
  }
  for (const projectile of snapshot.projectiles) {
    feed(`p:${projectile.id}:${projectile.sourceId}:${projectile.weaponId}:${projectile.x.toFixed(5)}:${projectile.y.toFixed(5)}:${projectile.vx.toFixed(5)}:${projectile.vy.toFixed(5)}:${projectile.fuseRemainingTicks}`);
  }
  return hash.toString(16).padStart(8, '0');
}
