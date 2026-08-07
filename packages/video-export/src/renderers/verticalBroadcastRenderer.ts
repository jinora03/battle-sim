import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import {
  LEFT_ACCENT,
  RIGHT_ACCENT,
  TEXT_SECONDARY,
  drawArenaFrame,
  drawText
} from './canvasPrimitives';
import { drawResult, drawVerticalFighterHeader, drawVerticalSkillsPanel } from './fighterHud';

/**
 * Shorts/Reels battle view: restore the fuller creator composition while
 * keeping permanent clutter limited to matchup identity, arena context,
 * the action itself, and useful skill readiness below the arena.
 */
export function drawVerticalBroadcast(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  arenaCanvas: HTMLCanvasElement,
  cameraFrame: BroadcastCameraFrame
): void {
  drawText(ctx, `${scene.modeName.toUpperCase()} · ${scene.arenaName.toUpperCase()}`, 540, 58, 16, 900, '#83c5ff', 'center', 1.4);
  drawText(ctx, scene.arenaTypeLabel.toUpperCase(), 540, 84, 12, 800, TEXT_SECONDARY, 'center', 1.1);

  drawVerticalFighterHeader(ctx, scene.left, { x: 40, y: 112, width: 470, height: 200 }, LEFT_ACCENT, false);
  drawVerticalFighterHeader(ctx, scene.right, { x: 570, y: 112, width: 470, height: 200 }, RIGHT_ACCENT, true);
  drawText(ctx, 'VS', 540, 220, 24, 950, '#eef8ff', 'center', 1.1);

  drawArenaFrame(ctx, arenaCanvas, layout.arena, true, cameraFrame);

  drawVerticalSkillsPanel(ctx, scene.left, { x: 40, y: 1380, width: 490, height: 420 }, LEFT_ACCENT, false);
  drawVerticalSkillsPanel(ctx, scene.right, { x: 550, y: 1380, width: 490, height: 420 }, RIGHT_ACCENT, true);
  drawResult(ctx, scene.resultCallout, layout.arena, true);
}
