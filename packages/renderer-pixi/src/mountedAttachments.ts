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

const DEFAULT_MOUNT_OFFSETS: Record<MountedAttachmentDefinition['mountPoint'], { forward: number; lateral: number }> = {
  front: { forward: 1.12, lateral: 0 },
  rear: { forward: -1.04, lateral: 0 },
  left: { forward: 0, lateral: -1.04 },
  right: { forward: 0, lateral: 1.04 },
  top: { forward: 0.22, lateral: -0.96 },
  orbit: { forward: 0, lateral: 0 }
};

function attachmentPhase(id: string, entityId: number): number {
  let hash = entityId * 97;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return ((hash >>> 0) % 6283) / 1000;
}

export function resolveMountedAttachmentPose(
  attachment: MountedAttachmentDefinition,
  context: MountedAttachmentRenderContext
): MountedAttachmentPose {
  const fallback = DEFAULT_MOUNT_OFFSETS[attachment.mountPoint];
  const scale = Math.max(0.25, attachment.scale ?? 1);

  if (attachment.mountPoint === 'orbit' || attachment.rotationMode === 'orbit') {
    const orbitRadius = context.radius * Math.max(1, attachment.orbitRadius ?? 1.6);
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
      case 'deflector-plate':
        drawDeflectorPlate(graphics, attachment, pose, context);
        break;
      case 'thruster':
        drawThruster(graphics, attachment, pose, context);
        break;
    }
  }
}

function drawTargetingDrone(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = Math.max(5, context.radius * 0.23 * pose.scale);
  const glow = attachment.glowColor ?? attachment.accentColor;
  graphics.moveTo(0, 0).lineTo(pose.x, pose.y).stroke({ color: glow, width: 1.6, alpha: 0.3 });
  graphics.circle(pose.x, pose.y, size * 2).fill({ color: glow, alpha: 0.12 });
  graphics.circle(pose.x, pose.y, size * 1.34).stroke({ color: glow, width: Math.max(1.5, size * 0.16), alpha: 0.64 });

  const left = transformPoint(pose, -size * 1.25, 0);
  const top = transformPoint(pose, 0, -size * 0.82);
  const right = transformPoint(pose, size * 1.25, 0);
  const bottom = transformPoint(pose, 0, size * 0.82);
  graphics
    .moveTo(left.x, left.y)
    .lineTo(top.x, top.y)
    .lineTo(right.x, right.y)
    .lineTo(bottom.x, bottom.y)
    .lineTo(left.x, left.y)
    .fill({ color: attachment.primaryColor, alpha: 1 });
  graphics.circle(pose.x, pose.y, size * 0.62).fill({ color: attachment.accentColor, alpha: 0.98 });
  graphics.circle(pose.x, pose.y, size * 0.26).fill({ color: 0xffffff, alpha: 0.9 });
}

function transformPoint(pose: MountedAttachmentPose, x: number, y: number): { x: number; y: number } {
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  return {
    x: pose.x + x * cosine - y * sine,
    y: pose.y + x * sine + y * cosine
  };
}

function drawRotatedRect(
  graphics: Graphics,
  pose: MountedAttachmentPose,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  style: { color: number; alpha: number },
  strokeWidth = 0
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const points = [
    transformPoint(pose, centerX - halfWidth, centerY - halfHeight),
    transformPoint(pose, centerX + halfWidth, centerY - halfHeight),
    transformPoint(pose, centerX + halfWidth, centerY + halfHeight),
    transformPoint(pose, centerX - halfWidth, centerY + halfHeight)
  ];
  graphics.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index]!.x, points[index]!.y);
  graphics.lineTo(points[0]!.x, points[0]!.y);
  if (strokeWidth > 0) graphics.stroke({ color: style.color, width: strokeWidth, alpha: style.alpha });
  else graphics.fill(style);
}

function drawMissilePod(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = context.radius * 0.46 * pose.scale;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const bracket = transformPoint(pose, -size * 0.88, 0);
  graphics.moveTo(0, 0).lineTo(bracket.x, bracket.y).stroke({ color: attachment.primaryColor, width: Math.max(3, size * 0.16), alpha: 0.9 });

  drawRotatedRect(graphics, pose, 0, 0, size * 1.38, size * 1.04, { color: 0x101820, alpha: 1 });
  drawRotatedRect(graphics, pose, 0, 0, size * 1.2, size * 0.88, { color: attachment.primaryColor, alpha: 1 });
  drawRotatedRect(
    graphics,
    pose,
    0,
    0,
    size * 1.22,
    size * 0.9,
    { color: attachment.accentColor, alpha: 0.9 },
    Math.max(1.6, size * 0.08)
  );

  for (const x of [-0.2, 0.28]) {
    for (const y of [-0.24, 0.24]) {
      const point = transformPoint(pose, size * x, size * y);
      graphics.circle(point.x, point.y, size * 0.19).fill({ color: 0x0b1118, alpha: 1 });
      graphics.circle(point.x, point.y, size * 0.13).fill({ color: glow, alpha: 0.96 });
      graphics.circle(point.x, point.y, size * 0.055).fill({ color: 0xffffff, alpha: 0.82 });
    }
  }

  const railStart = transformPoint(pose, -size * 0.5, -size * 0.56);
  const railEnd = transformPoint(pose, size * 0.5, -size * 0.56);
  graphics.moveTo(railStart.x, railStart.y).lineTo(railEnd.x, railEnd.y)
    .stroke({ color: glow, width: Math.max(1.5, size * 0.07), alpha: 0.76 });
}

function drawDeflectorPlate(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const halfHeight = context.radius * 0.7 * pose.scale;
  const depth = context.radius * 0.28 * pose.scale;
  const glow = attachment.glowColor ?? attachment.accentColor;
  const outerStart = transformPoint(pose, -depth, -halfHeight);
  const outerControl = transformPoint(pose, depth * 1.35, 0);
  const outerEnd = transformPoint(pose, -depth, halfHeight);

  graphics
    .moveTo(outerStart.x, outerStart.y)
    .quadraticCurveTo(outerControl.x, outerControl.y, outerEnd.x, outerEnd.y)
    .stroke({ color: glow, width: Math.max(8, context.radius * 0.25 * pose.scale), alpha: 0.2 });
  graphics
    .moveTo(outerStart.x, outerStart.y)
    .quadraticCurveTo(outerControl.x, outerControl.y, outerEnd.x, outerEnd.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(5.5, context.radius * 0.18 * pose.scale), alpha: 1 });

  const innerStart = transformPoint(pose, 0, -halfHeight * 0.84);
  const innerControl = transformPoint(pose, depth * 1.55, 0);
  const innerEnd = transformPoint(pose, 0, halfHeight * 0.84);
  graphics
    .moveTo(innerStart.x, innerStart.y)
    .quadraticCurveTo(innerControl.x, innerControl.y, innerEnd.x, innerEnd.y)
    .stroke({ color: attachment.accentColor, width: Math.max(2.4, context.radius * 0.065), alpha: 0.98 });

  const upperAnchor = transformPoint(pose, -depth * 1.15, -halfHeight * 0.42);
  const lowerAnchor = transformPoint(pose, -depth * 1.15, halfHeight * 0.42);
  graphics.moveTo(0, 0).lineTo(upperAnchor.x, upperAnchor.y)
    .moveTo(0, 0).lineTo(lowerAnchor.x, lowerAnchor.y)
    .stroke({ color: attachment.primaryColor, width: Math.max(2, context.radius * 0.07), alpha: 0.82 });

  const core = transformPoint(pose, depth * 0.38, 0);
  graphics.circle(core.x, core.y, Math.max(3, context.radius * 0.1))
    .fill({ color: glow, alpha: 0.96 });
  graphics.circle(core.x, core.y, Math.max(1.4, context.radius * 0.042))
    .fill({ color: 0xffffff, alpha: 0.88 });
}

function drawThruster(
  graphics: Graphics,
  attachment: MountedAttachmentDefinition,
  pose: MountedAttachmentPose,
  context: MountedAttachmentRenderContext
): void {
  const size = context.radius * 0.4 * pose.scale;
  const pulse = context.reducedMotion ? 0.72 : 0.76 + Math.sin(context.elapsedSeconds * 13 + pose.y) * 0.18;
  const glow = attachment.glowColor ?? attachment.accentColor;

  drawRotatedRect(graphics, pose, 0, 0, size * 0.96, size * 1.16, { color: 0x101820, alpha: 1 });
  drawRotatedRect(graphics, pose, size * 0.04, 0, size * 0.78, size, { color: attachment.primaryColor, alpha: 1 });
  drawRotatedRect(graphics, pose, size * 0.12, 0, size * 0.34, size * 0.72, { color: attachment.accentColor, alpha: 0.9 });

  const nozzle = transformPoint(pose, -size * 0.42, 0);
  graphics.circle(nozzle.x, nozzle.y, size * 0.32).fill({ color: 0x0a1016, alpha: 1 });
  graphics.circle(nozzle.x, nozzle.y, size * 0.22).fill({ color: glow, alpha: 0.88 });

  const flameLength = size * (1.25 + pulse * 0.72);
  const flameTop = transformPoint(pose, -size * 0.44, -size * 0.28);
  const flameTip = transformPoint(pose, -size * 0.44 - flameLength, 0);
  const flameBottom = transformPoint(pose, -size * 0.44, size * 0.28);
  graphics
    .moveTo(flameTop.x, flameTop.y)
    .lineTo(flameTip.x, flameTip.y)
    .lineTo(flameBottom.x, flameBottom.y)
    .fill({ color: glow, alpha: 0.34 + pulse * 0.34 });

  const innerTop = transformPoint(pose, -size * 0.46, -size * 0.13);
  const innerTip = transformPoint(pose, -size * 0.46 - flameLength * 0.64, 0);
  const innerBottom = transformPoint(pose, -size * 0.46, size * 0.13);
  graphics
    .moveTo(innerTop.x, innerTop.y)
    .lineTo(innerTip.x, innerTip.y)
    .lineTo(innerBottom.x, innerBottom.y)
    .fill({ color: 0xffffff, alpha: 0.42 + pulse * 0.32 });
}
