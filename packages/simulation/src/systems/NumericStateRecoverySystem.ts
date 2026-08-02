import { getFighter, type ArenaDefinition } from '@kinetic/content';
import type { SimulationMetricsSnapshot } from '@kinetic/protocol';
import type { World } from '../world';
import type { ProjectileSystem } from './ProjectileSystem';

/** Repairs invalid fighter/projectile numeric state without changing valid state. */
export class NumericStateRecoverySystem {
  constructor(
    private readonly world: World,
    private readonly arena: ArenaDefinition,
    private readonly projectiles: ProjectileSystem
  ) {}

  recover(metrics: SimulationMetricsSnapshot): void {
    for (const id of this.world.activeIdsView()) {
      const fighter = getFighter(this.world.getFighterId(id));
      let invalid = false;
      const previousX = this.world.prevX[id] ?? this.arena.width / 2;
      const previousY = this.world.prevY[id] ?? this.arena.height / 2;
      if (!Number.isFinite(this.world.x[id])) {
        this.world.x[id] = Number.isFinite(previousX) ? previousX : this.arena.width / 2;
        invalid = true;
      }
      if (!Number.isFinite(this.world.y[id])) {
        this.world.y[id] = Number.isFinite(previousY) ? previousY : this.arena.height / 2;
        invalid = true;
      }
      if (!Number.isFinite(this.world.prevX[id])) {
        this.world.prevX[id] = this.world.x[id] ?? this.arena.width / 2;
        invalid = true;
      }
      if (!Number.isFinite(this.world.prevY[id])) {
        this.world.prevY[id] = this.world.y[id] ?? this.arena.height / 2;
        invalid = true;
      }
      if (!Number.isFinite(this.world.vx[id])) {
        this.world.vx[id] = 0;
        invalid = true;
      }
      if (!Number.isFinite(this.world.vy[id])) {
        this.world.vy[id] = 0;
        invalid = true;
      }
      if (!Number.isFinite(this.world.rotation[id])) {
        this.world.rotation[id] = 0;
        invalid = true;
      }
      if (!Number.isFinite(this.world.hp[id])) {
        this.world.hp[id] = this.world.maxHp[id] ?? fighter.stats.maxHp;
        invalid = true;
      }
      if (!Number.isFinite(this.world.radius[id]) || (this.world.radius[id] ?? 0) <= 0) {
        this.world.radius[id] = fighter.physics.radius;
        invalid = true;
      }
      if (!Number.isFinite(this.world.mass[id]) || (this.world.mass[id] ?? 0) <= 0) {
        this.world.mass[id] = fighter.physics.mass;
        invalid = true;
      }
      if (invalid) {
        const radius = this.world.radius[id] ?? 1;
        this.world.x[id] = Math.max(
          radius,
          Math.min(this.arena.width - radius, this.world.x[id] ?? this.arena.width / 2)
        );
        this.world.y[id] = Math.max(
          radius,
          Math.min(this.arena.height - radius, this.world.y[id] ?? this.arena.height / 2)
        );
        metrics.invalidNumericStates += 1;
      }
    }

    this.projectiles.recoverInvalidNumericState();
  }
}
