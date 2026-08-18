import {
  getFighter,
  getMeleeContactProfile,
  getPrimaryAttack,
  type PrimaryAttackDefinition
} from '@kinetic/content';
import type { EntityId, Vec2 } from '@kinetic/protocol';
import type { World } from '../world';

export interface MeleeContactHit {
  targetId: EntityId;
  position: Vec2;
}

export interface MeleeStrikeOptions {
  sweepDegrees: number;
  reachMultiplier?: number;
  widthMultiplier?: number;
  enemiesOnly?: boolean;
}

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

function normalized(direction: Vec2): Vec2 {
  const length = Math.hypot(direction.x, direction.y) || 1;
  return { x: direction.x / length, y: direction.y / length };
}

function rotateLocal(x: number, y: number, facing: Vec2): Vec2 {
  return {
    x: x * facing.x - y * facing.y,
    y: x * facing.y + y * facing.x
  };
}

function closestPointOnSegment(px: number, py: number, segment: Segment): Vec2 {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.000001) return { x: segment.ax, y: segment.ay };
  const t = Math.max(0, Math.min(1, ((px - segment.ax) * dx + (py - segment.ay) * dy) / lengthSq));
  return { x: segment.ax + dx * t, y: segment.ay + dy * t };
}

function segmentHitsCircle(segment: Segment, cx: number, cy: number, radius: number): Vec2 | null {
  const closest = closestPointOnSegment(cx, cy, segment);
  const dx = cx - closest.x;
  const dy = cy - closest.y;
  return dx * dx + dy * dy <= radius * radius ? closest : null;
}

function weaponSegment(
  world: World,
  source: EntityId,
  attack: PrimaryAttackDefinition,
  direction: Vec2,
  animationRotation: number,
  forwardMotion: number,
  reachMultiplier: number,
  sourcePosition?: Vec2
): { segment: Segment; width: number } | null {
  const profile = getMeleeContactProfile(attack);
  const grip = attack.visualGrip;
  if (!profile || !grip) return null;

  const facing = normalized(direction);
  const sourceRadius = world.radius[source] ?? 0;
  const sourceX = sourcePosition?.x ?? (world.x[source] ?? 0);
  const sourceY = sourcePosition?.y ?? (world.y[source] ?? 0);
  const handLocal = rotateLocal(
    sourceRadius * profile.handForwardRadius + forwardMotion,
    sourceRadius * profile.handLateralRadius,
    facing
  );
  const handX = sourceX + handLocal.x;
  const handY = sourceY + handLocal.y;

  const baseAngle = Math.atan2(facing.y, facing.x) + (grip.rotationDegrees ?? 0) * Math.PI / 180 + animationRotation;
  const weaponDirection = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  const weaponSize = sourceRadius * attack.visualScale;
  const gripX = grip.x * weaponSize;
  const gripY = (grip.y ?? 0) * weaponSize;
  const alongGrip = gripX * weaponDirection.x - gripY * weaponDirection.y;
  const acrossGrip = gripX * weaponDirection.y + gripY * weaponDirection.x;
  const originX = handX - alongGrip;
  const originY = handY - acrossGrip;
  const tipDistance = profile.tipScale * weaponSize * reachMultiplier;

  return {
    segment: {
      ax: handX,
      ay: handY,
      bx: originX + weaponDirection.x * tipDistance,
      by: originY + weaponDirection.y * tipDistance
    },
    width: Math.max(4, sourceRadius * profile.widthRadius)
  };
}

function activeWeaponPose(attack: PrimaryAttackDefinition, progress: number): { rotation: number; forwardMotion: number } {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * (3 - 2 * t);
  switch (attack.style) {
    case 'swing':
      return { rotation: -0.78 + eased * 2.28, forwardMotion: 0 };
    case 'thrust':
      return { rotation: 0, forwardMotion: Math.sin(t * Math.PI) * 0.78 };
    case 'overhead':
    case 'slam':
      return { rotation: -1.25 + eased * 1.9, forwardMotion: 0 };
    case 'spin':
    case 'orbit':
      return { rotation: t * Math.PI * 2, forwardMotion: 0 };
    default:
      return { rotation: 0, forwardMotion: 0 };
  }
}

/**
 * Resolve a primary melee hit from the swept path of the actual held weapon.
 * Multiple deterministic samples bridge the previous/current active frames so
 * a fast sword or spear cannot tunnel through a target between ticks.
 */
export function resolvePrimaryMeleeHits(
  world: World,
  source: EntityId,
  attack: PrimaryAttackDefinition,
  direction: Vec2,
  previousProgress: number,
  currentProgress: number,
  alreadyHit: ReadonlySet<EntityId>
): MeleeContactHit[] {
  const hits: MeleeContactHit[] = [];
  const team = world.getTeam(source);
  const sampleCount = 7;
  const candidates = world.activeIdsView();

  for (const target of candidates) {
    if (target === source || alreadyHit.has(target) || !world.isAlive(target)) continue;
    if (!attack.friendlyFire && world.getTeam(target) === team) continue;
    const targetRadius = world.radius[target] ?? 0;
    const targetX = world.x[target] ?? 0;
    const targetY = world.y[target] ?? 0;
    let contact: Vec2 | null = null;

    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const alpha = sample / sampleCount;
      const progress = previousProgress + (currentProgress - previousProgress) * alpha;
      const pose = activeWeaponPose(attack, progress);
      const segment = weaponSegment(world, source, attack, direction, pose.rotation, pose.forwardMotion * (world.radius[source] ?? 0), 1);
      if (!segment) break;
      contact = segmentHitsCircle(segment.segment, targetX, targetY, targetRadius + segment.width);
      if (contact) break;
    }
    if (contact) hits.push({ targetId: target, position: contact });
  }
  return hits;
}

/** Resolve a skill sweep/thrust against the visible primary weapon envelope. */
export function resolveAbilityMeleeStrikeHits(
  world: World,
  source: EntityId,
  direction: Vec2,
  options: MeleeStrikeOptions
): MeleeContactHit[] {
  const fighter = getFighter(world.getFighterId(source));
  const attack = getPrimaryAttack(fighter.primaryAttackId);
  const sweepRadians = Math.max(0, Math.min(330, options.sweepDegrees)) * Math.PI / 180;
  const samples = Math.max(1, Math.ceil(Math.max(1, options.sweepDegrees) / 24));
  const team = world.getTeam(source);
  const hits: MeleeContactHit[] = [];
  const reachMultiplier = options.reachMultiplier ?? 1;
  const widthMultiplier = options.widthMultiplier ?? 1;

  for (const target of world.activeIdsView()) {
    if (target === source || !world.isAlive(target)) continue;
    if ((options.enemiesOnly ?? true) && world.getTeam(target) === team) continue;
    const tx = world.x[target] ?? 0;
    const ty = world.y[target] ?? 0;
    const tr = world.radius[target] ?? 0;
    let contact: Vec2 | null = null;

    for (let sample = 0; sample <= samples; sample += 1) {
      const alpha = samples === 0 ? 0.5 : sample / samples;
      const rotation = sweepRadians <= 0.001 ? 0 : -sweepRadians / 2 + sweepRadians * alpha;
      const segment = weaponSegment(world, source, attack, direction, rotation, 0, reachMultiplier);
      if (!segment) break;
      contact = segmentHitsCircle(segment.segment, tx, ty, tr + segment.width * widthMultiplier);
      if (contact) break;
    }
    if (contact) hits.push({ targetId: target, position: contact });
  }
  return hits;
}

/** Charged skills use a narrow, forward weapon contact envelope while driving. */
export function resolveChargedMeleeContact(
  world: World,
  source: EntityId,
  target: EntityId,
  direction: Vec2,
  reachMultiplier = 1.36,
  widthMultiplier = 1.45
): MeleeContactHit | null {
  if (!world.isAlive(source) || !world.isAlive(target)) return null;
  const fighter = getFighter(world.getFighterId(source));
  const attack = getPrimaryAttack(fighter.primaryAttackId);
  const sourceStart = { x: world.prevX[source] ?? world.x[source] ?? 0, y: world.prevY[source] ?? world.y[source] ?? 0 };
  const sourceEnd = { x: world.x[source] ?? 0, y: world.y[source] ?? 0 };
  const targetStart = { x: world.prevX[target] ?? world.x[target] ?? 0, y: world.prevY[target] ?? world.y[target] ?? 0 };
  const targetEnd = { x: world.x[target] ?? 0, y: world.y[target] ?? 0 };
  const targetRadius = world.radius[target] ?? 0;

  // Sweep the actual weapon envelope across the fighter's travel this tick so
  // high-speed charges cannot tunnel through a target between simulation steps.
  for (let sample = 0; sample <= 6; sample += 1) {
    const alpha = sample / 6;
    const sourcePosition = {
      x: sourceStart.x + (sourceEnd.x - sourceStart.x) * alpha,
      y: sourceStart.y + (sourceEnd.y - sourceStart.y) * alpha
    };
    const targetX = targetStart.x + (targetEnd.x - targetStart.x) * alpha;
    const targetY = targetStart.y + (targetEnd.y - targetStart.y) * alpha;
    const segment = weaponSegment(world, source, attack, direction, 0, 0, reachMultiplier, sourcePosition);
    if (!segment) return null;
    const contact = segmentHitsCircle(
      segment.segment,
      targetX,
      targetY,
      targetRadius + segment.width * widthMultiplier
    );
    if (contact) return { targetId: target, position: contact };
  }
  return null;
}
