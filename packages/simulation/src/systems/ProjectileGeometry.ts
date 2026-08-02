import type { Vec2 } from '@kinetic/protocol';

export function normalizeVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.000001) {
    return (ax - cx) ** 2 + (ay - cy) ** 2 <= radius * radius;
  }
  const t = Math.max(
    0,
    Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSq)
  );
  const closestX = ax + dx * t;
  const closestY = ay + dy * t;
  return (closestX - cx) ** 2 + (closestY - cy) ** 2 <= radius * radius;
}

export function segmentIntersectsBox(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  const checks: Array<[number, number]> = [
    [-dx, ax - x],
    [dx, x + width - ax],
    [-dy, ay - y],
    [dy, y + height - ay]
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 0.000001) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) tMin = Math.max(tMin, r);
    else tMax = Math.min(tMax, r);
    if (tMin > tMax) return false;
  }
  return true;
}
