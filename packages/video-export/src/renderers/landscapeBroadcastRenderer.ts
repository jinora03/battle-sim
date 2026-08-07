import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import { LEFT_ACCENT, RIGHT_ACCENT, drawArenaFrame } from './canvasPrimitives';
import { drawLandscapeFighterPanel, drawResult } from './fighterHud';

/**
 * Landscape creator view: readable fighter rails flank the arena. The rails
 * are deliberately wider than the first broadcast pass so YouTube phone
 * playback does not reduce fighter information to illegible micro-text.
 */
export function drawLandscapeBroadcast(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  arenaCanvas: HTMLCanvasElement,
  cameraFrame: BroadcastCameraFrame
): void {
  drawArenaFrame(ctx, arenaCanvas, layout.arena, false, cameraFrame);
  drawLandscapeFighterPanel(ctx, scene.left, { x: 20, y: 56, width: 320, height: 968 }, LEFT_ACCENT, false);
  drawLandscapeFighterPanel(ctx, scene.right, { x: 1580, y: 56, width: 320, height: 968 }, RIGHT_ACCENT, true);
  drawResult(ctx, scene.resultCallout, layout.arena, false);
}
