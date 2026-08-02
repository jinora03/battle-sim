import { Graphics } from 'pixi.js';
import { getFighter } from '@kinetic/content';
import type { EntityId, EntitySnapshot, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { elementColor, type PresentationSettings } from '@kinetic/visual-engine';

interface KnockbackTrailState {
  life: number;
  maxLife: number;
  strength: number;
}

export class FighterTrailLayer {
  readonly graphics = new Graphics();

  private readonly trailHistory = new Map<EntityId, Array<{ x: number; y: number }>>();
  private readonly knockbackTrails = new Map<EntityId, KnockbackTrailState>();
  private readonly entityByIdScratch = new Map<EntityId, EntitySnapshot>();

  consume(events: readonly SimulationEvent[], dtSeconds: number): void {
    for (const [entityId, state] of this.knockbackTrails) {
      state.life -= dtSeconds;
      if (state.life <= 0) {
        this.knockbackTrails.delete(entityId);
        this.trailHistory.delete(entityId);
      }
    }
    for (const event of events) {
      if (event.type === 'knockbackApplied' && event.force >= 5.5) {
        const maxLife = Math.min(4.8, 0.75 + event.force * 0.055);
        const current = this.knockbackTrails.get(event.targetId);
        this.knockbackTrails.set(event.targetId, {
          life: Math.max(current?.life ?? 0, maxLife),
          maxLife: Math.max(current?.maxLife ?? 0, maxLife),
          strength: Math.max(current?.strength ?? 0, event.force)
        });
      } else if ((event.type === 'wallImpact' || event.type === 'obstacleImpact') && this.knockbackTrails.has(event.entityId)) {
        const current = this.knockbackTrails.get(event.entityId)!;
        current.life = Math.max(current.life, 0.7);
        current.strength = Math.max(current.strength, event.magnitude);
      } else if (event.type === 'death') {
        this.knockbackTrails.delete(event.entityId);
      }
    }
  }

  hasKnockbackTrail(entityId: EntityId): boolean {
    return this.knockbackTrails.has(entityId);
  }

  removeEntity(entityId: EntityId): void {
    this.trailHistory.delete(entityId);
    this.knockbackTrails.delete(entityId);
  }

  update(entity: EntitySnapshot, alpha: number): void {
    const x = entity.prevX + (entity.x - entity.prevX) * alpha;
    const y = entity.prevY + (entity.y - entity.prevY) * alpha;
    const history = this.trailHistory.get(entity.id) ?? [];
    const last = history.at(-1);
    if (!last || Math.hypot(x - last.x, y - last.y) > 3) {
      history.push({ x, y });
      if (history.length > 16) history.shift();
      this.trailHistory.set(entity.id, history);
    }
  }

  draw(snapshot: WorldSnapshot, settings: PresentationSettings): void {
    this.graphics.clear();
    if (!settings.trails || settings.renderProfile === 'debug') return;
    this.entityByIdScratch.clear();
    for (const entity of snapshot.entities) this.entityByIdScratch.set(entity.id, entity);
    for (const [id, points] of this.trailHistory) {
      if (points.length < 2) continue;
      const entity = this.entityByIdScratch.get(id);
      if (!entity) continue;
      const fighter = getFighter(entity.fighterId);
      const color = elementColor(fighter.classification.elements[0] ?? 'neutral');
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        if (!a || !b) continue;
        const progress = index / points.length;
        const knockback = this.knockbackTrails.get(id);
        if (knockback) {
          const lifeRatio = Math.max(0, Math.min(1, knockback.life / Math.max(0.001, knockback.maxLife)));
          const strengthScale = Math.min(1.8, 0.7 + knockback.strength / 35);
          this.graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color,
            width: (5 + progress * 10) * strengthScale,
            alpha: progress * 0.22 * lifeRatio
          });
          this.graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color: 0xffffff,
            width: (1.8 + progress * 4.5) * strengthScale,
            alpha: progress * 0.62 * lifeRatio
          });
          if (index % 3 === 0) this.graphics.circle(b.x, b.y, 2.5 + progress * 3.5).fill({ color, alpha: 0.24 * lifeRatio });
        } else {
          this.graphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width: 1.5 + progress * 5, alpha: progress * 0.3 });
        }
      }
    }
  }

  reset(): void {
    this.trailHistory.clear();
    this.knockbackTrails.clear();
    this.entityByIdScratch.clear();
    this.graphics.clear();
  }
}
