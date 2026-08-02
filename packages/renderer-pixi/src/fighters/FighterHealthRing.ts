import { Graphics } from 'pixi.js';
import type { EntitySnapshot } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';
import type { VisualLod } from './types';

function drawRingArc(
  graphics: Graphics,
  radius: number,
  start: number,
  sweep: number,
  ratio: number,
  color: number,
  width: number,
  alpha: number
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped <= 0) return;
  const steps = Math.max(4, Math.ceil(36 * clamped));
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + sweep * clamped * (index / steps);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  }
  graphics.stroke({ color, width, alpha, cap: 'round' });
}

export class FighterHealthRing {
  readonly graphics = new Graphics();
  private displayedHpRatio: number;
  private delayedHpRatio: number;
  private lastRenderKey = '';

  constructor(entity: EntitySnapshot) {
    this.displayedHpRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
    this.delayedHpRatio = this.displayedHpRatio;
  }

  update(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    uiAngle: number,
    lod: VisualLod,
    profileId: PresentationSettings['renderProfile'],
    visible: boolean
  ): void {
    this.graphics.position.set(0, 0);
    this.graphics.rotation = uiAngle;
    const actualRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
    this.displayedHpRatio += (actualRatio - this.displayedHpRatio) * 0.38;
    if (actualRatio < this.delayedHpRatio) this.delayedHpRatio += (actualRatio - this.delayedHpRatio) * 0.055;
    else this.delayedHpRatio = actualRatio;

    if (visible && profileId === 'standard') {
      const ringRadius = entity.radius * (entity.controller === 'player' ? 1.33 : 1.27);
      const lineWidth = entity.controller === 'player'
        ? Math.max(4.5, entity.radius * 0.15)
        : lod === 'army'
          ? 2.2
          : Math.max(3.2, entity.radius * 0.115);
      const startAngle = Math.PI * 0.72;
      const sweep = Math.PI * 1.56;
      const pulseStep = actualRatio <= 0.25 && lod !== 'army'
        ? Math.round((0.4 + Math.sin(elapsedSeconds * 8) * 0.18) * 20)
        : 0;
      const renderKey = `${Math.round(this.displayedHpRatio * 160)}:${Math.round(this.delayedHpRatio * 160)}:${Math.round(actualRatio * 160)}:${pulseStep}:${lod}:${entity.controller}`;
      if (renderKey !== this.lastRenderKey) {
        this.lastRenderKey = renderKey;
        this.graphics.clear();
        drawRingArc(this.graphics, ringRadius, startAngle, sweep, 1, 0x111722, lineWidth + 2, lod === 'army' ? 0.55 : 0.88);
        if (this.delayedHpRatio > actualRatio + 0.01) {
          drawRingArc(this.graphics, ringRadius, startAngle, sweep, this.delayedHpRatio, 0xffc65a, lineWidth, 0.82);
        }
        const hpColor = actualRatio > 0.58 ? 0x72f29a : actualRatio > 0.28 ? 0xffc45f : 0xff4f58;
        drawRingArc(this.graphics, ringRadius, startAngle, sweep, this.displayedHpRatio, hpColor, lineWidth, 0.98);
        if (actualRatio <= 0.25 && lod !== 'army') {
          drawRingArc(this.graphics, ringRadius + lineWidth * 0.8, startAngle, sweep, actualRatio, 0xff5860, 1.8, pulseStep / 20);
        }
      }
    } else if (this.lastRenderKey !== 'hidden') {
      this.lastRenderKey = 'hidden';
      this.graphics.clear();
    }
  }

  resetRenderCache(): void {
    this.graphics.clear();
    this.lastRenderKey = '';
  }
}
