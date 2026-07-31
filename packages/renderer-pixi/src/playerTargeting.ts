import { getAbility, getAbilityActivationProfile, getFighter, getPrimaryAttack } from '@kinetic/content';
import type { AbilitySlot, EntitySnapshot, Vec2, WorldSnapshot } from '@kinetic/protocol';

export interface PlayerTargetingPreview {
  slot: AbilitySlot;
  label: string;
  minRange: number;
  maxRange: number;
  targeting: 'self' | 'target' | 'area' | 'direction';
  finiteRange: boolean;
}

export interface PlayerAimValidity {
  valid: boolean;
  distance: number;
  reason: 'valid' | 'too-close' | 'out-of-range' | 'blocked' | 'self';
}

export function resolvePlayerTargetingPreview(entity: EntitySnapshot, slot: AbilitySlot): PlayerTargetingPreview {
  const fighter = getFighter(entity.fighterId);
  if (slot === 'basic') {
    const attack = getPrimaryAttack(fighter.primaryAttackId);
    const melee = ['melee', 'spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior);
    return {
      slot,
      label: attack.name,
      minRange: attack.minRange,
      maxRange: melee ? attack.range + entity.radius : attack.range,
      targeting: ['spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior) ? 'area' : 'target',
      finiteRange: true
    };
  }
  const abilityId = fighter.abilitySlots[slot];
  if (!abilityId) {
    return { slot, label: 'Unassigned skill', minRange: 0, maxRange: 0, targeting: 'self', finiteRange: false };
  }
  const ability = getAbility(abilityId);
  const activation = getAbilityActivationProfile(ability, fighter);
  return {
    slot,
    label: ability.name,
    minRange: activation.minRange,
    maxRange: activation.maxRange,
    targeting: activation.targeting,
    finiteRange: Number.isFinite(activation.maxRange) && activation.maxRange < 9000
  };
}

export function evaluatePlayerAim(
  snapshot: WorldSnapshot,
  entity: EntitySnapshot,
  point: Vec2,
  preview: PlayerTargetingPreview
): PlayerAimValidity {
  if (preview.targeting === 'self') return { valid: true, distance: 0, reason: 'self' };
  const distance = Math.hypot(point.x - entity.x, point.y - entity.y);
  if (distance < preview.minRange) return { valid: false, distance, reason: 'too-close' };
  if (preview.finiteRange && distance > preview.maxRange) return { valid: false, distance, reason: 'out-of-range' };
  if (preview.targeting !== 'area' && !hasLineOfSight(snapshot, entity, point)) {
    return { valid: false, distance, reason: 'blocked' };
  }
  return { valid: true, distance, reason: 'valid' };
}

function hasLineOfSight(snapshot: WorldSnapshot, self: EntitySnapshot, point: Vec2): boolean {
  for (const obstacle of snapshot.obstacles) {
    if (!obstacle.alive) continue;
    if (obstacle.shape === 'circle') {
      if (segmentCircle(self.x, self.y, point.x, point.y, obstacle.x, obstacle.y, obstacle.radius)) return false;
      continue;
    }
    if (segmentBox(
      self.x,
      self.y,
      point.x,
      point.y,
      obstacle.x - obstacle.width / 2,
      obstacle.y - obstacle.height / 2,
      obstacle.width,
      obstacle.height
    )) return false;
  }
  return true;
}

function segmentCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((cx - ax) * abx + (cy - ay) * aby) / lengthSquared));
  const dx = ax + abx * t - cx;
  const dy = ay + aby * t - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function segmentBox(ax: number, ay: number, bx: number, by: number, x: number, y: number, width: number, height: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, minimum, maximum] of [[ax, dx, x, x + width], [ay, dy, y, y + height]] as const) {
    if (Math.abs(delta) < 1e-8) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    const near = Math.min(first, second);
    const far = Math.max(first, second);
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }
  return true;
}
