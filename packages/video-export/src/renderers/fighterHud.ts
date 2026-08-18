import type { BroadcastRect } from '../broadcastLayout';
import { resolveCreatorLiveStatus } from '../creatorLiveStatus';
import { resolveCreatorFighterName } from '../creatorMatchupHook';
import type {
  BroadcastAbilityView,
  BroadcastCallout,
  BroadcastFighterView,
  BroadcastResourceView
} from '../broadcastScene';
import {
  getLandscapeFighterCardGeometry,
  getVerticalFighterCardGeometry,
  type FighterWeaponGeometry
} from '../fighterCardGeometry';
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
import { drawBroadcastFighterBody } from './fighterPortrait';
import { drawWeaponPreview } from './weaponPreview';

export function drawLandscapeFighterPanel(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const geometry = getLandscapeFighterCardGeometry(rect, alignRight, fighter.memberCount <= 1);
  const { identity, hp, padding } = geometry;
  const textAlign: CanvasTextAlign = identity.textAlign;

  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 18, PANEL_FILL, PANEL_BORDER);
  drawText(ctx, alignRight ? 'FIGHTER B' : 'FIGHTER A', identity.textX, geometry.eyebrowY, 13, 900, accent, textAlign, 1.2);
  drawFittedText(ctx, fighter.name, identity.textX, identity.nameY, identity.maxWidth, 33, 950, TEXT_PRIMARY, textAlign);
  if (fighter.memberCount > 1) {
    drawText(ctx, `${fighter.memberCount} fighters`, identity.textX, identity.identityY, 13, 750, TEXT_SECONDARY, textAlign);
  } else {
    drawFittedText(ctx, fighter.identity, identity.textX, identity.identityY, identity.maxWidth, 14, 800, accent, textAlign);
    if (geometry.weapon) drawLandscapeWeaponBlock(ctx, fighter, geometry.weapon, accent);
  }

  if (hp.labelY !== null) {
    drawText(ctx, 'HP', identity.textX, hp.labelY, 13, 900, TEXT_SECONDARY, textAlign, 1.1);
  }
  drawHpBar(ctx, fighter, hp.bar.x, hp.bar.y, hp.bar.width, hp.bar.height, accent, alignRight);
  drawText(
    ctx,
    `${Math.ceil(fighter.hp).toLocaleString()} / ${Math.ceil(fighter.maxHp).toLocaleString()}`,
    identity.textX,
    hp.valueY,
    15,
    850,
    TEXT_PRIMARY,
    textAlign
  );

  const abilityHeadingY = fighter.resource ? rect.y + 324 : rect.y + 270;
  if (fighter.resource) {
    drawLandscapeResource(ctx, fighter.resource, rect, accent, alignRight);
  }

  drawText(ctx, 'ABILITY READINESS', identity.textX, abilityHeadingY, 13, 900, TEXT_SECONDARY, textAlign, 1.05);
  const abilityStartY = abilityHeadingY + 20;
  fighter.abilities.slice(0, 5).forEach((ability, index) => {
    drawAbilityTile(ctx, ability, rect.x + padding, abilityStartY + index * 78, rect.width - padding * 2, 66, accent);
  });

  const statusY = rect.y + rect.height - 122;
  drawText(ctx, 'STATUS', identity.textX, statusY, 13, 900, TEXT_SECONDARY, textAlign, 1.05);
  drawStatuses(ctx, fighter, rect.x + padding, statusY + 18, rect.width - padding * 2, accent);
}

export function drawVerticalFighterHeader(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const geometry = getVerticalFighterCardGeometry(rect, alignRight);
  const displayName = resolveCreatorFighterName(fighter);

  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 20, 'rgba(9, 18, 33, 0.92)', PANEL_BORDER);

  // Shorts header stays character-first: actual authored fighter body +
  // viewer-facing name, centered as one mirrored group. A thin HP bar restores
  // battle readability without bringing the old dashboard clutter back.
  drawBroadcastFighterBody(
    ctx,
    fighter,
    geometry.portrait.centerX,
    geometry.portrait.centerY,
    geometry.portrait.radius,
    geometry.portrait.facing
  );
  drawFittedText(
    ctx,
    displayName,
    geometry.name.textX,
    geometry.name.y,
    geometry.name.maxWidth,
    48,
    950,
    TEXT_PRIMARY,
    geometry.name.textAlign
  );
  drawHpBar(
    ctx,
    fighter,
    geometry.hp.x,
    geometry.hp.y,
    geometry.hp.width,
    geometry.hp.height,
    accent,
    alignRight
  );
}

function drawLandscapeWeaponBlock(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  geometry: FighterWeaponGeometry,
  accent: string
): void {
  const previewDrawn = drawWeaponPreview(
    ctx,
    fighter,
    geometry.centerX,
    geometry.previewY,
    geometry.previewSize,
    accent
  );
  drawFittedText(
    ctx,
    fighter.weaponName,
    geometry.centerX,
    previewDrawn ? geometry.labelY : geometry.fallbackLabelY,
    previewDrawn ? geometry.labelWidth : geometry.fallbackLabelWidth,
    13,
    750,
    TEXT_SECONDARY,
    'center'
  );
}

export function drawVerticalLiveStatus(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const padding = 18;
  const textX = alignRight ? rect.x + rect.width - padding : rect.x + padding;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  const live = resolveCreatorLiveStatus(fighter);

  drawPanel(ctx, rect.x, rect.y, rect.width, rect.height, 16, 'rgba(9, 18, 33, 0.88)', PANEL_BORDER);
  drawFittedText(ctx, resolveCreatorFighterName(fighter).toUpperCase(), textX, rect.y + 23, rect.width - padding * 2, 12, 900, accent, textAlign);
  drawFittedText(ctx, live.action, textX, rect.y + 53, rect.width - padding * 2, 18, 900, TEXT_PRIMARY, textAlign);

  const details = [live.status, live.resource].filter((value): value is string => Boolean(value));
  if (details.length === 0) {
    drawText(ctx, 'LIVE', textX, rect.y + 87, 11, 800, TEXT_SECONDARY, textAlign, 0.8);
    return;
  }

  drawFittedText(
    ctx,
    details.join('  ·  '),
    textX,
    rect.y + 87,
    rect.width - padding * 2,
    13,
    800,
    TEXT_SECONDARY,
    textAlign
  );
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

function drawLandscapeResource(
  ctx: CanvasRenderingContext2D,
  resource: BroadcastResourceView,
  rect: BroadcastRect,
  accent: string,
  alignRight: boolean
): void {
  const padding = 24;
  const textX = alignRight ? rect.x + rect.width - padding : rect.x + padding;
  const textAlign: CanvasTextAlign = alignRight ? 'right' : 'left';
  drawText(ctx, resource.name.toUpperCase(), textX, rect.y + 235, 11, 900, TEXT_SECONDARY, textAlign, 1.05);
  const barX = rect.x + padding;
  const barY = rect.y + 246;
  const barWidth = rect.width - padding * 2;
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
  const active = ability.phase === 'casting' || ability.phase === 'armed';
  drawPanel(
    ctx,
    x,
    y,
    width,
    height,
    11,
    active ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.025)',
    active ? accent : 'rgba(154,190,227,0.13)'
  );
  drawText(ctx, ability.slot === 'ultimate' ? 'ULT' : ability.slot.toUpperCase(), x + 12, y + 18, 11, 900, ability.slot === 'ultimate' ? '#ffd06b' : accent, 'left', 0.7);
  if (active) drawText(ctx, 'ACTIVE', x + width - 12, y + 18, 9, 900, accent, 'right', 0.55);
  drawFittedText(ctx, ability.name, x + 12, y + 41, width - 24, 15, 850, TEXT_PRIMARY, 'left');
  roundedRectPath(ctx, x + 12, y + height - 10, width - 24, 5, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  roundedRectPath(ctx, x + 12, y + height - 10, Math.max(2, (width - 24) * ability.readiness), 5, 2.5);
  ctx.fillStyle = active ? '#ffffff' : ability.phase === 'ready' ? READY_ACCENT : accent;
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
