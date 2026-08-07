import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import {
  LEFT_ACCENT,
  RIGHT_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  drawArenaFrame,
  drawPill,
  drawText
} from './canvasPrimitives';
import {
  drawCalloutPanel,
  drawResult,
  drawVerticalFighterHeader,
  drawVerticalInfoPanel
} from './fighterHud';

export function drawVerticalBroadcast(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  arenaCanvas: HTMLCanvasElement,
  cameraFrame: BroadcastCameraFrame
): void {
  drawText(ctx, 'KINETIC BATTLE', 500, 54, 21, 900, '#83c5ff', 'center', 2.8);
  drawText(ctx, `${scene.modeName.toUpperCase()} · ${scene.roundLabel.toUpperCase()}`, 500, 91, 17, 800, TEXT_SECONDARY, 'center', 1.4);
  drawPill(ctx, scene.timerLabel, 431, 112, 138, 42, '#16263b', '#5f91c8', TEXT_PRIMARY, 21);

  drawVerticalFighterHeader(ctx, scene.left, { x: 52, y: 176, width: 432, height: 153 }, LEFT_ACCENT, false);
  drawVerticalFighterHeader(ctx, scene.right, { x: 516, y: 176, width: 432, height: 153 }, RIGHT_ACCENT, true);
  drawText(ctx, 'VS', 500, 208, 18, 900, '#d9e9fa', 'center', 1.2);

  drawArenaFrame(ctx, arenaCanvas, layout.arena, true, cameraFrame);
  drawCalloutPanel(ctx, scene.abilityCallout, { x: 48, y: 1410, width: 900, height: 112 }, LEFT_ACCENT, 'CURRENT ABILITY');
  drawVerticalInfoPanel(ctx, scene.left, { x: 48, y: 1538, width: 438, height: 146 }, LEFT_ACCENT);
  drawVerticalInfoPanel(ctx, scene.right, { x: 510, y: 1538, width: 438, height: 146 }, RIGHT_ACCENT);
  drawCalloutPanel(ctx, scene.eventCallout, { x: 48, y: 1696, width: 900, height: 84 }, RIGHT_ACCENT, 'BATTLE EVENT');
  drawResult(ctx, scene.resultCallout, layout.arena, true);
}
