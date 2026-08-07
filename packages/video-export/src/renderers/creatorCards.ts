import type { BroadcastLayoutDefinition } from '../broadcastLayout';
import type { BroadcastScene } from '../broadcastScene';
import type { CreatorBattleSummary } from '../types';
import { drawBroadcastFighterPortrait } from './fighterPortrait';
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
  const centerX = layout.width / 2;
  const leftX = vertical ? 280 : 570;
  const rightX = vertical ? 800 : 1350;
  const portraitY = vertical ? 930 : 610;
  const portraitRadius = vertical ? 185 : 180;
  const nameY = vertical ? 650 : 335;
  const identityY = nameY + (vertical ? 52 : 48);
  const versusY = portraitY + 4;

  const backdrop = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  backdrop.addColorStop(0, 'rgba(3, 20, 31, 0.96)');
  backdrop.addColorStop(0.5, 'rgba(2, 8, 16, 0.97)');
  backdrop.addColorStop(1, 'rgba(29, 7, 20, 0.96)');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const centerGlow = ctx.createRadialGradient(centerX, portraitY, 40, centerX, portraitY, vertical ? 580 : 650);
  centerGlow.addColorStop(0, 'rgba(102, 213, 255, 0.10)');
  centerGlow.addColorStop(0.55, 'rgba(102, 213, 255, 0.03)');
  centerGlow.addColorStop(1, 'rgba(102, 213, 255, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, layout.width, layout.height);

  drawText(ctx, 'MATCH PREPARED', centerX, vertical ? 410 : 215, vertical ? 24 : 21, 900, TEXT_SECONDARY, 'center', 4.4);

  drawFittedText(ctx, scene.left.name, leftX, nameY, vertical ? 410 : 480, vertical ? 50 : 48, 950, TEXT_PRIMARY, 'center');
  drawText(ctx, scene.left.identity.toUpperCase(), leftX, identityY, vertical ? 16 : 15, 850, color(scene.left.visual.accentColor), 'center', 1.8);
  drawFittedText(ctx, scene.right.name, rightX, nameY, vertical ? 410 : 480, vertical ? 50 : 48, 950, TEXT_PRIMARY, 'center');
  drawText(ctx, scene.right.identity.toUpperCase(), rightX, identityY, vertical ? 16 : 15, 850, color(scene.right.visual.accentColor), 'center', 1.8);

  drawBroadcastFighterPortrait(ctx, scene.left, leftX, portraitY, portraitRadius, 'right');
  drawBroadcastFighterPortrait(ctx, scene.right, rightX, portraitY, portraitRadius, 'left');

  ctx.save();
  ctx.strokeStyle = 'rgba(204, 242, 255, 0.42)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, versusY - (vertical ? 128 : 116));
  ctx.lineTo(centerX, versusY - (vertical ? 58 : 52));
  ctx.moveTo(centerX, versusY + (vertical ? 58 : 52));
  ctx.lineTo(centerX, versusY + (vertical ? 128 : 116));
  ctx.stroke();
  ctx.restore();
  drawText(ctx, 'VS', centerX, versusY + 13, vertical ? 62 : 58, 950, '#f7fbff', 'center', -2.4);
}

function drawSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary,
  vertical: boolean
): void {
  if (vertical) {
    drawVerticalSummary(ctx, layout, summary);
    return;
  }
  drawLandscapeSummary(ctx, layout, summary);
}

function drawVerticalSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary
): void {
  const width = 760;
  const height = 560;
  const x = (layout.width - width) / 2;
  const y = 430;
  drawPanel(ctx, x, y, width, height, 32, 'rgba(7, 15, 29, 0.985)', 'rgba(122, 243, 190, 0.54)');
  drawText(ctx, summary.winningTeam === null ? 'BATTLE COMPLETE' : 'WINNER', layout.width / 2, y + 50, 17, 950, READY_ACCENT, 'center', 1.2);
  drawFittedText(ctx, summary.winnerName, layout.width / 2, y + 108, width - 90, 42, 950, TEXT_PRIMARY, 'center');

  const statWidth = 214;
  const statHeight = 108;
  const gap = 14;
  const totalWidth = statWidth * 3 + gap * 2;
  const startX = layout.width / 2 - totalWidth / 2;
  const statsY = y + 150;
  drawStat(ctx, startX, statsY, statWidth, statHeight, 'REMAINING HP', `${Math.round(summary.remainingHp).toLocaleString()} · ${Math.round(summary.remainingHpRatio * 100)}%`, LEFT_ACCENT);
  drawStat(ctx, startX + statWidth + gap, statsY, statWidth, statHeight, 'LARGEST HIT', summary.largestHit ? Math.round(summary.largestHit.amount).toLocaleString() : '—', '#ffd06b');
  drawStat(ctx, startX + (statWidth + gap) * 2, statsY, statWidth, statHeight, 'BATTLE TIME', formatDuration(summary.durationSeconds), RIGHT_ACCENT);

  const abilityY = y + 310;
  drawText(ctx, 'MOST DAMAGING ABILITY', layout.width / 2, abilityY, 13, 900, TEXT_SECONDARY, 'center', 1.1);
  drawFittedText(
    ctx,
    summary.topAbility?.abilityName ?? 'No ability damage recorded',
    layout.width / 2,
    abilityY + 36,
    width - 100,
    24,
    900,
    summary.topAbility ? TEXT_PRIMARY : TEXT_SECONDARY,
    'center'
  );
  if (summary.topAbility) {
    drawText(
      ctx,
      `${Math.round(summary.topAbility.totalDamage).toLocaleString()} total damage · ${summary.topAbility.sourceName}`,
      layout.width / 2,
      abilityY + 63,
      12,
      750,
      TEXT_SECONDARY,
      'center'
    );
  }

  if (summary.highlight) {
    drawPill(
      ctx,
      `HIGHLIGHT · ${summary.highlight.title.toUpperCase()}`,
      x + 70,
      y + height - 82,
      width - 140,
      38,
      'rgba(34, 25, 52, 0.92)',
      PANEL_BORDER,
      TEXT_PRIMARY,
      12
    );
  }
}

function drawLandscapeSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary
): void {
  const width = 980;
  const height = 420;
  const x = (layout.width - width) / 2;
  const y = 330;
  drawPanel(ctx, x, y, width, height, 30, 'rgba(7, 15, 29, 0.985)', 'rgba(122, 243, 190, 0.54)');
  drawText(ctx, summary.winningTeam === null ? 'BATTLE COMPLETE' : 'WINNER', layout.width / 2, y + 45, 15, 950, READY_ACCENT, 'center', 1.1);
  drawFittedText(ctx, summary.winnerName, layout.width / 2, y + 94, width - 100, 38, 950, TEXT_PRIMARY, 'center');

  const statWidth = 270;
  const statHeight = 96;
  const gap = 18;
  const totalWidth = statWidth * 3 + gap * 2;
  const startX = layout.width / 2 - totalWidth / 2;
  const statsY = y + 126;
  drawStat(ctx, startX, statsY, statWidth, statHeight, 'REMAINING HP', `${Math.round(summary.remainingHp).toLocaleString()} · ${Math.round(summary.remainingHpRatio * 100)}%`, LEFT_ACCENT);
  drawStat(ctx, startX + statWidth + gap, statsY, statWidth, statHeight, 'LARGEST HIT', summary.largestHit ? Math.round(summary.largestHit.amount).toLocaleString() : '—', '#ffd06b');
  drawStat(ctx, startX + (statWidth + gap) * 2, statsY, statWidth, statHeight, 'BATTLE TIME', formatDuration(summary.durationSeconds), RIGHT_ACCENT);

  const abilityY = y + 267;
  drawText(ctx, 'MOST DAMAGING ABILITY', layout.width / 2, abilityY, 12, 900, TEXT_SECONDARY, 'center', 1);
  drawFittedText(
    ctx,
    summary.topAbility?.abilityName ?? 'No ability damage recorded',
    layout.width / 2,
    abilityY + 31,
    width - 100,
    22,
    900,
    summary.topAbility ? TEXT_PRIMARY : TEXT_SECONDARY,
    'center'
  );
  if (summary.topAbility) {
    drawText(
      ctx,
      `${Math.round(summary.topAbility.totalDamage).toLocaleString()} total damage · ${summary.topAbility.sourceName}`,
      layout.width / 2,
      abilityY + 54,
      11,
      750,
      TEXT_SECONDARY,
      'center'
    );
  }

  if (summary.highlight) {
    drawPill(
      ctx,
      `HIGHLIGHT · ${summary.highlight.title.toUpperCase()}`,
      x + 170,
      y + height - 48,
      width - 340,
      32,
      'rgba(34, 25, 52, 0.92)',
      PANEL_BORDER,
      TEXT_PRIMARY,
      11
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

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
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
