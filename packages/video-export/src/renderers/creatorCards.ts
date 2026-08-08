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
    drawSummary(ctx, layout, options.summary, vertical);
  }
  ctx.restore();
}

/**
 * Deterministic Canvas counterpart of the live BattleIntroOverlay.
 * Keep the Match Prepared / fighter entrance / VS / Battle Start language in
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
  const leftX = vertical ? layout.width * 0.25 : layout.width * 0.19;
  const rightX = vertical ? layout.width * 0.75 : layout.width * 0.81;
  const portraitY = vertical ? layout.height * 0.56 : layout.height * 0.70;
  const portraitRadius = vertical ? layout.width * 0.19 : layout.height * 0.235;
  const nameY = vertical ? layout.height * 0.35 : layout.height * 0.315;
  const identityY = nameY + (vertical ? 54 : 48);
  const kickerY = vertical ? layout.height * 0.20 : layout.height * 0.18;
  const versusY = portraitY + 4;
  const fighterProgress = easeOutCubic(progress / 0.34);
  const versusProgress = easeOutBack((progress - 0.19) / 0.27);
  const startProgress = smoothStep((progress - 0.61) / 0.21);
  const pulse = 1 + Math.sin(progress * Math.PI * 5.4) * 0.035;

  drawIntroBackdrop(ctx, layout, scene, portraitY);

  ctx.save();
  ctx.globalAlpha *= easeOutCubic(progress / 0.16);
  drawText(ctx, 'MATCH PREPARED', centerX, kickerY, vertical ? 24 : 21, 900, TEXT_SECONDARY, 'center', 4.4);
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
    fighterProgress,
    true
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
    fighterProgress,
    true
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
    drawText(ctx, 'VS', centerX, versusY + 14, vertical ? 64 : 66, 950, '#f7fbff', 'center', -3);
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
    drawText(ctx, scene.modeName.toUpperCase(), centerX, flashY - (vertical ? 28 : 26), vertical ? 13 : 12, 800, TEXT_SECONDARY, 'center', 2);
    drawText(ctx, 'BATTLE START', centerX, flashY + 10, vertical ? 29 : 27, 950, '#effbff', 'center', 3.5);
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
  drawFittedText(ctx, fighter.name, x, nameY, vertical ? 410 : 520, vertical ? 50 : 52, 950, TEXT_PRIMARY, 'center');
  drawText(
    ctx,
    fighter.identity.toUpperCase(),
    x,
    identityY,
    vertical ? 16 : 15,
    850,
    color(fighter.visual.accentColor),
    'center',
    1.8
  );
  if (fighter.memberCount > 1) {
    drawText(ctx, `${fighter.memberCount} FIGHTER SQUAD`, x, identityY + 30, vertical ? 12 : 11, 750, TEXT_SECONDARY, 'center', 1.4);
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
  opacity: number,
  ghost: boolean
): void {
  if (ghost && opacity > 0.1) {
    ctx.save();
    ctx.globalAlpha *= opacity * 0.18;
    ctx.filter = `blur(${Math.max(8, radius * 0.07)}px)`;
    const ghostX = centerX + (facing === 'right' ? radius * 0.62 : -radius * 0.62);
    const ghostY = centerY - radius * 0.58;
    drawBroadcastFighterPortrait(ctx, fighter, ghostX, ghostY, radius * 1.16, facing);
    ctx.restore();
  }

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
