import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { CreatorBattleSummary } from '../types';
import {
  LEFT_ACCENT,
  PANEL_BORDER,
  READY_ACCENT,
  RIGHT_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  drawFittedText,
  drawPanel,
  drawPill,
  drawText,
  roundedRectPath
} from './canvasPrimitives';

export type CreatorCardKind = 'intro' | 'summary';

export interface CreatorCardRenderOptions {
  kind: CreatorCardKind;
  progress: number;
  summary?: CreatorBattleSummary;
}

export function drawCreatorCard(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  options: CreatorCardRenderOptions
): void {
  const progress = clamp01(options.progress);
  const vertical = layout.id === 'vertical';
  const fade = cardOpacity(progress);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(2, 5, 13, 0.78)';
  roundedRectPath(ctx, 0, 0, layout.width, layout.height, 0);
  ctx.fill();

  if (options.kind === 'intro') {
    drawIntro(ctx, layout, scene, vertical);
  } else if (options.summary) {
    drawSummary(ctx, layout, options.summary, vertical);
  }
  ctx.restore();
}

function drawIntro(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  vertical: boolean
): void {
  const width = vertical ? 820 : 980;
  const height = vertical ? 500 : 390;
  const x = (layout.width - width) / 2;
  const y = vertical ? 570 : 340;
  drawPanel(ctx, x, y, width, height, 34, 'rgba(8, 16, 31, 0.97)', 'rgba(112, 184, 255, 0.52)');
  drawText(ctx, 'KINETIC BATTLE', layout.width / 2, y + 58, vertical ? 24 : 21, 950, '#83c5ff', 'center', 3.2);
  drawText(ctx, `${scene.modeName.toUpperCase()} · ${scene.roundLabel.toUpperCase()}`, layout.width / 2, y + 96, vertical ? 17 : 15, 800, TEXT_SECONDARY, 'center', 1.5);

  const nameSize = vertical ? 44 : 42;
  drawFittedText(ctx, scene.left.name, layout.width / 2, y + (vertical ? 190 : 175), width - 130, nameSize, 950, LEFT_ACCENT, 'center');
  drawText(ctx, 'VS', layout.width / 2, y + (vertical ? 252 : 229), vertical ? 24 : 20, 950, TEXT_PRIMARY, 'center', 2.4);
  drawFittedText(ctx, scene.right.name, layout.width / 2, y + (vertical ? 322 : 286), width - 130, nameSize, 950, RIGHT_ACCENT, 'center');
  drawPill(
    ctx,
    scene.objectiveLabel.toUpperCase(),
    layout.width / 2 - (vertical ? 210 : 190),
    y + height - 88,
    vertical ? 420 : 380,
    44,
    'rgba(25, 43, 67, 0.92)',
    'rgba(112, 184, 255, 0.42)',
    TEXT_PRIMARY,
    vertical ? 15 : 14
  );
}

function drawSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary,
  vertical: boolean
): void {
  const width = vertical ? 850 : 1040;
  const height = vertical ? 600 : 430;
  const x = (layout.width - width) / 2;
  const y = vertical ? 515 : 318;
  drawPanel(ctx, x, y, width, height, 34, 'rgba(7, 15, 29, 0.98)', 'rgba(122, 243, 190, 0.56)');
  drawText(ctx, summary.winningTeam === null ? 'BATTLE COMPLETE' : 'WINNER', layout.width / 2, y + 58, vertical ? 22 : 18, 950, READY_ACCENT, 'center', 2.8);
  drawFittedText(ctx, summary.winnerName, layout.width / 2, y + (vertical ? 135 : 125), width - 110, vertical ? 48 : 45, 950, TEXT_PRIMARY, 'center');

  const statsY = y + (vertical ? 205 : 185);
  const gap = vertical ? 18 : 20;
  const statWidth = vertical ? 250 : 300;
  const statHeight = vertical ? 125 : 118;
  const totalWidth = statWidth * 3 + gap * 2;
  const startX = layout.width / 2 - totalWidth / 2;
  drawStat(ctx, startX, statsY, statWidth, statHeight, 'REMAINING HP', `${Math.round(summary.remainingHp).toLocaleString()} · ${Math.round(summary.remainingHpRatio * 100)}%`, LEFT_ACCENT);
  drawStat(ctx, startX + statWidth + gap, statsY, statWidth, statHeight, 'LARGEST HIT', summary.largestHit ? Math.round(summary.largestHit.amount).toLocaleString() : '—', '#ffd06b');
  drawStat(ctx, startX + (statWidth + gap) * 2, statsY, statWidth, statHeight, 'BATTLE TIME', formatDuration(summary.durationSeconds), RIGHT_ACCENT);

  const detailY = statsY + statHeight + (vertical ? 62 : 54);
  drawText(ctx, 'MOST DAMAGING ABILITY', layout.width / 2, detailY, vertical ? 15 : 13, 900, TEXT_SECONDARY, 'center', 1.6);
  drawFittedText(
    ctx,
    summary.topAbility?.abilityName ?? 'No ability damage recorded',
    layout.width / 2,
    detailY + (vertical ? 47 : 39),
    width - 130,
    vertical ? 27 : 24,
    900,
    summary.topAbility ? TEXT_PRIMARY : TEXT_SECONDARY,
    'center'
  );
  if (summary.topAbility) {
    drawText(
      ctx,
      `${Math.round(summary.topAbility.totalDamage).toLocaleString()} total damage · ${summary.topAbility.sourceName}`,
      layout.width / 2,
      detailY + (vertical ? 82 : 70),
      vertical ? 15 : 13,
      800,
      TEXT_SECONDARY,
      'center'
    );
  }

  if (summary.highlight) {
    drawPill(
      ctx,
      `HIGHLIGHT · ${summary.highlight.title.toUpperCase()}`,
      layout.width / 2 - (vertical ? 315 : 330),
      y + height - 72,
      vertical ? 630 : 660,
      42,
      'rgba(34, 25, 52, 0.92)',
      PANEL_BORDER,
      TEXT_PRIMARY,
      vertical ? 14 : 13
    );
  }
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  accent: string
): void {
  drawPanel(ctx, x, y, width, height, 18, 'rgba(255,255,255,0.035)', PANEL_BORDER);
  drawText(ctx, label, x + width / 2, y + 34, 12, 900, accent, 'center', 1.4);
  drawFittedText(ctx, value, x + width / 2, y + 84, width - 30, 27, 950, TEXT_PRIMARY, 'center');
}

function cardOpacity(progress: number): number {
  if (progress < 0.12) return easeOutCubic(progress / 0.12);
  if (progress > 0.86) return easeOutCubic((1 - progress) / 0.14);
  return 1;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) ** 3;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
