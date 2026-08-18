import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import { getCreatorLayoutGeometry } from '../creatorLayoutGeometry';
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
  const geometry = getCreatorLayoutGeometry(layout);
  if (geometry.id !== 'landscape') throw new Error(`Expected landscape creator geometry, received ${geometry.id}.`);

  drawArenaFrame(ctx, arenaCanvas, geometry.arena, false, cameraFrame);
  drawLandscapeFighterPanel(ctx, scene.left, geometry.fighterPanels.left, LEFT_ACCENT, false);
  drawLandscapeFighterPanel(ctx, scene.right, geometry.fighterPanels.right, RIGHT_ACCENT, true);
  drawResult(ctx, scene.resultCallout, geometry.arena, false);
}
