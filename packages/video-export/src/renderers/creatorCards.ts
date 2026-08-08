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
    drawIntro(ctx, layout, scene, vertical, progress);
  } else if (options.summary) {
    drawSummary(ctx, layout, scene, options.summary, vertical);
  }
  ctx.restore();
}

/**
 * Deterministic Canvas counterpart of the live BattleIntroOverlay.
 * Keep the live matchup hook / fighter entrance / VS / Battle Start language in
 * visual parity while keeping the export renderer isolated from React/DOM.
 */
function drawIntro(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  vertical: boolean,
  progress: number
): void {
  const centerX = layout.width / 2;
  const leftX = vertical ? layout.width * 0.25 : layout.width * 0.235;
  const rightX = vertical ? layout.width * 0.75 : layout.width * 0.765;
  const portraitY = vertical ? layout.height * 0.56 : layout.height * 0.675;
  const portraitRadius = vertical ? layout.width * 0.19 : layout.height * 0.235;
  const nameY = vertical ? layout.height * 0.34 : layout.height * 0.285;
  const identityY = nameY + (vertical ? 64 : 58);
  const kickerY = vertical ? layout.height * 0.19 : layout.height * 0.165;
  const versusY = portraitY + 4;
  const fighterProgress = easeOutCubic(progress / 0.34);
  const versusProgress = easeOutBack((progress - 0.19) / 0.27);
  const startProgress = smoothStep((progress - 0.61) / 0.21);
  const pulse = 1 + Math.sin(progress * Math.PI * 5.4) * 0.035;

  drawIntroBackdrop(ctx, layout, scene, portraitY);

  ctx.save();
  ctx.globalAlpha *= easeOutCubic(progress / 0.16);
  drawText(ctx, 'WHO WILL WIN?', centerX, kickerY, vertical ? 34 : 32, 950, TEXT_SECONDARY, 'center', 4.8);
  ctx.restore();

  drawIntroNameplate(ctx, scene.left, leftX, nameY, identityY, fighterProgress, vertical);
  drawIntroNameplate(ctx, scene.right, rightX, nameY, identityY, fighterProgress, vertical);

  const leftOffset = -(1 - fighterProgress) * layout.width * 0.28;
  const rightOffset = (1 - fighterProgress) * layout.width * 0.28;
  const entryScale = 0.74 + fighterProgress * 0.26;
  const entryRotation = (1 - fighterProgress) * 0.14;

  drawIntroPortrait(
    ctx,
    scene.left,
    leftX,
    portraitY,
    portraitRadius,
    'right',
    leftOffset,
    -entryRotation,
    entryScale * pulse,
    fighterProgress
  );
  drawIntroPortrait(
    ctx,
    scene.right,
    rightX,
    portraitY,
    portraitRadius,
    'left',
    rightOffset,
    entryRotation,
    entryScale * pulse,
    fighterProgress
  );

  if (versusProgress > 0) {
    ctx.save();
    ctx.translate(centerX, versusY);
    ctx.rotate((1 - versusProgress) * -0.2);
    ctx.scale(Math.max(0.01, versusProgress), Math.max(0.01, versusProgress));
    ctx.translate(-centerX, -versusY);
    ctx.globalAlpha *= clamp01(versusProgress);
    ctx.strokeStyle = 'rgba(204, 242, 255, 0.58)';
    ctx.shadowColor = 'rgba(105, 219, 255, 0.72)';
    ctx.shadowBlur = vertical ? 18 : 22;
    ctx.lineWidth = vertical ? 3 : 3.5;
    ctx.beginPath();
    ctx.moveTo(centerX, versusY - (vertical ? 132 : 128));
    ctx.lineTo(centerX, versusY - (vertical ? 60 : 58));
    ctx.moveTo(centerX, versusY + (vertical ? 60 : 58));
    ctx.lineTo(centerX, versusY + (vertical ? 132 : 128));
    ctx.stroke();
    drawText(ctx, 'VS', centerX, versusY + 16, vertical ? 78 : 82, 950, '#f7fbff', 'center', -3.2);
    ctx.restore();
  }

  if (startProgress > 0) {
    const flashY = vertical ? layout.height * 0.82 : layout.height * 0.91;
    const scale = 0.82 + easeOutBack(startProgress) * 0.18;
    ctx.save();
    ctx.globalAlpha *= startProgress * (progress > 0.91 ? clamp01((1 - progress) / 0.09) : 1);
    ctx.translate(centerX, flashY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -flashY);
    drawText(ctx, scene.modeName.toUpperCase(), centerX, flashY - (vertical ? 34 : 31), vertical ? 17 : 16, 850, TEXT_SECONDARY, 'center', 2.2);
    drawText(ctx, 'BATTLE START', centerX, flashY + 12, vertical ? 39 : 37, 950, '#effbff', 'center', 3.8);
    ctx.restore();
  }
}

function drawIntroBackdrop(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  portraitY: number
): void {
  const centerX = layout.width / 2;
  const backdrop = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  backdrop.addColorStop(0, 'rgba(2, 22, 35, 0.985)');
  backdrop.addColorStop(0.48, 'rgba(2, 7, 15, 0.992)');
  backdrop.addColorStop(1, 'rgba(31, 7, 20, 0.985)');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const leftGlow = ctx.createRadialGradient(
    layout.width * 0.12,
    portraitY,
    20,
    layout.width * 0.12,
    portraitY,
    layout.width * 0.56
  );
  leftGlow.addColorStop(0, withAlpha(color(scene.left.visual.accentColor), 0.16));
  leftGlow.addColorStop(1, withAlpha(color(scene.left.visual.accentColor), 0));
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const rightGlow = ctx.createRadialGradient(
    layout.width * 0.88,
    portraitY,
    20,
    layout.width * 0.88,
    portraitY,
    layout.width * 0.56
  );
  rightGlow.addColorStop(0, withAlpha(color(scene.right.visual.accentColor), 0.15));
  rightGlow.addColorStop(1, withAlpha(color(scene.right.visual.accentColor), 0));
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const centerGlow = ctx.createRadialGradient(centerX, portraitY, 24, centerX, portraitY, layout.width * 0.34);
  centerGlow.addColorStop(0, 'rgba(190, 235, 255, 0.09)');
  centerGlow.addColorStop(0.55, 'rgba(102, 213, 255, 0.025)');
  centerGlow.addColorStop(1, 'rgba(102, 213, 255, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, layout.width, layout.height);
}

function drawIntroNameplate(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastScene['left'],
  x: number,
  nameY: number,
  identityY: number,
  progress: number,
  vertical: boolean
): void {
  ctx.save();
  ctx.globalAlpha *= progress;
  drawFittedText(ctx, fighter.name, x, nameY, vertical ? 430 : 590, vertical ? 61 : 66, 950, TEXT_PRIMARY, 'center');
  drawText(
    ctx,
    fighter.identity.toUpperCase(),
    x,
    identityY,
    vertical ? 20 : 19,
    850,
    color(fighter.visual.accentColor),
    'center',
    1.8
  );
  if (fighter.memberCount > 1) {
    drawText(ctx, `${fighter.memberCount} FIGHTER SQUAD`, x, identityY + 34, vertical ? 15 : 14, 800, TEXT_SECONDARY, 'center', 1.5);
  }
  ctx.restore();
}

function drawIntroPortrait(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastScene['left'],
  centerX: number,
  centerY: number,
  radius: number,
  facing: 'left' | 'right',
  offsetX: number,
  rotation: number,
  scale: number,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(centerX + offsetX, centerY);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  drawBroadcastFighterPortrait(ctx, fighter, centerX, centerY, radius, facing);
  ctx.restore();
}

function drawSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  scene: BroadcastScene,
  summary: CreatorBattleSummary,
  vertical: boolean
): void {
  const winner = summary.winningTeam === scene.left.team
    ? scene.left
    : summary.winningTeam === scene.right.team
      ? scene.right
      : null;
  const winnerFacing: 'left' | 'right' = winner === scene.right ? 'left' : 'right';
  if (vertical) {
    drawVerticalSummary(ctx, layout, summary, winner, winnerFacing);
    return;
  }
  drawLandscapeSummary(ctx, layout, summary, winner, winnerFacing);
}

function drawVerticalSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary,
  winner: BroadcastScene['left'] | null,
  winnerFacing: 'left' | 'right'
): void {
  const width = 860;
  const height = 760;
  const x = (layout.width - width) / 2;
  const y = (layout.height - height) / 2;
  const centerX = layout.width / 2;
  const victoryAccent = winner ? withAlpha(color(winner.visual.accentColor), 0.68) : 'rgba(122, 243, 190, 0.62)';
  drawPanel(ctx, x, y, width, height, 34, 'rgba(5, 13, 27, 0.988)', victoryAccent);

  drawText(ctx, summary.winningTeam === null ? 'BATTLE COMPLETE' : 'VICTORY', centerX, y + 58, 20, 950, READY_ACCENT, 'center', 2.2);
  drawFittedText(ctx, summary.winnerName, centerX, y + 122, width - 100, 54, 950, TEXT_PRIMARY, 'center');

  if (winner) {
    drawWinnerPortrait(ctx, winner, centerX, y + 275, 126, winnerFacing);
  } else {
    drawText(ctx, 'VS', centerX, y + 290, 64, 950, TEXT_SECONDARY, 'center');
  }

  const statWidth = 244;
  const statHeight = 112;
  const gap = 16;
  const totalWidth = statWidth * 3 + gap * 2;
  const startX = centerX - totalWidth / 2;
  const statsY = y + 410;
  drawStat(ctx, startX, statsY, statWidth, statHeight, 'REMAINING HP', `${Math.round(summary.remainingHp).toLocaleString()} · ${Math.round(summary.remainingHpRatio * 100)}%`, LEFT_ACCENT);
  drawStat(ctx, startX + statWidth + gap, statsY, statWidth, statHeight, 'LARGEST HIT', summary.largestHit ? Math.round(summary.largestHit.amount).toLocaleString() : '—', '#ffd06b');
  drawStat(ctx, startX + (statWidth + gap) * 2, statsY, statWidth, statHeight, 'BATTLE TIME', formatDuration(summary.durationSeconds), RIGHT_ACCENT);

  const abilityY = y + 566;
  drawText(ctx, 'MOST DAMAGING ABILITY', centerX, abilityY, 15, 900, TEXT_SECONDARY, 'center', 1.4);
  drawFittedText(ctx, summary.topAbility?.abilityName ?? 'No ability damage recorded', centerX, abilityY + 40, width - 120, 30, 900, summary.topAbility ? TEXT_PRIMARY : TEXT_SECONDARY, 'center');
  if (summary.topAbility) {
    drawText(ctx, `${Math.round(summary.topAbility.totalDamage).toLocaleString()} total damage · ${summary.topAbility.sourceName}`, centerX, abilityY + 72, 14, 750, TEXT_SECONDARY, 'center');
  }

  if (summary.highlight) {
    drawPill(ctx, `FINISHING MOMENT · ${summary.highlight.title.toUpperCase()}`, x + 70, y + height - 74, width - 140, 42, 'rgba(34, 25, 52, 0.94)', PANEL_BORDER, TEXT_PRIMARY, 13);
  }
}

function drawLandscapeSummary(
  ctx: CanvasRenderingContext2D,
  layout: BroadcastLayoutDefinition,
  summary: CreatorBattleSummary,
  winner: BroadcastScene['left'] | null,
  winnerFacing: 'left' | 'right'
): void {
  const width = 1240;
  const height = 520;
  const x = (layout.width - width) / 2;
  const y = 270;
  const victoryAccent = winner ? withAlpha(color(winner.visual.accentColor), 0.68) : 'rgba(122, 243, 190, 0.62)';
  drawPanel(ctx, x, y, width, height, 34, 'rgba(5, 13, 27, 0.988)', victoryAccent);

  const heroX = x + 250;
  const contentX = x + 470;
  const contentWidth = width - 520;
  drawText(ctx, summary.winningTeam === null ? 'BATTLE COMPLETE' : 'VICTORY', heroX, y + 60, 18, 950, READY_ACCENT, 'center', 2);
  drawFittedText(ctx, summary.winnerName, heroX, y + 118, 390, 48, 950, TEXT_PRIMARY, 'center');
  if (winner) drawWinnerPortrait(ctx, winner, heroX, y + 310, 164, winnerFacing);

  const statWidth = 218;
  const statHeight = 108;
  const gap = 14;
  const statsY = y + 88;
  drawStat(ctx, contentX, statsY, statWidth, statHeight, 'REMAINING HP', `${Math.round(summary.remainingHp).toLocaleString()} · ${Math.round(summary.remainingHpRatio * 100)}%`, LEFT_ACCENT);
  drawStat(ctx, contentX + statWidth + gap, statsY, statWidth, statHeight, 'LARGEST HIT', summary.largestHit ? Math.round(summary.largestHit.amount).toLocaleString() : '—', '#ffd06b');
  drawStat(ctx, contentX + (statWidth + gap) * 2, statsY, statWidth, statHeight, 'BATTLE TIME', formatDuration(summary.durationSeconds), RIGHT_ACCENT);

  const abilityY = y + 255;
  drawText(ctx, 'MOST DAMAGING ABILITY', contentX + contentWidth / 2, abilityY, 14, 900, TEXT_SECONDARY, 'center', 1.2);
  drawFittedText(ctx, summary.topAbility?.abilityName ?? 'No ability damage recorded', contentX + contentWidth / 2, abilityY + 40, contentWidth - 20, 30, 900, summary.topAbility ? TEXT_PRIMARY : TEXT_SECONDARY, 'center');
  if (summary.topAbility) {
    drawText(ctx, `${Math.round(summary.topAbility.totalDamage).toLocaleString()} total damage · ${summary.topAbility.sourceName}`, contentX + contentWidth / 2, abilityY + 72, 13, 750, TEXT_SECONDARY, 'center');
  }

  if (summary.highlight) {
    drawPill(ctx, `FINISHING MOMENT · ${summary.highlight.title.toUpperCase()}`, contentX, y + height - 86, contentWidth, 42, 'rgba(34, 25, 52, 0.94)', PANEL_BORDER, TEXT_PRIMARY, 13);
  }
}

function drawWinnerPortrait(
  ctx: CanvasRenderingContext2D,
  winner: BroadcastScene['left'],
  x: number,
  y: number,
  radius: number,
  facing: 'left' | 'right'
): void {
  const accent = color(winner.visual.accentColor);
  const glow = ctx.createRadialGradient(x, y, radius * 0.18, x, y, radius * 1.62);
  glow.addColorStop(0, withAlpha(accent, 0.24));
  glow.addColorStop(0.58, withAlpha(accent, 0.08));
  glow.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.62, 0, Math.PI * 2);
  ctx.fill();
  drawBroadcastFighterPortrait(ctx, winner, x, y, radius, facing);
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

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function smoothStep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutBack(value: number): number {
  const clamped = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (clamped - 1) ** 3 + c1 * (clamped - 1) ** 2;
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
