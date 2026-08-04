import { Graphics } from 'pixi.js';
import { getProjectileSource } from '@kinetic/content';
import type { ProjectileSnapshot } from '@kinetic/protocol';

const GUNNER_BULLET_IDS = new Set([
  'automatic-rifle',
  'tactical-round',
  'suppressive-round',
  'pinning-round-projectile',
  'kill-zone-round'
]);

export class ProjectileLayer {
  readonly graphics = new Graphics();

  draw(projectiles: readonly ProjectileSnapshot[], alpha: number, elapsedSeconds: number): void {
    this.graphics.clear();
    for (const projectile of projectiles) {
      const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
      const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
      const weapon = getProjectileSource(projectile.weaponId);
      const color = projectile.team === 1 ? 0x72dfff : 0xff8a55;
      if (weapon.id === 'flame-fists') {
        // Flame Jet uses a layered flame tongue rather than the generic team bolt.
        const dx = Math.cos(projectile.rotation);
        const dy = Math.sin(projectile.rotation);
        const sideX = -dy;
        const sideY = dx;
        const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
        const length = Math.max(20, speed * 2.8);
        const flicker = 0.82 + Math.sin(elapsedSeconds * 19 + projectile.id * 1.7) * 0.18;
        const tailX = x - dx * length;
        const tailY = y - dy * length;
        this.graphics.moveTo(tailX, tailY).lineTo(x, y)
          .stroke({ color: 0xff351d, width: Math.max(8, projectile.radius * 1.65), alpha: 0.24 });
        this.graphics.moveTo(tailX + sideX * 2.5, tailY + sideY * 2.5).lineTo(x, y)
          .stroke({ color: 0xff6a25, width: Math.max(5, projectile.radius * 1.08), alpha: 0.78 });
        this.graphics.moveTo(x - dx * length * 0.62 - sideX * 1.5, y - dy * length * 0.62 - sideY * 1.5).lineTo(x + dx * projectile.radius, y + dy * projectile.radius)
          .stroke({ color: 0xffe574, width: Math.max(2.5, projectile.radius * 0.5), alpha: 0.94 });
        this.graphics.circle(x, y, projectile.radius * (0.88 + flicker * 0.18)).fill({ color: 0xff8b2d, alpha: 0.92 });
        this.graphics.circle(x + dx * projectile.radius * 0.24, y + dy * projectile.radius * 0.24, projectile.radius * 0.48).fill({ color: 0xffffb0, alpha: 0.98 });
        continue;
      }
      if (GUNNER_BULLET_IDS.has(weapon.id)) {
        const dx = Math.cos(projectile.rotation);
        const dy = Math.sin(projectile.rotation);
        const sideX = -dy;
        const sideY = dx;
        const bulletLength = Math.max(10, projectile.radius * (weapon.id === 'pinning-round-projectile' ? 4.6 : 3.5));
        const halfWidth = Math.max(2, projectile.radius * 0.72);
        const tailX = x - dx * bulletLength * 0.7;
        const tailY = y - dy * bulletLength * 0.7;
        const tipX = x + dx * bulletLength * 0.3;
        const tipY = y + dy * bulletLength * 0.3;
        const tracerLength = weapon.id === 'kill-zone-round' ? bulletLength * 2.8 : bulletLength * 2.1;
        const tracerColor = weapon.id === 'tactical-round' ? 0x8ee8ff : weapon.id === 'pinning-round-projectile' ? 0xff9f54 : 0xffd36a;

        this.graphics.moveTo(x - dx * tracerLength, y - dy * tracerLength).lineTo(tailX, tailY)
          .stroke({ color: tracerColor, width: Math.max(1.5, projectile.radius * 0.36), alpha: weapon.id === 'kill-zone-round' ? 0.7 : 0.46 });
        this.graphics.moveTo(tailX + sideX * halfWidth, tailY + sideY * halfWidth)
          .lineTo(tipX - dx * halfWidth * 0.35 + sideX * halfWidth * 0.58, tipY - dy * halfWidth * 0.35 + sideY * halfWidth * 0.58)
          .lineTo(tipX, tipY)
          .lineTo(tipX - dx * halfWidth * 0.35 - sideX * halfWidth * 0.58, tipY - dy * halfWidth * 0.35 - sideY * halfWidth * 0.58)
          .lineTo(tailX - sideX * halfWidth, tailY - sideY * halfWidth)
          .closePath().fill({ color: 0xc88a36, alpha: 0.98 });
        this.graphics.moveTo(tailX + sideX * halfWidth * 0.72, tailY + sideY * halfWidth * 0.72)
          .lineTo(tipX - dx * halfWidth * 0.42 + sideX * halfWidth * 0.36, tipY - dy * halfWidth * 0.42 + sideY * halfWidth * 0.36)
          .stroke({ color: 0xffefb0, width: Math.max(1.2, projectile.radius * 0.24), alpha: 0.92 });
        this.graphics.circle(tailX, tailY, Math.max(1.3, halfWidth * 0.46)).fill({ color: 0x5b351c, alpha: 0.95 });
        continue;
      }
      if (weapon.id === 'skip-stone') {
        const pulse = 0.88 + Math.sin(elapsedSeconds * 10 + projectile.id) * 0.12;
        const trailLength = Math.max(16, Math.hypot(projectile.vx, projectile.vy) * 1.7);
        const dx = Math.cos(projectile.rotation);
        const dy = Math.sin(projectile.rotation);
        this.graphics.moveTo(x - dx * trailLength, y - dy * trailLength).lineTo(x, y)
          .stroke({ color: 0x7feeff, width: Math.max(2, projectile.radius * 0.42), alpha: 0.34 });
        this.graphics.circle(x, y, projectile.radius * 1.12)
          .fill({ color: 0x241a30, alpha: 0.98 });
        this.graphics.circle(x, y, projectile.radius * 1.12)
          .stroke({ color: 0xa68bdb, width: Math.max(2, projectile.radius * 0.26), alpha: 0.96 });
        this.graphics.circle(x - projectile.radius * 0.24, y - projectile.radius * 0.2, projectile.radius * 0.24 * pulse)
          .fill({ color: 0xcff9ff, alpha: 0.9 });
        continue;
      }
      if (weapon.form === 'launcher' && weapon.id !== 'demolition-bomb') {
        const dx = Math.cos(projectile.rotation);
        const dy = Math.sin(projectile.rotation);
        const sideX = -dy;
        const sideY = dx;
        const length = Math.max(projectile.radius * 3.2, 22);
        const tailX = x - dx * length * 0.7;
        const tailY = y - dy * length * 0.7;
        this.graphics.moveTo(tailX + sideX * projectile.radius * 0.72, tailY + sideY * projectile.radius * 0.72)
          .lineTo(x + dx * length * 0.45, y + dy * length * 0.45)
          .lineTo(tailX - sideX * projectile.radius * 0.72, tailY - sideY * projectile.radius * 0.72)
          .closePath().fill({ color: 0xdce8ef, alpha: 0.98 });
        this.graphics.moveTo(tailX, tailY).lineTo(tailX - dx * projectile.radius * 1.4, tailY - dy * projectile.radius * 1.4)
          .stroke({ color: 0xffa13c, width: Math.max(3, projectile.radius * 0.55), alpha: 0.92 });
        this.graphics.circle(x + dx * length * 0.35, y + dy * length * 0.35, Math.max(2.5, projectile.radius * 0.34)).fill({ color: 0xff6538, alpha: 0.95 });
        continue;
      }
      if (weapon.id === 'demolition-bomb') {
        const pulse = projectile.fuseRemainingTicks > 0 ? 0.65 + Math.sin(elapsedSeconds * 14) * 0.25 : 1;
        this.graphics.circle(x, y, projectile.radius * 1.4).fill({ color: 0x151821, alpha: 0.98 });
        this.graphics.circle(x, y, projectile.radius * 0.92).stroke({ color: 0xff8a37, width: 3, alpha: 0.95 });
        const fuseX = x + Math.cos(projectile.rotation - 1.1) * projectile.radius * 1.1;
        const fuseY = y + Math.sin(projectile.rotation - 1.1) * projectile.radius * 1.1;
        this.graphics.moveTo(x, y).lineTo(fuseX, fuseY).stroke({ color: 0xc8b08a, width: 3, alpha: 0.9 });
        this.graphics.circle(fuseX, fuseY, 3 + pulse * 2).fill({ color: 0xffdd68, alpha: 1 });
        this.graphics.circle(x, projectile.y + projectile.radius * 0.75, projectile.radius * 0.8).fill({ color: 0x000000, alpha: 0.18 });
        continue;
      }
      const length = Math.max(12, Math.hypot(projectile.vx, projectile.vy) * 2.2);
      const dx = Math.cos(projectile.rotation);
      const dy = Math.sin(projectile.rotation);
      this.graphics.moveTo(x - dx * length, y - dy * length).lineTo(x + dx * projectile.radius, y + dy * projectile.radius)
        .stroke({ color, width: Math.max(3, projectile.radius * 0.75), alpha: 0.72 });
      this.graphics.circle(x, y, projectile.radius).fill({ color: 0xeaffff, alpha: 0.95 });
    }
  }

  reset(): void {
    this.graphics.clear();
  }
}
