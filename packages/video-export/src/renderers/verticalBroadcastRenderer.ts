import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import { getCreatorLayoutGeometry } from '../creatorLayoutGeometry';
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
  const geometry = getCreatorLayoutGeometry(layout);
  if (geometry.id !== 'vertical') throw new Error(`Expected vertical creator geometry, received ${geometry.id}.`);

  drawText(
    ctx,
    `${scene.modeName.toUpperCase()} · ${scene.arenaName.toUpperCase()}`,
    geometry.context.centerX,
    geometry.context.modeY,
    19,
    900,
    '#83c5ff',
    'center',
    1.4
  );
  drawText(
    ctx,
    scene.arenaTypeLabel.toUpperCase(),
    geometry.context.centerX,
    geometry.context.arenaTypeY,
    14,
    800,
    TEXT_SECONDARY,
    'center',
    1.1
  );

  // Keep a true center lane for VS while letting both weapon groups lean inward.
  drawVerticalFighterHeader(ctx, scene.left, geometry.fighterHeaders.left, LEFT_ACCENT, false);
  drawVerticalFighterHeader(ctx, scene.right, geometry.fighterHeaders.right, RIGHT_ACCENT, true);
  drawText(ctx, 'VS', geometry.versus.x, geometry.versus.y, 24, 950, '#eef8ff', 'center', 1.1);

  drawArenaFrame(ctx, arenaCanvas, geometry.arena, true, cameraFrame);

  drawVerticalSkillsPanel(ctx, scene.left, geometry.skillsPanels.left, LEFT_ACCENT, false);
  drawVerticalSkillsPanel(ctx, scene.right, geometry.skillsPanels.right, RIGHT_ACCENT, true);
  drawResult(ctx, scene.resultCallout, geometry.arena, true);
}
