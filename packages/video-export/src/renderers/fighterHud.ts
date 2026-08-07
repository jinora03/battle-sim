import type { BroadcastRect } from '../broadcastLayout';
import type {
  BroadcastAbilityView,
  BroadcastCallout,
  BroadcastFighterView,
  BroadcastResourceView
} from '../broadcastScene';
import {
  PANEL_BORDER,
  PANEL_FILL,
  READY_ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  drawFittedText,
  drawHpBar,
  drawPanel,
  drawPill,
  drawText,
  roundedRectPath
} from './canvasPrimitives';

export function drawLandscapeFighterPanel(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const textX = alignRight ? rect.x + rect.width - 20 : rect.x + 20;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 18, PANEL_FILL, PANEL_BORDER);
  drawText(ctx, alignRight ? 'FIGHTER B' : 'FIGHTER A', textX, rect.y + 30, 12, 900, accent, textAlign, 1.2);
  drawFittedText(ctx, fighter.name, textX, rect.y + 68, rect.width - 40, 29, 950, TEXT_PRIMARY, textAlign);
  if (fighter.memberCount > 1) {
    drawText(ctx, `${fighter.memberCount} fighters`, textX, rect.y + 95, 12, 750, TEXT_SECONDARY, textAlign);
  } else {
    drawFittedText(ctx, fighter.identity, textX, rect.y + 95, rect.width - 40, 12, 800, accent, textAlign);
    drawFittedText(ctx, fighter.weaponName, textX, rect.y + 118, rect.width - 40, 12, 750, TEXT_SECONDARY, textAlign);
  }

  drawText(ctx, 'HP', textX, rect.y + 151, 11, 900, TEXT_SECONDARY, textAlign, 1.1);
  drawHpBar(ctx, fighter, rect.x + 20, rect.y + 162, rect.width - 40, 22, accent, alignRight);
  drawText(
    ctx,
    `${Math.ceil(fighter.hp).toLocaleString()} / ${Math.ceil(fighter.maxHp).toLocaleString()}`,
    textX,
    rect.y + 203,
    13,
    850,
    TEXT_PRIMARY,
    textAlign
  );

  const abilityHeadingY = fighter.resource ? rect.y + 304 : rect.y + 248;
  if (fighter.resource) {
    drawLandscapeResource(ctx, fighter.resource, rect, accent, alignRight);
  }

  drawText(ctx, 'ABILITY READINESS', textX, abilityHeadingY, 11, 900, TEXT_SECONDARY, textAlign, 1.05);
  const abilityStartY = abilityHeadingY + 16;
  fighter.abilities.slice(0, 5).forEach((ability, index) => {
    drawAbilityTile(ctx, ability, rect.x + 20, abilityStartY + index * 72, rect.width - 40, 60, accent);
  });

  const statusY = abilityStartY + 5 * 72 + 22;
  drawText(ctx, 'STATUS', textX, statusY, 11, 900, TEXT_SECONDARY, textAlign, 1.05);
  drawStatuses(ctx, fighter, rect.x + 20, statusY + 14, rect.width - 40, accent);
}

export function drawVerticalFighterHeader(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const padding = 24;
  const textX = alignRight ? rect.x + rect.width - padding : rect.x + padding;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 20, 'rgba(9, 18, 33, 0.92)', PANEL_BORDER);
  drawFittedText(ctx, fighter.name, textX, rect.y + 39, rect.width - padding * 2, 28, 950, TEXT_PRIMARY, textAlign);
  if (fighter.memberCount > 1) {
    drawFittedText(ctx, fighter.identity, textX, rect.y + 69, rect.width - padding * 2, 13, 800, accent, textAlign);
  } else {
    drawFittedText(ctx, fighter.identity, textX, rect.y + 69, rect.width - padding * 2, 12, 850, accent, textAlign);
    drawFittedText(ctx, fighter.weaponName, textX, rect.y + 93, rect.width - padding * 2, 12, 750, TEXT_SECONDARY, textAlign);
  }
  drawHpBar(ctx, fighter, rect.x + padding, rect.y + 119, rect.width - padding * 2, 22, accent, alignRight);
  drawText(
    ctx,
    `${Math.ceil(fighter.hp).toLocaleString()} HP`,
    textX,
    rect.y + 171,
    13,
    800,
    TEXT_SECONDARY,
    textAlign
  );
}

export function drawVerticalSkillsPanel(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const padding = 18;
  const textX = alignRight ? rect.x + rect.width - padding : rect.x + padding;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 18, PANEL_FILL, PANEL_BORDER);
  drawFittedText(ctx, `${fighter.name.toUpperCase()} SKILLS`, textX, rect.y + 29, rect.width - padding * 2, 13, 900, accent, textAlign);

  let abilityStartY = rect.y + 47;
  if (fighter.resource) {
    drawVerticalResource(ctx, fighter.resource, rect.x + padding, rect.y + 39, rect.width - padding * 2, accent, alignRight);
    abilityStartY = rect.y + 82;
  }

  fighter.abilities.slice(0, 5).forEach((ability, index) => {
    drawAbilityTile(ctx, ability, rect.x + padding, abilityStartY + index * 57, rect.width - padding * 2, 49, accent);
  });

  const statusY = rect.y + rect.height - 43;
  if (fighter.statuses.length > 0) {
    drawStatuses(ctx, fighter, rect.x + padding, statusY, rect.width - padding * 2, accent);
  } else {
    drawText(ctx, 'No active status', textX, statusY + 17, 11, 700, TEXT_SECONDARY, textAlign);
  }
}


export function drawCallout(
  ctx: CanvasRenderingContext2D,
  callout: BroadcastCallout | null,
  rect: BroadcastRect,
  accent: string,
  fallbackEyebrow: string
): void {
  const active = callout ?? { eyebrow: fallbackEyebrow, title: 'Awaiting battle event', detail: null };
  drawText(ctx, active.eyebrow.toUpperCase(), rect.x, rect.y + 13, 11, 900, accent, 'left', 1.3);
  drawFittedText(ctx, active.title, rect.x, rect.y + 39, rect.width * 0.72, 18, 900, callout ? TEXT_PRIMARY : TEXT_SECONDARY, 'left');
  if (active.detail) drawFittedText(ctx, active.detail, rect.x + rect.width, rect.y + 39, rect.width * 0.25, 13, 700, TEXT_SECONDARY, 'right');
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  callout: BroadcastCallout | null,
  arena: BroadcastRect,
  vertical: boolean
): void {
  if (!callout) return;
  const width = vertical ? 620 : 590;
  const height = vertical ? 188 : 164;
  const x = arena.x + (arena.width - width) / 2;
  const y = arena.y + (arena.height - height) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 14, 0.64)';
  roundedRectPath(ctx, arena.x, arena.y, arena.width, arena.height, 18);
  ctx.fill();
  ctx.restore();
  drawPanel(ctx, x, y, width, height, 24, 'rgba(8, 16, 31, 0.97)', 'rgba(122, 243, 190, 0.52)');
  drawText(ctx, callout.eyebrow.toUpperCase(), x + width / 2, y + 44, vertical ? 16 : 14, 900, READY_ACCENT, 'center', 1.2);
  drawFittedText(ctx, callout.title, x + width / 2, y + (vertical ? 105 : 92), width - 70, vertical ? 38 : 34, 950, TEXT_PRIMARY, 'center');
  if (callout.detail) drawText(ctx, callout.detail.toUpperCase(), x + width / 2, y + height - 27, 12, 800, TEXT_SECONDARY, 'center', 0.8);
}

function drawVerticalResource(
  ctx: CanvasRenderingContext2D,
  resource: BroadcastResourceView,
  x: number,
  y: number,
  width: number,
  accent: string,
  alignRight: boolean
): void {
  const textX = alignRight ? x + width : x;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawText(ctx, resource.name.toUpperCase(), textX, y + 12, 10, 900, TEXT_SECONDARY, textAlign, 0.9);
  const valueLabel = `${Math.round(resource.value)} / ${Math.round(resource.maximum)}`;
  drawText(ctx, valueLabel, alignRight ? x : x + width, y + 12, 10, 800, TEXT_PRIMARY, alignRight ? 'left' : 'right');
  const barY = y + 18;
  roundedRectPath(ctx, x, barY, width, 7, 3.5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillWidth = Math.max(resource.ratio > 0 ? 3 : 0, width * resource.ratio);
  if (fillWidth > 0) {
    roundedRectPath(ctx, alignRight ? x + width - fillWidth : x, barY, fillWidth, 7, 3.5);
    ctx.fillStyle = accent;
    ctx.fill();
  }
}

function drawLandscapeResource(
  ctx: CanvasRenderingContext2D,
  resource: BroadcastResourceView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const textX = alignRight ? rect.x + rect.width - 20 : rect.x + 20;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawText(ctx, resource.name.toUpperCase(), textX, rect.y + 235, 11, 900, TEXT_SECONDARY, textAlign, 1.05);
  const barX = rect.x + 20;
  const barY = rect.y + 246;
  const barWidth = rect.width - 40;
  roundedRectPath(ctx, barX, barY, barWidth, 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillWidth = Math.max(resource.ratio > 0 ? 4 : 0, barWidth * resource.ratio);
  if (fillWidth > 0) {
    roundedRectPath(ctx, alignRight ? barX + barWidth - fillWidth : barX, barY, fillWidth, 10, 5);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  drawText(
    ctx,
    `${Math.round(resource.value).toLocaleString()} / ${Math.round(resource.maximum).toLocaleString()}`,
    textX,
    rect.y + 278,
    12,
    800,
    TEXT_PRIMARY,
    textAlign
  );
}

function drawAbilityTile(
  ctx: CanvasRenderingContext2D,
  ability: BroadcastAbilityView,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string
): void {
  drawPanel(ctx, x, y, width, height, 11, 'rgba(255,255,255,0.025)', 'rgba(154,190,227,0.13)');
  drawText(ctx, ability.slot === 'ultimate' ? 'ULT' : ability.slot.toUpperCase(), x + 11, y + 17, 10, 900, ability.slot === 'ultimate' ? '#ffd06b' : accent, 'left', 0.8);
  drawFittedText(ctx, ability.name, x + 11, y + 38, width - 22, 14, 850, TEXT_PRIMARY, 'left');
  roundedRectPath(ctx, x + 11, y + height - 9, width - 22, 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  roundedRectPath(ctx, x + 11, y + height - 9, Math.max(2, (width - 22) * ability.readiness), 4, 2);
  ctx.fillStyle = ability.phase === 'ready' ? READY_ACCENT : accent;
  ctx.fill();
}

function drawStatuses(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  x: number,
  y: number,
  width: number,
  accent: string
): void {
  if (fighter.statuses.length === 0) {
    drawText(ctx, 'No active status', x, y + 17, 12, 700, TEXT_SECONDARY);
    return;
  }
  let cursorX = x;
  for (const status of fighter.statuses) {
    const label = status.stacks > 1 ? `${status.name} ×${status.stacks}` : status.name;
    ctx.font = '800 11px Inter, ui-sans-serif, system-ui, sans-serif';
    const pillWidth = Math.min(width, ctx.measureText(label).width + 20);
    if (cursorX + pillWidth > x + width) break;
    drawPill(ctx, label, cursorX, y, pillWidth, 28, 'rgba(255,255,255,0.035)', accent, TEXT_PRIMARY, 11);
    cursorX += pillWidth + 7;
  }
}
