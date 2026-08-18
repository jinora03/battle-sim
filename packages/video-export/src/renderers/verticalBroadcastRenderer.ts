import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';
import { getCreatorLayoutGeometry } from '../creatorLayoutGeometry';
import { resolveCreatorFighterName, resolveMatchupHook } from '../creatorMatchupHook';
import {
  LEFT_ACCENT,
  RIGHT_ACCENT,
  TEXT_SECONDARY,
  drawArenaFrame,
  drawText
} from './canvasPrimitives';
import { drawResult, drawVerticalFighterHeader, drawVerticalLiveStatus } from './fighterHud';

const MATCHUP_OVERLAY_TICKS = 90; // 1.5s at the authoritative 60 Hz simulation rate.
const MATCHUP_FADE_START_TICK = 60; // Hold for ~1.0s, then ease away over ~0.5s.
const MATCHUP_OVERLAY_OFFSET_Y = 118;

/**
 * Arena-first Shorts/Reels battle view. Persistent information is limited to
 * fighter identity and compact live combat state so the fight owns most of
 * the vertical canvas.
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

  drawVerticalFighterHeader(ctx, scene.left, geometry.fighterHeaders.left, LEFT_ACCENT, false);
  drawVerticalFighterHeader(ctx, scene.right, geometry.fighterHeaders.right, RIGHT_ACCENT, true);
  drawText(ctx, 'VS', geometry.versus.x, geometry.versus.y, 24, 950, '#eef8ff', 'center', 1.1);

  drawArenaFrame(ctx, arenaCanvas, geometry.arena, true, cameraFrame);
  drawLiveMatchupOverlay(ctx, scene, geometry.arena);

  drawVerticalLiveStatus(ctx, scene.left, geometry.liveStatusPanels.left, LEFT_ACCENT, false);
  drawVerticalLiveStatus(ctx, scene.right, geometry.liveStatusPanels.right, RIGHT_ACCENT, true);
  drawResult(ctx, resolveVerticalResultCallout(scene), geometry.arena, true);
}

function drawLiveMatchupOverlay(
  ctx: CanvasRenderingContext2D,
  scene: BroadcastScene,
  arena: BroadcastLayoutDefinition['arena']
): void {
  if (scene.resultCallout || scene.tick >= MATCHUP_OVERLAY_TICKS) return;

  const fadeProgress = scene.tick <= MATCHUP_FADE_START_TICK
    ? 0
    : (scene.tick - MATCHUP_FADE_START_TICK) / Math.max(1, MATCHUP_OVERLAY_TICKS - MATCHUP_FADE_START_TICK);
  const easedFade = smoothStep(fadeProgress);
  const alpha = 1 - easedFade;
  const y = arena.y + MATCHUP_OVERLAY_OFFSET_Y - easedFade * 6;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawStylizedMatchupText(
    ctx,
    resolveMatchupHook(scene.left, scene.right),
    arena.x + arena.width / 2,
    y,
    arena.width - 150,
    color(scene.left.visual.accentColor),
    color(scene.right.visual.accentColor)
  );
  ctx.restore();
}

function drawStylizedMatchupText(
  ctx: CanvasRenderingContext2D,
  hook: string,
  centerX: number,
  baselineY: number,
  maxWidth: number,
  leftAccent: string,
  rightAccent: string
): void {
  const text = hook.toUpperCase();
  let size = 58;
  while (size > 34) {
    ctx.font = matchupFont(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }

  ctx.save();
  ctx.font = matchupFont(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = 'rgba(2, 6, 13, 0.96)';
  ctx.lineWidth = Math.max(7, size * 0.16);
  ctx.strokeText(text, centerX, baselineY, maxWidth);

  const gradient = ctx.createLinearGradient(centerX - maxWidth / 2, 0, centerX + maxWidth / 2, 0);
  gradient.addColorStop(0, leftAccent);
  gradient.addColorStop(0.34, '#f8fbff');
  gradient.addColorStop(0.66, '#f8fbff');
  gradient.addColorStop(1, rightAccent);
  ctx.fillStyle = gradient;
  ctx.fillText(text, centerX, baselineY, maxWidth);

  // A thin bright inner edge keeps the italic title crisp after phone scaling.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1.5;
  ctx.strokeText(text, centerX, baselineY, maxWidth);
  ctx.restore();
}

function resolveVerticalResultCallout(scene: BroadcastScene): BroadcastScene['resultCallout'] {
  const result = scene.resultCallout;
  if (!result || result.eyebrow !== 'Winner') return result;
  if (result.title === scene.left.name) return { ...result, title: resolveCreatorFighterName(scene.left) };
  if (result.title === scene.right.name) return { ...result, title: resolveCreatorFighterName(scene.right) };
  return result;
}

function matchupFont(size: number): string {
  return `italic 950 ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
