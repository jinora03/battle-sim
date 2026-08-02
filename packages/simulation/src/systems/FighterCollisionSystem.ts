import type {
  BattleRules,
  EntityId,
  SimulationEvent,
  SimulationMetricsSnapshot,
  Vec2
} from '@kinetic/protocol';
import type { SpatialHashGrid } from '../spatialHash';
import type { World } from '../world';
import type { ExternalImpulseState } from './SimulationSystemTypes';

type TeamCollisionMode = NonNullable<BattleRules['teamCollision']>;

export interface FighterCollisionSystemContext {
  getTick(): number;
  getMetrics(): SimulationMetricsSnapshot;
  getTeamCollisionMode(): TeamCollisionMode;
  getTeamCollisionScale(): number;
  friendlyFireEnabled(): boolean;
  triggerCollisionAbility(
    self: EntityId,
    target: EntityId,
    impact: number,
    normal: Vec2,
    events: SimulationEvent[]
  ): void;
}

/** Owns deterministic fighter-to-fighter contact resolution. */
export class FighterCollisionSystem {
  constructor(
    private readonly world: World,
    private readonly spatial: SpatialHashGrid,
    private readonly externalImpulse: Map<EntityId, ExternalImpulseState>,
    private readonly context: FighterCollisionSystemContext
  ) {}

  resolve(events: SimulationEvent[]): void {
    this.spatial.forEachCandidatePair((a, b) => {
      const metrics = this.context.getMetrics();
      metrics.candidatePairs += 1;
      if (!this.world.isAlive(a) || !this.world.isAlive(b)) return;
      const ax = this.world.x[a] ?? 0;
      const ay = this.world.y[a] ?? 0;
      const bx = this.world.x[b] ?? 0;
      const by = this.world.y[b] ?? 0;
      const dx = bx - ax;
      const dy = by - ay;
      const radiusSum = (this.world.radius[a] ?? 0) + (this.world.radius[b] ?? 0);
      const distSq = dx * dx + dy * dy;
      if (distSq >= radiusSum * radiusSum) return;

      const sameTeam = this.world.getTeam(a) === this.world.getTeam(b);
      const teamCollision = this.context.getTeamCollisionMode();
      if (sameTeam && teamCollision === 'ghost') return;
      metrics.contactsResolved += 1;
      if (sameTeam) metrics.sameTeamContacts += 1;
      const physicalScale = sameTeam && teamCollision === 'soft'
        ? this.context.getTeamCollisionScale()
        : 1;
      const distance = Math.max(0.0001, Math.sqrt(distSq));
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = radiusSum - distance;
      const massA = this.world.getEffectiveMass(a);
      const massB = this.world.getEffectiveMass(b);
      const invA = 1 / massA;
      const invB = 1 / massB;

      // Abilities such as Mega Bomb explicitly guarantee a minimum number of
      // arena-wall bounces. While that protected impulse is active, ordinary
      // fighter contacts may move and receive momentum from the launched body,
      // but they must not cancel or redirect its authored launch trajectory.
      const externalA = this.externalImpulse.get(a);
      const externalB = this.externalImpulse.get(b);
      const protectedA = externalA !== undefined && externalA.wallBounces < externalA.minWallBounces;
      const protectedB = externalB !== undefined && externalB.wallBounces < externalB.minWallBounces;
      const preserveA = protectedA && !protectedB;
      const preserveB = protectedB && !protectedA;

      const responseInvA = preserveA ? 0 : invA;
      const responseInvB = preserveB ? 0 : invB;
      const responseInvTotal = responseInvA + responseInvB;
      const correctionInvTotal = responseInvTotal > 0 ? responseInvTotal : invA + invB;
      const correction = (overlap / correctionInvTotal) * physicalScale;
      this.world.x[a] = ax - nx * correction * (responseInvTotal > 0 ? responseInvA : invA);
      this.world.y[a] = ay - ny * correction * (responseInvTotal > 0 ? responseInvA : invA);
      this.world.x[b] = bx + nx * correction * (responseInvTotal > 0 ? responseInvB : invB);
      this.world.y[b] = by + ny * correction * (responseInvTotal > 0 ? responseInvB : invB);

      const rvx = (this.world.vx[b] ?? 0) - (this.world.vx[a] ?? 0);
      const rvy = (this.world.vy[b] ?? 0) - (this.world.vy[a] ?? 0);
      const velAlongNormal = rvx * nx + rvy * ny;
      const relativeSpeed = Math.hypot(rvx, rvy);
      const closingSpeed = Math.max(0, -velAlongNormal);
      let impulseMagnitude = 0;
      if (velAlongNormal < 0 && responseInvTotal > 0) {
        const restitution = Math.min(this.world.restitution[a] ?? 1, this.world.restitution[b] ?? 1);
        impulseMagnitude = ((-(1 + restitution) * velAlongNormal) / responseInvTotal) * physicalScale;
        const ix = impulseMagnitude * nx;
        const iy = impulseMagnitude * ny;
        if (responseInvA > 0) {
          this.world.vx[a] = (this.world.vx[a] ?? 0) - ix * responseInvA;
          this.world.vy[a] = (this.world.vy[a] ?? 0) - iy * responseInvA;
        }
        if (responseInvB > 0) {
          this.world.vx[b] = (this.world.vx[b] ?? 0) + ix * responseInvB;
          this.world.vy[b] = (this.world.vy[b] ?? 0) + iy * responseInvB;
        }
      }

      const magnitude = Math.max(impulseMagnitude, closingSpeed);
      const position = {
        x: ((this.world.x[a] ?? 0) + (this.world.x[b] ?? 0)) / 2,
        y: ((this.world.y[a] ?? 0) + (this.world.y[b] ?? 0)) / 2
      };
      if (magnitude > 0.05) {
        events.push({
          type: 'impact',
          tick: this.context.getTick(),
          a,
          b,
          position,
          magnitude,
          relativeSpeed
        });
      }

      // Contact always transfers momentum, but it never causes health damage by itself.
      // Damage is only produced by an explicitly armed collision ability or another
      // declared gameplay source such as a projectile, blast, weapon, or hazard.
      const hostileContact = !sameTeam || this.context.friendlyFireEnabled();
      if (hostileContact && magnitude > 0.05 && this.world.isAlive(a) && this.world.isAlive(b)) {
        this.context.triggerCollisionAbility(a, b, magnitude, { x: nx, y: ny }, events);
        this.context.triggerCollisionAbility(b, a, magnitude, { x: -nx, y: -ny }, events);
      }
    });
  }
}
