import { Graphics } from 'pixi.js';
import type { EntitySnapshot } from '@kinetic/protocol';
import type { VisualLod } from './types';

/** Pyro-only furnace silhouette driven entirely by snapshot Heat/status state. */
export class PyroFurnaceAura {
  readonly graphics = new Graphics();

  update(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    this.graphics.clear();
    if (entity.fighterId !== 'pyro-brawler') return;

    const heat = entity.resources?.find((resource) => resource.resourceId === 'heat');
    const ratio = heat ? Math.max(0, Math.min(1, heat.value / Math.max(1, heat.maximum))) : 0;
    const meltdown = entity.statuses.some((status) => status.statusId === 'meltdown');
    const cinderRush = entity.statuses.some((status) => status.statusId === 'magma-dash');
    const active = Math.max(ratio, meltdown ? 0.82 : 0, cinderRush ? 0.42 : 0);
    if (active <= 0.01) return;

    const r = entity.radius;
    const pulse = reducedMotion ? 0.82 : 0.76 + Math.sin(elapsedSeconds * (5 + active * 5) + entity.id) * 0.16;
    const glowRadius = r * (1.02 + active * 0.34 + pulse * 0.035);
    const glowAlpha = (lod === 'army' ? 0.04 : 0.07) + active * (lod === 'army' ? 0.08 : 0.16);

    this.graphics.circle(0, 0, glowRadius * 1.2).fill({ color: meltdown ? 0xff2618 : 0xff4b1f, alpha: glowAlpha * 0.45 });
    this.graphics.circle(0, 0, glowRadius).fill({ color: 0xff7a2c, alpha: glowAlpha });
    this.graphics.circle(0, 0, r * (0.62 + active * 0.08)).stroke({ color: 0xffef8a, width: lod === 'army' ? 1.2 : 2.2, alpha: 0.12 + active * 0.34 });

    if (cinderRush) {
      const rushPulse = reducedMotion ? 0.9 : 0.76 + Math.sin(elapsedSeconds * 18 + entity.id) * 0.2;
      const trailLength = r * (1.3 + rushPulse * 0.45);
      const halfWidth = r * 0.24;
      this.graphics
        .moveTo(-r * 0.62, -halfWidth)
        .quadraticCurveTo(-r - trailLength * 0.38, -halfWidth * 0.72, -r - trailLength, 0)
        .quadraticCurveTo(-r - trailLength * 0.38, halfWidth * 0.72, -r * 0.62, halfWidth)
        .closePath()
        .fill({ color: 0xff431f, alpha: 0.38 });
      this.graphics
        .moveTo(-r * 0.58, -halfWidth * 0.58)
        .quadraticCurveTo(-r - trailLength * 0.28, 0, -r - trailLength * 0.72, 0)
        .quadraticCurveTo(-r - trailLength * 0.22, halfWidth * 0.38, -r * 0.58, halfWidth * 0.58)
        .closePath()
        .fill({ color: 0xffb043, alpha: 0.78 });
      this.graphics
        .moveTo(-r * 0.5, -halfWidth * 0.22)
        .lineTo(-r - trailLength * 0.48, 0)
        .lineTo(-r * 0.5, halfWidth * 0.22)
        .closePath()
        .fill({ color: 0xffffb0, alpha: 0.92 });
    }

    const vents = lod === 'army' ? 4 : 8;
    for (let index = 0; index < vents; index += 1) {
      const baseAngle = index / vents * Math.PI * 2;
      const flicker = reducedMotion ? 0 : Math.sin(elapsedSeconds * (4.5 + index * 0.17) + index * 2.3) * 0.1;
      const angle = baseAngle + flicker;
      const inner = r * (0.78 + (index % 2) * 0.08);
      const length = r * (0.12 + active * 0.3) * (0.82 + pulse * 0.2);
      const width = r * (0.045 + active * 0.025);
      const x = Math.cos(angle) * inner;
      const y = Math.sin(angle) * inner;
      const tipX = Math.cos(angle) * (inner + length);
      const tipY = Math.sin(angle) * (inner + length);
      const sideX = -Math.sin(angle) * width;
      const sideY = Math.cos(angle) * width;
      this.graphics
        .moveTo(x - sideX, y - sideY)
        .lineTo(tipX, tipY)
        .lineTo(x + sideX, y + sideY)
        .closePath()
        .fill({ color: index % 3 === 0 ? 0xfff09a : 0xff6a26, alpha: 0.3 + active * 0.55 });
    }
  }

  reset(): void {
    this.graphics.clear();
  }
}
