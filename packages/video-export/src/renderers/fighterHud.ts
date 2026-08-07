import type { BroadcastRect } from '../broadcastLayout';
import type {
  BroadcastAbilityView,
  BroadcastCallout,
  BroadcastFighterView
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
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 18, PANEL_FILL, PANEL_BORDER);
  ctx.fillStyle = accent;
  ctx.fillRect(alignRight ? rect.x + rect.width - 5 : rect.x, rect.y + 18, 5, rect.height - 36);

  drawText(ctx, alignRight ? 'FIGHTER B' : 'FIGHTER A', rect.x + 20, rect.y + 35, 13, 900, accent, 'left', 1.6);
  drawFittedText(ctx, fighter.name, rect.x + 20, rect.y + 83, rect.width - 40, 25, 900, TEXT_PRIMARY, 'left');
  if (fighter.memberCount > 1) drawText(ctx, `${fighter.memberCount} fighters`, rect.x + 20, rect.y + 111, 13, 700, TEXT_SECONDARY);

  drawText(ctx, 'HP', rect.x + 20, rect.y + 146, 12, 900, TEXT_SECONDARY, 'left', 1.4);
  drawHpBar(ctx, fighter, rect.x + 20, rect.y + 158, rect.width - 40, 22, accent, alignRight);
  drawText(
    ctx,
    `${Math.ceil(fighter.hp).toLocaleString()} / ${Math.ceil(fighter.maxHp).toLocaleString()}`,
    rect.x + 20,
    rect.y + 198,
    13,
    800,
    TEXT_PRIMARY
  );

  drawResource(ctx, fighter, rect.x + 20, rect.y + 230, rect.width - 40, accent);
  drawText(ctx, 'ABILITY READINESS', rect.x + 20, rect.y + 306, 12, 900, TEXT_SECONDARY, 'left', 1.2);
  fighter.abilities.slice(0, 5).forEach((ability, index) => {
    drawAbilityTile(ctx, ability, rect.x + 20, rect.y + 323 + index * 75, rect.width - 40, 62, accent);
  });

  drawText(ctx, 'STATUS', rect.x + 20, rect.y + 716, 12, 900, TEXT_SECONDARY, 'left', 1.2);
  drawStatuses(ctx, fighter, rect.x + 20, rect.y + 734, rect.width - 40, accent);
}

export function drawVerticalFighterHeader(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 18, 'rgba(9, 18, 33, 0.9)', PANEL_BORDER);
  drawText(
    ctx,
    alignRight ? 'FIGHTER B' : 'FIGHTER A',
    alignRight ? rect.x + rect.width - 22 : rect.x + 22,
    rect.y + 30,
    12,
    900,
    accent,
    alignRight ? 'right' : 'left',
    1.4
  );
  drawFittedText(
    ctx,
    fighter.name,
    alignRight ? rect.x + rect.width - 22 : rect.x + 22,
    rect.y + 68,
    rect.width - 44,
    24,
    900,
    TEXT_PRIMARY,
    alignRight ? 'right' : 'left'
  );
  drawHpBar(ctx, fighter, rect.x + 22, rect.y + 88, rect.width - 44, 22, accent, alignRight);
  drawText(
    ctx,
    `${Math.ceil(fighter.hp).toLocaleString()} HP`,
    alignRight ? rect.x + rect.width - 22 : rect.x + 22,
    rect.y + 135,
    13,
    800,
    TEXT_SECONDARY,
    alignRight ? 'right' : 'left'
  );
}

export function drawVerticalInfoPanel(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string
): void {
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 16, PANEL_FILL, PANEL_BORDER);
  drawText(ctx, fighter.name.toUpperCase(), rect.x + 18, rect.y + 27, 12, 900, accent, 'left', 1.1);
  drawResource(ctx, fighter, rect.x + 18, rect.y + 40, rect.width - 36, accent, true);
  drawStatuses(ctx, fighter, rect.x + 18, rect.y + 105, rect.width - 36, accent);
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

export function drawCalloutPanel(
  ctx: CanvasRenderingContext2D,
  callout: BroadcastCallout | null,
  rect: BroadcastRect,
  accent: string,
  fallbackEyebrow: string
): void {
  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 17, PANEL_FILL, PANEL_BORDER);
  drawCallout(
    ctx,
    callout,
    { x: rect.x + 20, y: rect.y + 19, width: rect.width - 40, height: rect.height - 30 },
    accent,
    fallbackEyebrow
  );
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  callout: BroadcastCallout | null,
  arena: BroadcastRect,
  vertical: boolean
): void {
  if (!callout) return;
  const width = vertical ? 700 : 620;
  const height = vertical ? 210 : 180;
  const x = arena.x + (arena.width - width) / 2;
  const y = arena.y + (arena.height - height) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 14, 0.7)';
  roundedRectPath(ctx, arena.x, arena.y, arena.width, arena.height, 18);
  ctx.fill();
  ctx.restore();
  drawPanel(ctx, x, y, width, height, 26, 'rgba(8, 16, 31, 0.96)', 'rgba(122, 243, 190, 0.58)');
  drawText(ctx, callout.eyebrow.toUpperCase(), x + width / 2, y + 48, vertical ? 18 : 15, 900, READY_ACCENT, 'center', 2.2);
  drawFittedText(ctx, callout.title, x + width / 2, y + (vertical ? 113 : 98), width - 64, vertical ? 42 : 36, 950, TEXT_PRIMARY, 'center');
  if (callout.detail) drawText(ctx, callout.detail.toUpperCase(), x + width / 2, y + height - 32, 14, 800, TEXT_SECONDARY, 'center', 1.2);
}

function drawResource(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  x: number,
  y: number,
  width: number,
  accent: string,
  compact = false
): void {
  const resource = fighter.resource;
  drawText(ctx, resource?.name.toUpperCase() ?? 'RESOURCE', x, y + 14, compact ? 11 : 12, 900, TEXT_SECONDARY, 'left', 1.1);
  const barY = y + (compact ? 23 : 27);
  const barHeight = compact ? 12 : 15;
  roundedRectPath(ctx, x, barY, width, barHeight, barHeight / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  if (resource) {
    roundedRectPath(ctx, x, barY, Math.max(5, width * resource.ratio), barHeight, barHeight / 2);
    ctx.fillStyle = accent;
    ctx.fill();
    drawText(ctx, `${Math.round(resource.value)} / ${Math.round(resource.maximum)}`, x + width, y + 14, compact ? 11 : 12, 800, TEXT_PRIMARY, 'right');
  } else {
    drawText(ctx, '—', x + width, y + 14, compact ? 11 : 12, 800, TEXT_SECONDARY, 'right');
  }
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
  drawText(ctx, ability.slot === 'ultimate' ? 'ULT' : ability.slot.toUpperCase(), x + 11, y + 18, 10, 900, ability.slot === 'ultimate' ? '#ffd06b' : accent, 'left', 1);
  drawFittedText(ctx, ability.name, x + 11, y + 39, width - 22, 13, 800, TEXT_PRIMARY, 'left');
  roundedRectPath(ctx, x + 11, y + height - 10, width - 22, 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  roundedRectPath(ctx, x + 11, y + height - 10, Math.max(2, (width - 22) * ability.readiness), 4, 2);
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
    ctx.font = `800 11px Inter, ui-sans-serif, system-ui, sans-serif`;
    const pillWidth = Math.min(width, ctx.measureText(label).width + 20);
    if (cursorX + pillWidth > x + width) break;
    drawPill(ctx, label, cursorX, y, pillWidth, 28, 'rgba(255,255,255,0.035)', accent, TEXT_PRIMARY, 11);
    cursorX += pillWidth + 7;
  }
}
