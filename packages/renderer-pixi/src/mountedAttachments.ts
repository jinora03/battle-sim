import { Graphics } from 'pixi.js';
import type { MountedAttachmentDefinition } from '@kinetic/content';

export type MountedAttachmentLod = 'hero' | 'standard' | 'army';

export interface MountedAttachmentRenderContext {
  entityId: number;
  radius: number;
  elapsedSeconds: number;
  counterRotation: number;
  reducedMotion: boolean;
  lod: MountedAttachmentLod;
}

export interface MountedAttachmentPose {
  x: number;
  y: number;
  angle: number;
  scale: number;
}

const DEFAULT_OUTLINE_COLOR = 0xf7fcff;
const DEFAULT_OUTLINE_WIDTH_SCALE = 0.065;

const DEFAULT_MOUNT_OFFSETS: Record<MountedAttachmentDefinition['mountPoint'], { forward: number; lateral: number }> = {
  front: { forward: 1.24, lateral: 0 },
  rear: { forward: -1.16, lateral: 0 },
  left: { forward: 0, lateral: -1.16 },
  right: { forward: 0, lateral: 1.16 },
  top: { forward: 0.28, lateral: -1.08 },
  orbit: { forward: 0, lateral: 0 }
};

function attachmentPhase(id: string, entityId: number): number {
  let hash = entityId * 97;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return ((hash >>> 0) % 6283) / 1000;
}

/**
 * Resolves a radius-relative white silhouette width. The square-root scale
 * keeps large attachments outlined without allowing their stroke to dominate.
 */
export function resolveMountedAttachmentOutlineWidth(
  attachment: MountedAttachmentDefinition,
  context: Pick<MountedAttachmentRenderContext, 'radius' | 'lod'>,
  poseScale = attachment.scale ?? 1
): number {
  const lodMultiplier = context.lod === 'hero' ? 1 : context.lod === 'standard' ? 0.9 : 0.72;
  return Math.max(
    context.lod === 'army' ? 1.5 : 2.5,
    context.radius
      * (attachment.outlineWidthScale ?? DEFAULT_OUTLINE_WIDTH_SCALE)
      * Math.sqrt(Math.max(0.5, poseScale))
      * lodMultiplier
  );
}

export function resolveMountedAttachmentPose(
  attachment: MountedAttachmentDefinition,
  context: MountedAttachmentRenderContext
): MountedAttachmentPose {
  const fallback = DEFAULT_MOUNT_OFFSETS[attachment.mountPoint];
  const scale = Math.max(0.25, attachment.scale ?? 1);

  if (attachment.mountPoint === 'orbit' || attachment.rotationMode === 'orbit') {
    const orbitRadius = context.radius * Math.max(1, attachment.orbitRadius ?? 1.72);
    const speed = context.reducedMotion ? 0 : attachment.orbitSpeed ?? 1.5;
    const worldAngle = attachmentPhase(attachment.id, context.entityId) + context.elapsedSeconds * speed;
    const localAngle = worldAngle + context.counterRotation;
    return {
      x: Math.cos(localAngle) * orbitRadius,
      y: Math.sin(localAngle) * orbitRadius,
      angle: context.counterRotation,
      scale
    };
  }

  return {
    x: context.radius * (attachment.forward ?? fallback.forward),
    y: context.radius * (attachment.lateral ?? fallback.lateral),
    angle: attachment.rotationMode === 'counter-rotate' ? context.counterRotation : 0,
    scale
  };
}

export function drawMountedAttachments(
  graphics: Graphics,
  attachments: readonly MountedAttachmentDefinition[],
  context: MountedAttachmentRenderContext
): void {
  graphics.clear();
  if (attachments.length === 0) return;

  for (const attachment of attachments) {
    if (context.lod === 'army' && attachment.hideInMassBattle !== false) continue;
    const pose = resolveMountedAttachmentPose(attachment, context);
    switch (attachment.kind) {
      case 'targeting-drone':
        drawTargetingDrone(graphics, attachment, pose, context);
        break;
      case 'missile-pod':
        drawMissilePod(graphics, attachment, pose, context);
        break;
      case 'ammo-drum':
        drawAmmoDrum(graphics, attachment, pose, context);
        break;
      case 'deflector-plate':
        drawDeflectorPlate(graphics, attachment, pose, context);
        break;
      case 'thruster':
        drawThruster(graphics, attachment, pose, context);
        break;
      case 'ember-satellite':
        drawEmberSatellite(graphics, attachment, pose, context);
        break;
      case 'flamethrower':
        drawFlamethrowerRig(graphics, attachment, pose, context);
        break;
    }
  }
}

function drawFlamethrowerRig(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = Math.max(8, context.radius * 0.42 * pose.scale);
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);

  if (attachment.mountPoint === 'rear') {
    const hoseStart = transformPoint(pose, size * 0.35, 0);
    graphics.moveTo(0, 0).lineTo(hoseStart.x, hoseStart.y)
      .stroke({ color: outlineColor, width: Math.max(2.2, outlineWidth * 0.72), alpha: 0.9 });
    graphics.moveTo(0, 0).lineTo(hoseStart.x, hoseStart.y)
      .stroke({ color: 0x24120f, width: Math.max(1.3, outlineWidth * 0.38), alpha: 1 });
    drawRotatedRect(
      graphics,
      pose,
      0,
      0,
      size * 0.92,
      size * 1.42,
      { color: attachment.primaryColor, alpha: 1 },
      { color: outlineColor, alpha: 0.98, width: outlineWidth }
    );
    drawRotatedRect(
      graphics,
      pose,
      0,
      0,
      size * 0.68,
      size * 1.14,
      { color: attachment.accentColor, alpha: 0.9 }
    );
    const cap = transformPoint(pose, size * 0.02, -size * 0.82);
    graphics.circle(cap.x, cap.y, size * 0.18).fill({ color: glow, alpha: 0.95 });
    graphics.circle(cap.x, cap.y, size * 0.18)
      .stroke({ color: outlineColor, width: Math.max(1.2, outlineWidth * 0.42), alpha: 0.92 });
    return;
  }

  const bracket = transformPoint(pose, -size * 0.58, 0);
  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: outlineColor, width: Math.max(3.2, outlineWidth * 1.2), alpha: 0.94 });
  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(2.1, outlineWidth * 0.64), alpha: 1 });

  drawRotatedRect(
    graphics,
    pose,
    0,
    0,
    size * 1.5,
    size * 0.62,
    { color: attachment.primaryColor, alpha: 1 },
    { color: outlineColor, alpha: 0.98, width: outlineWidth }
  );
  drawRotatedRect(
    graphics,
    pose,
    size * 0.2,
    0,
    size * 0.86,
    size * 0.38,
    { color: attachment.accentColor, alpha: 0.94 }
  );
  const nozzle = transformPoint(pose, size * 0.86, 0);
  graphics.circle(nozzle.x, nozzle.y, size * 0.25).fill({ color: 0x101014, alpha: 1 });
  graphics.circle(nozzle.x, nozzle.y, size * 0.25)
    .stroke({ color: outlineColor, width: Math.max(1.4, outlineWidth * 0.48), alpha: 0.96 });
  graphics.circle(nozzle.x, nozzle.y, size * 0.14).fill({ color: glow, alpha: 0.94 });

  const pilot = context.reducedMotion ? 0.68 : 0.72 + Math.sin(context.elapsedSeconds * 15 + context.entityId) * 0.18;
  const baseTop = transformPoint(pose, size * 1.02, -size * 0.16);
  const tip = transformPoint(pose, size * (1.38 + pilot * 0.18), 0);
  const baseBottom = transformPoint(pose, size * 1.02, size * 0.16);
  drawPolygon(
    graphics,
    [baseTop, tip, baseBottom],
    { color: glow, alpha: 0.42 + pilot * 0.24 },
    { color: outlineColor, alpha: 0.22, width: Math.max(1, outlineWidth * 0.22) }
  );
}

function drawEmberSatellite(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = Math.max(7, context.radius * 0.3 * pose.scale);
  const pulse = context.reducedMotion
    ? 0.8
    : 0.76 + Math.sin(context.elapsedSeconds * 7.5 + attachmentPhase(attachment.id, context.entityId)) * 0.18;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);

  if (attachment.mountPoint === 'orbit' || attachment.rotationMode === 'orbit') {
    graphics.moveTo(0, 0).lineTo(pose.x, pose.y)
      .stroke({ color: glow, width: Math.max(1.2, outlineWidth * 0.3), alpha: 0.24 });
  }
  graphics.circle(pose.x, pose.y, size * (1.85 + pulse * 0.2)).fill({ color: glow, alpha: 0.1 + pulse * 0.08 });
  graphics.circle(pose.x, pose.y, size * 1.24)
    .stroke({ color: outlineColor, width: Math.max(1.8, outlineWidth * 0.74), alpha: 0.88 });
  graphics.circle(pose.x, pose.y, size * 1.08).fill({ color: attachment.primaryColor, alpha: 0.98 });
  graphics.circle(pose.x, pose.y, size * 0.78).fill({ color: attachment.accentColor, alpha: 0.98 });
  graphics.circle(pose.x, pose.y, size * (0.35 + pulse * 0.08)).fill({ color: 0xfff3ad, alpha: 1 });

  for (let index = 0; index < 3; index += 1) {
    const angle = context.elapsedSeconds * (context.reducedMotion ? 0 : 2.4)
      + index * Math.PI * 2 / 3
      + attachmentPhase(attachment.id, context.entityId);
    const inner = size * 1.05;
    const outer = size * (1.62 + pulse * 0.16);
    const start = { x: pose.x + Math.cos(angle) * inner, y: pose.y + Math.sin(angle) * inner };
    const tip = { x: pose.x + Math.cos(angle + 0.18) * outer, y: pose.y + Math.sin(angle + 0.18) * outer };
    const end = { x: pose.x + Math.cos(angle + 0.36) * inner, y: pose.y + Math.sin(angle + 0.36) * inner };
    drawPolygon(
      graphics,
      [start, tip, end],
      { color: index === 0 ? 0xffef74 : 0xff6a24, alpha: 0.62 + pulse * 0.18 },
      { color: outlineColor, alpha: 0.32, width: Math.max(1, outlineWidth * 0.24) }
    );
  }
}

function transformPoint(pose: MountedAttachmentPose, x: number, y: number): { x: number; y: number } {
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  return {
    x: pose.x + x * cosine - y * sine,
    y: pose.y + x * sine + y * cosine
  };
}

function traceClosedPolygon(graphics: Graphics, points: readonly { x: number; y: number }[]): void {
  const first = points[0];
  if (!first) return;
  graphics.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (point) graphics.lineTo(point.x, point.y);
  }
  graphics.lineTo(first.x, first.y);
}

function drawPolygon(
  graphics: Graphics,
  points: readonly { x: number; y: number }[],
  fill: { color: number; alpha: number },
  stroke?: { color: number; alpha: number; width: number }
): void {
  traceClosedPolygon(graphics, points);
  graphics.fill(fill);
  if (stroke) {
    traceClosedPolygon(graphics, points);
    graphics.stroke(stroke);
  }
}

function rotatedRectPoints(
  pose: MountedAttachmentPose,
  centerX: number,
  centerY: number,
  width: number,
  height: number
): { x: number; y: number }[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    transformPoint(pose, centerX - halfWidth, centerY - halfHeight),
    transformPoint(pose, centerX + halfWidth, centerY - halfHeight),
    transformPoint(pose, centerX + halfWidth, centerY + halfHeight),
    transformPoint(pose, centerX - halfWidth, centerY + halfHeight)
  ];
}

function drawRotatedRect(
  graphics: Graphics,
  pose: MountedAttachmentPose,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  fill: { color: number; alpha: number },
  stroke?: { color: number; alpha: number; width: number }
): void {
  drawPolygon(graphics, rotatedRectPoints(pose, centerX, centerY, width, height), fill, stroke);
}

function drawTargetingDrone(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = Math.max(7, context.radius * 0.27 * pose.scale);
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);

  graphics.moveTo(0, 0).lineTo(pose.x, pose.y)
    .stroke({ color: outlineColor, width: Math.max(1.3, outlineWidth * 0.48), alpha: 0.42 });
  graphics.moveTo(0, 0).lineTo(pose.x, pose.y)
    .stroke({ color: glow, width: Math.max(1, outlineWidth * 0.24), alpha: 0.58 });
  graphics.circle(pose.x, pose.y, size * 2).fill({ color: glow, alpha: 0.13 });
  graphics.circle(pose.x, pose.y, size * 1.42)
    .stroke({ color: outlineColor, width: Math.max(1.6, outlineWidth * 0.72), alpha: 0.78 });
  graphics.circle(pose.x, pose.y, size * 1.33)
    .stroke({ color: glow, width: Math.max(1.4, size * 0.13), alpha: 0.7 });

  const points = [
    transformPoint(pose, -size * 1.32, 0),
    transformPoint(pose, 0, -size * 0.9),
    transformPoint(pose, size * 1.32, 0),
    transformPoint(pose, 0, size * 0.9)
  ];
  drawPolygon(
    graphics,
    points,
    { color: attachment.primaryColor, alpha: 1 },
    { color: outlineColor, alpha: 0.98, width: outlineWidth }
  );
  graphics.circle(pose.x, pose.y, size * 0.68)
    .fill({ color: attachment.accentColor, alpha: 0.98 });
  graphics.circle(pose.x, pose.y, size * 0.68)
    .stroke({ color: outlineColor, width: Math.max(1.2, outlineWidth * 0.46), alpha: 0.94 });
  graphics.circle(pose.x, pose.y, size * 0.28).fill({ color: 0xffffff, alpha: 0.96 });
}

function drawMissilePod(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = context.radius * 0.52 * pose.scale;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);
  const bracket = transformPoint(pose, -size * 0.9, 0);

  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: outlineColor, width: Math.max(4, size * 0.18 + outlineWidth), alpha: 0.92 });
  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(3, size * 0.16), alpha: 1 });

  drawRotatedRect(
    graphics,
    pose,
    0,
    0,
    size * 1.44,
    size * 1.1,
    { color: 0x101820, alpha: 1 },
    { color: outlineColor, alpha: 0.98, width: outlineWidth }
  );
  drawRotatedRect(graphics, pose, 0, 0, size * 1.22, size * 0.9, { color: attachment.primaryColor, alpha: 1 });
  drawRotatedRect(
    graphics,
    pose,
    0,
    0,
    size * 1.24,
    size * 0.92,
    { color: 0x000000, alpha: 0 },
    { color: attachment.accentColor, alpha: 0.92, width: Math.max(1.8, size * 0.075) }
  );

  for (const x of [-0.22, 0.3]) {
    for (const y of [-0.25, 0.25]) {
      const point = transformPoint(pose, size * x, size * y);
      graphics.circle(point.x, point.y, size * 0.205).fill({ color: 0x0b1118, alpha: 1 });
      graphics.circle(point.x, point.y, size * 0.205)
        .stroke({ color: outlineColor, width: Math.max(1.1, outlineWidth * 0.34), alpha: 0.88 });
      graphics.circle(point.x, point.y, size * 0.14).fill({ color: glow, alpha: 0.98 });
      graphics.circle(point.x, point.y, size * 0.06).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  const railStart = transformPoint(pose, -size * 0.52, -size * 0.58);
  const railEnd = transformPoint(pose, size * 0.52, -size * 0.58);
  graphics.moveTo(railStart.x, railStart.y).lineTo(railEnd.x, railEnd.y)
    .stroke({ color: outlineColor, width: Math.max(1.8, size * 0.08 + outlineWidth * 0.25), alpha: 0.82 });
  graphics.moveTo(railStart.x, railStart.y).lineTo(railEnd.x, railEnd.y)
    .stroke({ color: glow, width: Math.max(1.4, size * 0.055), alpha: 0.92 });
}


function drawAmmoDrum(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = Math.max(9, context.radius * 0.46 * pose.scale);
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);
  const bracket = transformPoint(pose, -size * 0.82, 0);

  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: outlineColor, width: Math.max(3.4, outlineWidth * 1.15), alpha: 0.94 });
  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(2.2, outlineWidth * 0.66), alpha: 1 });

  graphics.circle(pose.x, pose.y, size * 0.72).fill({ color: 0x111821, alpha: 1 });
  graphics.circle(pose.x, pose.y, size * 0.72)
    .stroke({ color: outlineColor, width: outlineWidth, alpha: 0.98 });
  graphics.circle(pose.x, pose.y, size * 0.57)
    .stroke({ color: attachment.primaryColor, width: Math.max(3, size * 0.14), alpha: 1 });
  graphics.circle(pose.x, pose.y, size * 0.34).fill({ color: attachment.accentColor, alpha: 0.96 });
  graphics.circle(pose.x, pose.y, size * 0.15).fill({ color: glow, alpha: 0.98 });

  const spin = context.reducedMotion ? 0 : context.elapsedSeconds * 5.2 + context.entityId * 0.37;
  for (let index = 0; index < 6; index += 1) {
    const angle = spin + index * Math.PI / 3;
    const point = transformPoint(pose, Math.cos(angle) * size * 0.47, Math.sin(angle) * size * 0.47);
    graphics.circle(point.x, point.y, size * 0.075).fill({ color: 0xffd36a, alpha: 0.94 });
  }

  const feedStart = transformPoint(pose, size * 0.52, size * 0.18);
  const feedEnd = transformPoint(pose, size * 1.08, size * 0.05);
  graphics.moveTo(feedStart.x, feedStart.y).lineTo(feedEnd.x, feedEnd.y)
    .stroke({ color: outlineColor, width: Math.max(2.2, outlineWidth * 0.68), alpha: 0.9 });
  graphics.moveTo(feedStart.x, feedStart.y).lineTo(feedEnd.x, feedEnd.y)
    .stroke({ color: attachment.accentColor, width: Math.max(1.4, outlineWidth * 0.36), alpha: 1 });
}

function drawDeflectorPlate(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const halfHeight = context.radius * 0.76 * pose.scale;
  const depth = context.radius * 0.32 * pose.scale;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);
  const outerStart = transformPoint(pose, -depth, -halfHeight);
  const outerControl = transformPoint(pose, depth * 1.42, 0);
  const outerEnd = transformPoint(pose, -depth, halfHeight);
  const primaryWidth = Math.max(6.5, context.radius * 0.2 * pose.scale);

  graphics
    .moveTo(outerStart.x, outerStart.y)
    .quadraticCurveTo(outerControl.x, outerControl.y, outerEnd.x, outerEnd.y)
    .stroke({ color: glow, width: primaryWidth + outlineWidth * 3.6, alpha: 0.2 });
  graphics
    .moveTo(outerStart.x, outerStart.y)
    .quadraticCurveTo(outerControl.x, outerControl.y, outerEnd.x, outerEnd.y)
    .stroke({ color: outlineColor, width: primaryWidth + outlineWidth * 2, alpha: 0.98 });
  graphics
    .moveTo(outerStart.x, outerStart.y)
    .quadraticCurveTo(outerControl.x, outerControl.y, outerEnd.x, outerEnd.y)
    .stroke({ color: attachment.primaryColor, width: primaryWidth, alpha: 1 });

  const innerStart = transformPoint(pose, 0, -halfHeight * 0.84);
  const innerControl = transformPoint(pose, depth * 1.6, 0);
  const innerEnd = transformPoint(pose, 0, halfHeight * 0.84);
  graphics
    .moveTo(innerStart.x, innerStart.y)
    .quadraticCurveTo(innerControl.x, innerControl.y, innerEnd.x, innerEnd.y)
    .stroke({ color: outlineColor, width: Math.max(3, context.radius * 0.075) + outlineWidth, alpha: 0.92 });
  graphics
    .moveTo(innerStart.x, innerStart.y)
    .quadraticCurveTo(innerControl.x, innerControl.y, innerEnd.x, innerEnd.y)
    .stroke({ color: attachment.accentColor, width: Math.max(2.4, context.radius * 0.065), alpha: 0.98 });

  const upperAnchor = transformPoint(pose, -depth * 1.18, -halfHeight * 0.42);
  const lowerAnchor = transformPoint(pose, -depth * 1.18, halfHeight * 0.42);
  graphics.moveTo(0, 0).lineTo(upperAnchor.x, upperAnchor.y)
    .moveTo(0, 0).lineTo(lowerAnchor.x, lowerAnchor.y)
    .stroke({ color: outlineColor, width: Math.max(2.6, context.radius * 0.075) + outlineWidth * 0.45, alpha: 0.9 });
  graphics.moveTo(0, 0).lineTo(upperAnchor.x, upperAnchor.y)
    .moveTo(0, 0).lineTo(lowerAnchor.x, lowerAnchor.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(2, context.radius * 0.065), alpha: 1 });

  const core = transformPoint(pose, depth * 0.42, 0);
  graphics.circle(core.x, core.y, Math.max(4, context.radius * 0.11))
    .fill({ color: glow, alpha: 0.98 });
  graphics.circle(core.x, core.y, Math.max(4, context.radius * 0.11))
    .stroke({ color: outlineColor, width: Math.max(1.4, outlineWidth * 0.5), alpha: 0.95 });
  graphics.circle(core.x, core.y, Math.max(1.6, context.radius * 0.045))
    .fill({ color: 0xffffff, alpha: 0.94 });
}

function drawThruster(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = context.radius * 0.47 * pose.scale;
  const pulse = context.reducedMotion ? 0.72 : 0.76 + Math.sin(context.elapsedSeconds * 13 + pose.y) * 0.18;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outlineColor = attachment.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  const outlineWidth = resolveMountedAttachmentOutlineWidth(attachment, context, pose.scale);

  drawRotatedRect(
    graphics,
    pose,
    0,
    0,
    size * 1.02,
    size * 1.22,
    { color: 0x101820, alpha: 1 },
    { color: outlineColor, alpha: 0.98, width: outlineWidth }
  );
  drawRotatedRect(graphics, pose, size * 0.04, 0, size * 0.8, size * 1.04, { color: attachment.primaryColor, alpha: 1 });
  drawRotatedRect(graphics, pose, size * 0.12, 0, size * 0.36, size * 0.74, { color: attachment.accentColor, alpha: 0.92 });

  const nozzle = transformPoint(pose, -size * 0.45, 0);
  graphics.circle(nozzle.x, nozzle.y, size * 0.34).fill({ color: 0x0a1016, alpha: 1 });
  graphics.circle(nozzle.x, nozzle.y, size * 0.34)
    .stroke({ color: outlineColor, width: Math.max(1.3, outlineWidth * 0.44), alpha: 0.94 });
  graphics.circle(nozzle.x, nozzle.y, size * 0.23).fill({ color: glow, alpha: 0.9 });

  const flameLength = size * (1.38 + pulse * 0.82);
  const flameTop = transformPoint(pose, -size * 0.47, -size * 0.3);
  const flameTip = transformPoint(pose, -size * 0.47 - flameLength, 0);
  const flameBottom = transformPoint(pose, -size * 0.47, size * 0.3);
  drawPolygon(
    graphics,
    [flameTop, flameTip, flameBottom],
    { color: glow, alpha: 0.36 + pulse * 0.34 },
    { color: outlineColor, alpha: 0.4, width: Math.max(1, outlineWidth * 0.3) }
  );

  const innerTop = transformPoint(pose, -size * 0.49, -size * 0.14);
  const innerTip = transformPoint(pose, -size * 0.49 - flameLength * 0.66, 0);
  const innerBottom = transformPoint(pose, -size * 0.49, size * 0.14);
  drawPolygon(graphics, [innerTop, innerTip, innerBottom], { color: 0xffffff, alpha: 0.46 + pulse * 0.32 });
}
