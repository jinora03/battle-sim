import { Graphics } from 'pixi.js';
import { getProjectileSource } from '@kinetic/content';
import type { ProjectileSnapshot } from '@kinetic/protocol';

export class ProjectileLayer {
  readonly graphics = new Graphics();

  draw(projectiles: readonly ProjectileSnapshot[], alpha: number, elapsedSeconds: number): void {
    this.graphics.clear();
    for (const projectile of projectiles) {
      const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
      const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
      const weapon = getProjectileSource(projectile.weaponId);
      const color = projectile.team === 1 ? 0x72dfff : 0xff8a55;
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
