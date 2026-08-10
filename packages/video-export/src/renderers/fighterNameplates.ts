import type { EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';
import type { BroadcastRect } from '../broadcastLayout';
import {
  projectArenaWorldToSource,
  type BroadcastCameraFrame
} from '../cinematicCamera';
import { roundedRectPath } from './canvasPrimitives';

export interface FighterNameplateArena {
  width: number;
  height: number;
}

export interface FighterNameplateProjection {
  x: number;
  y: number;
  radiusPx: number;
  visible: boolean;
}

export function shouldShowFighterNameplates(participantCount: number): boolean {
  return participantCount > 0 && participantCount <= 4;
}

export function projectFighterNameplate(
  entity: Pick<EntitySnapshot, 'x' | 'y' | 'radius'>,
  arena: FighterNameplateArena,
  arenaCanvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  destination: BroadcastRect,
  cameraFrame: BroadcastCameraFrame
): FighterNameplateProjection {
  const sourcePoint = projectArenaWorldToSource(
    entity,
    Math.max(1, arenaCanvas.width),
    Math.max(1, arenaCanvas.height),
    arena.width,
    arena.height
  );
  const source = cameraFrame.source;
  const scaleX = destination.width / Math.max(1, source.width);
  const scaleY = destination.height / Math.max(1, source.height);
  const x = destination.x + (sourcePoint.x - source.x) * scaleX;
  const centerY = destination.y + (sourcePoint.y - source.y) * scaleY;
  const radiusPx = Math.max(1, entity.radius * sourcePoint.scale * Math.min(scaleX, scaleY));
  const y = centerY - radiusPx;
  const visible = x >= destination.x - radiusPx
    && x <= destination.x + destination.width + radiusPx
    && centerY >= destination.y - radiusPx
    && centerY <= destination.y + destination.height + radiusPx;
  return { x, y, radiusPx, visible };
}

export function drawFighterNameplates(
  ctx: CanvasRenderingContext2D,
  snapshot: WorldSnapshot,
  arena: FighterNameplateArena,
  arenaCanvas: HTMLCanvasElement,
  destination: BroadcastRect,
  cameraFrame: BroadcastCameraFrame,
  fighterNames: ReadonlyMap<string, string>,
  vertical: boolean
): void {
  if (cameraFrame.phase === 'intro' || cameraFrame.phase === 'result' || fighterNames.size === 0) return;

  const fontSize = vertical ? 21 : 18;
  const padding = vertical ? 10 : 8;

  ctx.save();
  roundedRectPath(ctx, destination.x, destination.y, destination.width, destination.height, 18);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `850 ${fontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(1, 5, 12, 0.94)';
  ctx.lineWidth = vertical ? 4.5 : 4;
  ctx.fillStyle = '#f5f9ff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = vertical ? 7 : 6;
  ctx.shadowOffsetY = 2;

  for (const entity of snapshot.entities) {
    if (!entity.alive) continue;
    const name = fighterNames.get(entity.fighterId);
    if (!name) continue;
    const projection = projectFighterNameplate(entity, arena, arenaCanvas, destination, cameraFrame);
    if (!projection.visible) continue;
    const labelY = Math.max(destination.y + fontSize + 6, projection.y - padding);
    ctx.strokeText(name, projection.x, labelY);
    ctx.fillText(name, projection.x, labelY);
  }

  ctx.restore();
}
