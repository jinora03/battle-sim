import { Graphics } from 'pixi.js';
import type { EntitySnapshot } from '@kinetic/protocol';
import type { VisualLod } from './types';

/** Persistent, snapshot-driven status presentation attached to each fighter. */
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

    const burn = entity.statuses.find((status) => status.statusId === 'burn');
    if (burn) this.drawBurn(entity, burn.stacks, elapsedSeconds, reducedMotion, lod);

    const meltdown = entity.statuses.find((status) => status.statusId === 'meltdown');
    if (meltdown) this.drawMeltdown(entity, elapsedSeconds, reducedMotion, lod);

    const targetLock = entity.statuses.find((status) => status.statusId === 'target-lock');
    if (targetLock) this.drawTargetLock(entity, targetLock.stacks, elapsedSeconds, reducedMotion, lod);
  }

  reset(): void {
    this.graphics.clear();
  }

  private drawBurn(
    entity: EntitySnapshot,
    rawStacks: number,
    elapsedSeconds: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    const stacks = Math.max(1, Math.min(5, rawStacks));
    const intensity = stacks / 5;
    const r = entity.radius;
    const pulse = reducedMotion ? 0.82 : 0.78 + Math.sin(elapsedSeconds * 9 + entity.id * 0.7) * 0.16;
    const auraRadius = r * (1.06 + intensity * 0.18 + pulse * 0.025);

    this.graphics.circle(0, 0, auraRadius * 1.12).fill({ color: 0xff421f, alpha: 0.035 + intensity * 0.055 });
    this.graphics.circle(0, 0, auraRadius)
      .stroke({ color: stacks >= 4 ? 0xffe36c : 0xff6a2f, width: lod === 'army' ? 1.6 : 2.6, alpha: 0.34 + intensity * 0.3 });

    const flameCount = lod === 'army' ? Math.min(3, stacks) : 3 + stacks;
    for (let index = 0; index < flameCount; index += 1) {
      const phase = entity.id * 0.91 + index * 1.73;
      const sway = reducedMotion ? 0 : Math.sin(elapsedSeconds * (5.6 + index * 0.31) + phase) * 0.18;
      const angle = -Math.PI * 0.95 + (index / Math.max(1, flameCount - 1)) * Math.PI * 1.9 + sway;
      const baseRadius = r * (0.76 + (index % 2) * 0.1);
      const baseX = Math.cos(angle) * baseRadius;
      const baseY = Math.sin(angle) * baseRadius;
      const height = r * (0.28 + intensity * 0.28 + (index % 3) * 0.04) * pulse;
      const width = r * (0.085 + intensity * 0.035);
      const tipX = baseX + Math.sin(angle + elapsedSeconds * 2.4 + phase) * height * 0.18;
      const tipY = baseY - height;
      const tangentX = -Math.sin(angle) * width;
      const tangentY = Math.cos(angle) * width;

      this.graphics
        .moveTo(baseX - tangentX, baseY - tangentY)
        .quadraticCurveTo(baseX + width * 0.25, baseY - height * 0.46, tipX, tipY)
        .quadraticCurveTo(baseX - width * 0.25, baseY - height * 0.42, baseX + tangentX, baseY + tangentY)
        .closePath()
        .fill({ color: index % 3 === 0 ? 0xffed72 : index % 2 === 0 ? 0xff8a2f : 0xff4424, alpha: 0.6 + intensity * 0.32 });
    }

    if (lod !== 'army') {
      const emberCount = 2 + Math.floor(intensity * 3);
      for (let index = 0; index < emberCount; index += 1) {
        const phase = elapsedSeconds * (1.7 + index * 0.22) + entity.id * 0.37 + index * 2.1;
        const orbit = r * (0.55 + (index % 2) * 0.32);
        const lift = ((elapsedSeconds * (12 + index * 2) + entity.id * 7 + index * 11) % (r * 1.45));
        const x = Math.cos(phase) * orbit;
        const y = r * 0.35 - lift;
        this.graphics.circle(x, y, Math.max(1.5, r * 0.035)).fill({ color: index % 2 ? 0xffe16b : 0xff6b2a, alpha: 0.45 + intensity * 0.38 });
      }
    }
  }

  private drawMeltdown(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    const r = entity.radius;
    const pulse = reducedMotion ? 0.8 : 0.72 + Math.sin(elapsedSeconds * 11 + entity.id) * 0.18;
    const outer = r * (1.34 + pulse * 0.08);
    this.graphics.circle(0, 0, outer * 1.12).fill({ color: 0xff2c16, alpha: lod === 'army' ? 0.06 : 0.1 });
    this.graphics.circle(0, 0, outer).stroke({ color: 0xffee83, width: lod === 'army' ? 2 : 4, alpha: 0.38 + pulse * 0.34 });
    this.graphics.circle(0, 0, outer * 0.86).stroke({ color: 0xff3d22, width: lod === 'army' ? 1.5 : 2.6, alpha: 0.42 });
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + (reducedMotion ? 0 : elapsedSeconds * 1.8);
      const start = r * 1.08;
      const end = outer * (0.98 + (index % 2) * 0.1);
      this.graphics.moveTo(Math.cos(angle) * start, Math.sin(angle) * start)
        .lineTo(Math.cos(angle) * end, Math.sin(angle) * end)
        .stroke({ color: index % 2 ? 0xff7a2e : 0xfff2a0, width: lod === 'army' ? 1.5 : 2.5, alpha: 0.48 + pulse * 0.26 });
    }
  }

  private drawTargetLock(
    entity: EntitySnapshot,
    rawStacks: number,
    elapsedSeconds: number,
    reducedMotion: boolean,
    lod: VisualLod
  ): void {
    const stacks = Math.max(1, Math.min(4, rawStacks));
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
}
