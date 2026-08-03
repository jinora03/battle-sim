import { Graphics } from 'pixi.js';
import type { EntitySnapshot } from '@kinetic/protocol';
import type { VisualLod } from './types';

/** Ballast-only counterweight silhouette and mass-state presentation. */
export class BallastGravityRig {
  readonly graphics = new Graphics();

  update(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    this.graphics.clear();
    if (entity.fighterId !== 'ballast') return;

    const radius = entity.radius;
    const anchored = entity.statuses.some((status) => status.statusId === 'anchored');
    const lastCall = entity.statuses.some((status) => status.statusId === 'last-call');
    const pulse = reducedMotion ? 0.5 : 0.5 + Math.sin(elapsedSeconds * (lastCall ? 6.5 : 2.2) + entity.id) * 0.5;
    const outlineWidth = lod === 'army' ? 1.2 : Math.max(2, radius * 0.055);

    if (lastCall) {
      this.graphics.circle(0, 0, radius * (1.22 + pulse * 0.12))
        .fill({ color: 0x6b47a0, alpha: lod === 'army' ? 0.08 : 0.15 });
      this.graphics.circle(0, 0, radius * (1.35 + pulse * 0.18))
        .stroke({ color: 0x9cefff, width: outlineWidth, alpha: 0.3 + pulse * 0.25 });
    }

    const beamWidth = radius * 2.65;
    this.graphics.rect(-beamWidth / 2, -radius * 0.09, beamWidth, radius * 0.18)
      .fill({ color: 0x21182d, alpha: 0.92 });
    this.graphics.rect(-beamWidth / 2, -radius * 0.09, beamWidth, radius * 0.18)
      .stroke({ color: 0xeefcff, width: outlineWidth, alpha: 0.72 });

    for (const direction of [-1, 1]) {
      const x = direction * radius * 1.28;
      this.graphics.circle(x, 0, radius * 0.34)
        .fill({ color: anchored ? 0x2a2333 : 0x453758, alpha: 1 });
      this.graphics.circle(x, 0, radius * 0.34)
        .stroke({ color: anchored ? 0xb8f4ff : 0xcdb6ff, width: outlineWidth, alpha: 0.9 });
      this.graphics.circle(x, 0, radius * 0.12)
        .fill({ color: anchored ? 0xffffff : 0x7ceaff, alpha: 0.9 });
    }

    if (lod !== 'army') {
      const orbitAngle = reducedMotion ? -0.55 : elapsedSeconds * 1.65 + entity.id * 0.7;
      const orbitRadius = radius * 1.58;
      const stoneX = Math.cos(orbitAngle) * orbitRadius;
      const stoneY = Math.sin(orbitAngle) * orbitRadius;
      this.graphics.circle(stoneX, stoneY, radius * 0.16)
        .fill({ color: 0x251b31, alpha: 1 });
      this.graphics.circle(stoneX, stoneY, radius * 0.16)
        .stroke({ color: 0x8deeff, width: Math.max(1.5, outlineWidth * 0.8), alpha: 0.92 });
    }

    if (anchored) {
      const ringCount = lod === 'army' ? 1 : 3;
      for (let index = 0; index < ringCount; index += 1) {
        const ratio = index / Math.max(1, ringCount - 1);
        this.graphics.circle(0, 0, radius * (1.05 + ratio * 0.28))
          .stroke({ color: 0x8beeff, width: outlineWidth, alpha: 0.3 - ratio * 0.08 });
      }
    }
  }

  reset(): void {
    this.graphics.clear();
  }
}
