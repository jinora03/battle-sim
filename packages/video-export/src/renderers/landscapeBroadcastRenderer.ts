import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import {
  LEFT_ACCENT,
  PANEL_BORDER,
  RIGHT_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  drawArenaFrame,
  drawDivider,
  drawPanel,
  drawPill,
  drawText
} from './canvasPrimitives';
import {
  drawCallout,
  drawLandscapeFighterPanel,
  drawResult
} from './fighterHud';

export function drawLandscapeBroadcast(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  arenaCanvas: HTMLCanvasElement,
  cameraFrame: BroadcastCameraFrame
): void {
  drawText(ctx, 'KINETIC BATTLE', 960, 39, 22, 900, '#81bfff', 'center', 2.8);
  drawText(ctx, `${scene.modeName.toUpperCase()} · ${scene.roundLabel.toUpperCase()} · ${scene.objectiveLabel.toUpperCase()}`, 960, 74, 18, 800, TEXT_SECONDARY, 'center', 1.2);
  drawPill(ctx, scene.timerLabel, 886, 92, 148, 42, '#16263b', '#5f91c8', TEXT_PRIMARY, 21);

  drawArenaFrame(ctx, arenaCanvas, layout.arena, false, cameraFrame);
  drawLandscapeFighterPanel(ctx, scene.left, { x: 28, y: 132, width: 224, height: 818 }, LEFT_ACCENT, false);
  drawLandscapeFighterPanel(ctx, scene.right, { x: 1668, y: 132, width: 224, height: 818 }, RIGHT_ACCENT, true);

  drawPanel(ctx, 280, 968, 1360, 84, 18, 'rgba(8, 15, 28, 0.96)', PANEL_BORDER);
  drawDivider(ctx, 960, 982, 960, 1038);
  drawCallout(ctx, scene.abilityCallout, { x: 310, y: 981, width: 620, height: 57 }, LEFT_ACCENT, 'CURRENT ABILITY');
  drawCallout(ctx, scene.eventCallout, { x: 990, y: 981, width: 620, height: 57 }, RIGHT_ACCENT, 'BATTLE EVENT');
  drawResult(ctx, scene.resultCallout, layout.arena, false);
}
