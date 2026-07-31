import type { EntityId, ProjectileSnapshot, SimulationEvent } from '@kinetic/protocol';

export type MassBattleRenderTier = 'full' | 'crowd' | 'mass';

export interface MassBattleRenderPolicy {
  tier: MassBattleRenderTier;
  targetFps: number;
  maxPresentationEvents: number;
  maxProjectileVisuals: number;
  maxProjectileTrails: number;
  maxResidualEffects: number;
  maxWeaponEffects: number;
  maxGroundMarks: number;
}

export function resolveMassBattleRenderPolicy(
  fighterCount: number,
  requestedFps: number,
  performanceScale = 1
): MassBattleRenderPolicy {
  const safeRequestedFps = Math.max(15, Math.min(60, requestedFps));
  const constrained = performanceScale < 0.58;
  if (fighterCount >= 48) {
    return {
      tier: 'mass',
      targetFps: Math.min(30, safeRequestedFps),
      maxPresentationEvents: constrained ? 24 : 32,
      maxProjectileVisuals: constrained ? 48 : 64,
      maxProjectileTrails: constrained ? 12 : 16,
      maxResidualEffects: constrained ? 72 : 96,
      maxWeaponEffects: constrained ? 10 : 14,
      maxGroundMarks: 4
    };
  }
  if (fighterCount >= 32) {
    return {
      tier: 'crowd',
      targetFps: Math.min(45, safeRequestedFps),
      maxPresentationEvents: constrained ? 40 : 56,
      maxProjectileVisuals: constrained ? 80 : 112,
      maxProjectileTrails: constrained ? 24 : 36,
      maxResidualEffects: constrained ? 112 : 144,
      maxWeaponEffects: constrained ? 18 : 24,
      maxGroundMarks: 6
    };
  }
  return {
    tier: 'full',
    targetFps: safeRequestedFps,
    maxPresentationEvents: Number.POSITIVE_INFINITY,
    maxProjectileVisuals: Number.POSITIVE_INFINITY,
    maxProjectileTrails: Number.POSITIVE_INFINITY,
    maxResidualEffects: Number.POSITIVE_INFINITY,
    maxWeaponEffects: Number.POSITIVE_INFINITY,
    maxGroundMarks: Number.POSITIVE_INFINITY
  };
}

function eventEntityIds(event: SimulationEvent): readonly EntityId[] {
  switch (event.type) {
    case 'spawn':
    case 'death':
    case 'wallImpact':
    case 'obstacleImpact':
    case 'zoneEntered':
    case 'zoneExited':
    case 'hazardTriggered':
    case 'abilityActivated':
    case 'abilityResolved':
    case 'weaponAttackStarted':
      return [event.entityId];
    case 'impact':
      return [event.a, event.b];
    case 'obstacleDamaged':
    case 'obstacleDestroyed':
    case 'blast':
      return [event.sourceId];
    case 'weaponHit':
      return [event.sourceId, event.targetId];
    case 'projectileSpawned':
      return event.targetId === undefined ? [event.sourceId] : [event.sourceId, event.targetId];
    case 'projectileImpact':
      return event.targetId === undefined ? [event.sourceId] : [event.sourceId, event.targetId];
    case 'damage':
    case 'knockbackApplied':
    case 'statusApplied':
      return event.sourceId === undefined ? [event.targetId] : [event.sourceId, event.targetId];
    case 'battleEnded':
      return event.winnerEntityIds;
  }
}

function eventPriority(event: SimulationEvent, playerEntityIds: ReadonlySet<EntityId>): number {
  const playerRelated = eventEntityIds(event).some((id) => playerEntityIds.has(id));
  if (event.type === 'battleEnded' || event.type === 'death' || event.type === 'obstacleDestroyed') return 5;
  if (playerRelated) return 4;
  if (event.type === 'blast' || event.type === 'abilityResolved' || event.type === 'abilityActivated') return 3;
  if (event.type === 'projectileImpact' || event.type === 'weaponHit' || event.type === 'damage') return 2;
  if (event.type === 'knockbackApplied' || event.type === 'wallImpact' || event.type === 'obstacleImpact') return 1;
  return 0;
}

export function budgetPresentationEvents(
  events: readonly SimulationEvent[],
  maxEvents: number,
  playerEntityIds: ReadonlySet<EntityId>
): readonly SimulationEvent[] {
  if (!Number.isFinite(maxEvents) || events.length <= maxEvents) return events;
  const budget = Math.max(0, Math.floor(maxEvents));
  if (budget === 0) return [];
  const selected = events
    .map((event, index) => ({ event, index, priority: eventPriority(event, playerEntityIds) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, budget)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.event);
  return selected;
}

export function selectProjectileVisuals(
  projectiles: readonly ProjectileSnapshot[],
  maxProjectiles: number,
  playerEntityIds: ReadonlySet<EntityId>
): readonly ProjectileSnapshot[] {
  if (!Number.isFinite(maxProjectiles) || projectiles.length <= maxProjectiles) return projectiles;
  const budget = Math.max(0, Math.floor(maxProjectiles));
  if (budget === 0) return [];
  const selected: ProjectileSnapshot[] = [];
  const selectedIds = new Set<number>();
  for (const projectile of projectiles) {
    if (!playerEntityIds.has(projectile.sourceId)) continue;
    selected.push(projectile);
    selectedIds.add(projectile.id);
    if (selected.length >= budget) return selected;
  }
  const remaining = budget - selected.length;
  const candidates = projectiles.filter((projectile) => !selectedIds.has(projectile.id));
  const stride = Math.max(1, Math.ceil(candidates.length / Math.max(1, remaining)));
  for (let index = 0; index < candidates.length && selected.length < budget; index += stride) {
    const projectile = candidates[index];
    if (projectile) selected.push(projectile);
  }
  return selected;
}
