import { Graphics } from 'pixi.js';
import type { CombatResourceStateSnapshot, EntitySnapshot } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';
import type { VisualLod } from './types';

const RESOURCE_COLORS: Readonly<Record<string, number>> = {
  heat: 0xff7a32,
  charge: 0x70ddff,
  rage: 0xff4f58,
  frost: 0xbff7ff
};

function drawArc(
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
  const steps = Math.max(2, Math.ceil(8 * clamped));
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + sweep * clamped * (index / steps);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  }
  graphics.stroke({ color, width, alpha, cap: 'round' });
}

function primaryResource(entity: EntitySnapshot): CombatResourceStateSnapshot | null {
  return entity.resources?.[0] ?? null;
}

/** Draws a generic segmented outer meter for the fighter's primary resource. */
export class FighterResourceRing {
  readonly graphics = new Graphics();
  private lastRenderKey = '';

  constructor(private readonly fallbackColor: number) {}

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
    const resource = primaryResource(entity);
    if (!visible || profileId !== 'standard' || !resource || resource.maximum <= 0) {
      if (this.lastRenderKey !== 'hidden') {
        this.lastRenderKey = 'hidden';
        this.graphics.clear();
      }
      return;
    }

    const ratio = Math.max(0, Math.min(1, resource.value / resource.maximum));
    const segments = lod === 'army' ? 6 : 10;
    const pulse = ratio >= 0.8 && lod !== 'army'
      ? Math.round((0.78 + Math.sin(elapsedSeconds * 7.5 + entity.id) * 0.16) * 20)
      : 16;
    const renderKey = `${resource.resourceId}:${Math.round(ratio * segments * 16)}:${segments}:${pulse}:${entity.controller}`;
    if (renderKey === this.lastRenderKey) return;
    this.lastRenderKey = renderKey;
    this.graphics.clear();

    const radius = entity.radius * (entity.controller === 'player' ? 1.53 : 1.47);
    const width = entity.controller === 'player'
      ? Math.max(3.4, entity.radius * 0.105)
      : lod === 'army'
        ? 1.7
        : Math.max(2.5, entity.radius * 0.082);
    const color = RESOURCE_COLORS[resource.resourceId] ?? this.fallbackColor;
    const start = Math.PI * 0.72;
    const totalSweep = Math.PI * 1.56;
    const gap = lod === 'army' ? 0.035 : 0.045;
    const segmentSweep = totalSweep / segments;

    for (let index = 0; index < segments; index += 1) {
      const segmentStart = start + index * segmentSweep + gap / 2;
      const drawableSweep = Math.max(0.01, segmentSweep - gap);
      drawArc(this.graphics, radius, segmentStart, drawableSweep, 1, 0x141b25, width + 1.4, 0.82);
      const segmentFill = Math.max(0, Math.min(1, ratio * segments - index));
      drawArc(this.graphics, radius, segmentStart, drawableSweep, segmentFill, color, width, pulse / 20);
    }
  }

  resetRenderCache(): void {
    this.graphics.clear();
    this.lastRenderKey = '';
  }
}
