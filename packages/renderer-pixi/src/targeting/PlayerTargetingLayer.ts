import { Graphics } from 'pixi.js';
import type { AbilitySlot, EntitySnapshot, Vec2, WorldSnapshot } from '@kinetic/protocol';
import { evaluatePlayerAim, resolvePlayerTargetingPreview } from '../playerTargeting';

export class PlayerTargetingLayer {
  readonly graphics = new Graphics();

  private aimPoint: Vec2 | null = null;
  private pointerAimEnabled = true;
  private previewSlot: AbilitySlot = 'basic';
  private hitmarkerFlash = 0;

  setAimPoint(point: Vec2 | null): void {
    this.aimPoint = point ? { ...point } : null;
  }

  setPointerAimEnabled(enabled: boolean): void {
    if (this.pointerAimEnabled === enabled) return;
    this.pointerAimEnabled = enabled;
    if (!enabled) this.graphics.clear();
  }

  setPreviewSlot(slot: AbilitySlot): void {
    this.previewSlot = slot;
  }

  raiseHitmarker(value: number): void {
    this.hitmarkerFlash = Math.max(this.hitmarkerFlash, value);
  }

  draw(snapshot: WorldSnapshot, alpha: number): void {
    this.graphics.clear();
    const player = snapshot.entities.find((entity) => entity.controller === 'player');
    if (!player) return;
    const x = player.prevX + (player.x - player.prevX) * alpha;
    const y = player.prevY + (player.y - player.prevY) * alpha;
    if (!this.pointerAimEnabled) {
      this.drawTouchAimArrow(player, x, y);
      return;
    }
    if (!this.aimPoint) return;
    const preview = resolvePlayerTargetingPreview(player, this.previewSlot);
    const validity = evaluatePlayerAim(snapshot, player, this.aimPoint, preview);
    const color = validity.valid ? 0x72f2a0 : validity.reason === 'too-close' ? 0xffc05c : 0xff5b68;
    if (preview.finiteRange && preview.maxRange > 0) {
      this.graphics.circle(x, y, preview.maxRange).fill({ color, alpha: 0.012 }).stroke({ color, width: 2, alpha: 0.38 });
      if (preview.minRange > 0) this.graphics.circle(x, y, preview.minRange).stroke({ color: 0xffb85b, width: 1.6, alpha: 0.5 });
    } else if (preview.targeting === 'self') {
      this.graphics.circle(x, y, player.radius * 1.75).stroke({ color, width: 2.5, alpha: 0.55 });
    }
    const aimDx = this.aimPoint.x - x;
    const aimDy = this.aimPoint.y - y;
    const aimLength = Math.hypot(aimDx, aimDy) || 1;
    const nx = aimDx / aimLength;
    const ny = aimDy / aimLength;
    const arrowDistance = player.radius * 1.78;
    const arrowX = x + nx * arrowDistance;
    const arrowY = y + ny * arrowDistance;
    const sideX = -ny;
    const sideY = nx;
    this.graphics.moveTo(arrowX + nx * 11, arrowY + ny * 11)
      .lineTo(arrowX - nx * 8 + sideX * 7, arrowY - ny * 8 + sideY * 7)
      .lineTo(arrowX - nx * 8 - sideX * 7, arrowY - ny * 8 - sideY * 7)
      .closePath().fill({ color, alpha: 0.96 });
    const crossX = this.aimPoint.x;
    const crossY = this.aimPoint.y;
    const crossRadius = preview.targeting === 'area' ? 15 : 10;
    this.graphics.circle(crossX, crossY, crossRadius).stroke({ color, width: 2.4, alpha: 0.94 });
    this.graphics.moveTo(crossX - crossRadius - 7, crossY).lineTo(crossX - 3, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.graphics.moveTo(crossX + 3, crossY).lineTo(crossX + crossRadius + 7, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.graphics.moveTo(crossX, crossY - crossRadius - 7).lineTo(crossX, crossY - 3).stroke({ color, width: 2, alpha: 0.9 });
    this.graphics.moveTo(crossX, crossY + 3).lineTo(crossX, crossY + crossRadius + 7).stroke({ color, width: 2, alpha: 0.9 });
    if (preview.targeting === 'area') this.graphics.circle(crossX, crossY, Math.min(110, Math.max(28, preview.maxRange * 0.14))).stroke({ color, width: 1.3, alpha: 0.3 });
    if (this.hitmarkerFlash > 0.02) {
      const markerAlpha = Math.min(1, this.hitmarkerFlash);
      const markerRadius = 12 + markerAlpha * 5;
      this.graphics.moveTo(crossX - markerRadius, crossY - markerRadius).lineTo(crossX - 4, crossY - 4)
        .moveTo(crossX + markerRadius, crossY - markerRadius).lineTo(crossX + 4, crossY - 4)
        .moveTo(crossX - markerRadius, crossY + markerRadius).lineTo(crossX - 4, crossY + 4)
        .moveTo(crossX + markerRadius, crossY + markerRadius).lineTo(crossX + 4, crossY + 4)
        .stroke({ color: 0xffffff, width: 3.4, alpha: markerAlpha });
    }
    this.hitmarkerFlash *= 0.82;
  }

  reset(): void {
    this.hitmarkerFlash = 0;
    this.graphics.clear();
  }

  private drawTouchAimArrow(player: EntitySnapshot, x: number, y: number): void {
    const preview = resolvePlayerTargetingPreview(player, this.previewSlot);
    if (preview.finiteRange && preview.maxRange > 0) {
      this.graphics.circle(x, y, preview.maxRange).fill({ color: 0x72f2a0, alpha: 0.012 }).stroke({ color: 0x72f2a0, width: 2, alpha: 0.32 });
      if (preview.minRange > 0) this.graphics.circle(x, y, preview.minRange).stroke({ color: 0xffb85b, width: 1.6, alpha: 0.42 });
    } else if (preview.targeting === 'self') {
      this.graphics.circle(x, y, player.radius * 1.75).stroke({ color: 0x72f2a0, width: 2.4, alpha: 0.5 });
    }
    const nx = Math.cos(player.rotation);
    const ny = Math.sin(player.rotation);
    const x1 = x + nx * player.radius * 1.1;
    const y1 = y + ny * player.radius * 1.1;
    const x2 = x + nx * player.radius * 3.4;
    const y2 = y + ny * player.radius * 3.4;
    this.graphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0xe6eefb, width: 5, alpha: 0.26 });
    this.graphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x0a0d14, width: 3, alpha: 0.92 });
  }
}
