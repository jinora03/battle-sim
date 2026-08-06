import type { Graphics } from 'pixi.js';

/**
 * Shared silhouettes for ability glows and impact rings.
 *
 * Both `FxEngine` (small battles) and `LayeredVfxEngine` (budgeted battles)
 * previously drew ability glows as a stack of perfectly concentric discs that
 * expanded while fading. That combination reads as a soap bubble, and because it
 * ran for every phase of every intent it made unrelated abilities look
 * identical. These helpers keep the glow but give it an asymmetric outline and,
 * where a direction exists, an actual orientation.
 *
 * The caller supplies its own `random` source so the deterministic renderer
 * noise generator and `Math.random` can both be used without this module
 * depending on either.
 */
export type RandomSource = () => number;

/** Forward-biased lens: long along the aim vector, tight across it. */
export function drawDirectionalBloom(
  node: Graphics,
  nx: number,
  ny: number,
  coreColor: number,
  glowColor: number,
  radius: number,
  strength: number,
  focus: number
): void {
  const px = -ny;
  const py = nx;
  const reach = radius * (1.15 + focus * 0.55);
  const tail = radius * 0.4;
  const halfWidth = radius * (0.64 - focus * 0.2);
  const lens = (forward: number, across: number, alpha: number, color: number): void => {
    const tipX = nx * forward;
    const tipY = ny * forward;
    const midX = nx * forward * 0.32;
    const midY = ny * forward * 0.32;
    node.moveTo(tipX, tipY)
      .quadraticCurveTo(midX + px * across, midY + py * across, -nx * tail, -ny * tail)
      .quadraticCurveTo(midX - px * across, midY - py * across, tipX, tipY)
      .fill({ color, alpha: alpha * strength });
  };
  lens(reach, halfWidth, 0.1, glowColor);
  lens(reach * 0.66, halfWidth * 0.68, 0.16, glowColor);
  lens(reach * 0.36, halfWidth * 0.42, 0.5, coreColor);
  // Hot spot sits ahead of the origin so the glow itself points somewhere.
  const leadX = nx * radius * 0.3;
  const leadY = ny * radius * 0.3;
  node.moveTo(leadX + nx * radius * 0.22, leadY + ny * radius * 0.22)
    .lineTo(leadX + px * radius * 0.11, leadY + py * radius * 0.11)
    .lineTo(leadX - nx * radius * 0.22, leadY - ny * radius * 0.22)
    .lineTo(leadX - px * radius * 0.11, leadY - py * radius * 0.11)
    .fill({ color: 0xffffff, alpha: 0.72 * strength });
  // Trailing rails keep the direction legible while the glow fades out.
  for (const side of [1, -1]) {
    node.moveTo(-nx * tail + px * halfWidth * 0.5 * side, -ny * tail + py * halfWidth * 0.5 * side)
      .lineTo(nx * reach * 0.92 + px * halfWidth * 0.14 * side, ny * reach * 0.92 + py * halfWidth * 0.14 * side)
      .stroke({ color: glowColor, width: Math.max(1.4, radius * 0.05), alpha: 0.34 * strength });
  }
}

/** Radial glow with a wobbled rim so it never resolves into a clean disc. */
export function drawRadialBloom(
  node: Graphics,
  coreColor: number,
  glowColor: number,
  radius: number,
  strength: number,
  random: RandomSource
): void {
  const phase = random() * Math.PI * 2;
  const shell = (scale: number, jitter: number, alpha: number, color: number, points: number): void => {
    traceWobbleOutline(node, 0, 0, radius * scale, points, jitter, phase);
    node.fill({ color, alpha: alpha * strength });
  };
  shell(1, 0.18, 0.09, glowColor, 9);
  shell(0.62, 0.24, 0.15, glowColor, 7);
  shell(0.3, 0.3, 0.54, coreColor, 6);
  // Off-centre highlight breaks the last of the concentric symmetry.
  const offX = Math.cos(phase) * radius * 0.12;
  const offY = Math.sin(phase) * radius * 0.12;
  node.moveTo(offX, offY - radius * 0.21)
    .lineTo(offX + radius * 0.13, offY)
    .lineTo(offX, offY + radius * 0.21)
    .lineTo(offX - radius * 0.13, offY)
    .fill({ color: 0xffffff, alpha: 0.7 * strength });
}

/**
 * Traces a closed but irregular outline. The caller applies `fill` or `stroke`,
 * which lets one outline serve blast decals, glows and flashes.
 */
export function traceWobbleOutline(
  node: Graphics,
  cx: number,
  cy: number,
  radius: number,
  points: number,
  jitter: number,
  phase: number
): void {
  const steps = Math.max(5, points);
  for (let index = 0; index <= steps; index += 1) {
    const angle = phase + index / steps * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 2.9 + phase) * jitter;
    const px = cx + Math.cos(angle) * radius * wobble;
    const py = cy + Math.sin(angle) * radius * wobble;
    if (index === 0) node.moveTo(px, py);
    else node.lineTo(px, py);
  }
}

/**
 * Expanding impact ring drawn as a handful of arcs with gaps between them.
 * A closed ring inflating several times its size while fading is the clearest
 * bubble cue in the whole renderer.
 */
export function drawFracturedRing(
  node: Graphics,
  radius: number,
  color: number,
  width: number,
  alpha: number,
  random: RandomSource
): void {
  const segments = radius < 30 ? 3 : radius < 72 ? 4 : 5;
  const spin = random() * Math.PI * 2;
  const step = Math.PI * 2 / segments;
  for (let index = 0; index < segments; index += 1) {
    const start = spin + index * step;
    const end = start + step * (0.58 + random() * 0.16);
    const mid = (start + end) * 0.5;
    const bulge = radius * (1.02 + random() * 0.1);
    node.moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
      .quadraticCurveTo(Math.cos(mid) * bulge, Math.sin(mid) * bulge, Math.cos(end) * radius, Math.sin(end) * radius)
      .stroke({ color, width, alpha });
  }
}
