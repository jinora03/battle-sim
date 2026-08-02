import { Graphics } from 'pixi.js';
import type { EntitySnapshot } from '@kinetic/protocol';
import type { VisualLod } from './types';

export class FighterStatusIndicators {
  readonly graphics = new Graphics();

  update(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    uiAngle: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    this.graphics.clear();
    this.graphics.rotation = uiAngle;
    const targetLock = entity.statuses.find((status) => status.statusId === 'target-lock');
    if (!targetLock) return;

    const stacks = Math.max(1, Math.min(4, targetLock.stacks));
    const radius = entity.radius * (lod === 'army' ? 1.42 : 1.58);
    const pulse = reducedMotion ? 1 : 0.78 + Math.sin(elapsedSeconds * 8 + entity.id) * 0.12;
    const color = stacks >= 4 ? 0xff5a66 : 0x65d8ff;
    this.graphics.circle(0, 0, radius).stroke({ color, width: lod === 'army' ? 1.5 : 2.2, alpha: 0.28 + pulse * 0.32 });
    for (let index = 0; index < stacks; index += 1) {
      const angle = -Math.PI / 2 + (index / 4) * Math.PI * 2;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const centerX = Math.cos(angle) * radius;
      const centerY = Math.sin(angle) * radius;
      const half = entity.radius * 0.22;
      this.graphics
        .moveTo(centerX - tangentX * half, centerY - tangentY * half)
        .lineTo(centerX + tangentX * half, centerY + tangentY * half)
        .stroke({ color, width: lod === 'army' ? 2 : 3.2, alpha: 0.72 + pulse * 0.22 });
    }
  }

  reset(): void {
    this.graphics.clear();
  }
}
