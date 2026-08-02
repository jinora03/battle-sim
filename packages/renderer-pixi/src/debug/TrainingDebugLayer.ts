import { Graphics } from 'pixi.js';
import { getAbility, getAbilityActivationProfile, getFighter, getPrimaryAttack, type ArenaDefinition } from '@kinetic/content';
import type { AbilitySlot, EntityId, WorldSnapshot } from '@kinetic/protocol';
import { elementColor } from '@kinetic/visual-engine';

export interface TrainingDebugOptions {
  enabled: boolean;
  focusEntityId: EntityId | null;
  selectedSlot: AbilitySlot;
  showRange: boolean;
  showHitboxes: boolean;
  showProjectilePaths: boolean;
  showDamageNumbers: boolean;
}

const DEFAULT_TRAINING_DEBUG: TrainingDebugOptions = {
  enabled: false,
  focusEntityId: null,
  selectedSlot: 'basic',
  showRange: false,
  showHitboxes: false,
  showProjectilePaths: false,
  showDamageNumbers: false
};

export class TrainingDebugLayer {
  readonly graphics = new Graphics();

  private options: TrainingDebugOptions = { ...DEFAULT_TRAINING_DEBUG };
  private arena: ArenaDefinition | null = null;
  private readonly projectileHistory = new Map<number, Array<{ x: number; y: number }>>();

  get enabled(): boolean { return this.options.enabled; }
  get showDamageNumbers(): boolean { return this.options.enabled && this.options.showDamageNumbers; }

  setArena(arena: ArenaDefinition): void {
    this.arena = arena;
  }

  setOptions(options: Partial<TrainingDebugOptions>): void {
    this.options = { ...this.options, ...options };
    if (!this.options.enabled || !this.options.showProjectilePaths) this.projectileHistory.clear();
  }

  draw(snapshot: WorldSnapshot, alpha: number): void {
    this.graphics.clear();
    if (!this.options.enabled) return;

    const focus = snapshot.entities.find((entity) => entity.id === this.options.focusEntityId)
      ?? snapshot.entities.find((entity) => entity.controller === 'player');

    if (this.options.showProjectilePaths) {
      const activeProjectileIds = new Set<number>();
      for (const projectile of snapshot.projectiles) {
        activeProjectileIds.add(projectile.id);
        const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
        const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
        const history = this.projectileHistory.get(projectile.id) ?? [];
        const last = history.at(-1);
        if (!last || Math.hypot(x - last.x, y - last.y) > 2) {
          history.push({ x, y });
          if (history.length > 64) history.shift();
          this.projectileHistory.set(projectile.id, history);
        }
      }
      for (const id of [...this.projectileHistory.keys()]) if (!activeProjectileIds.has(id)) this.projectileHistory.delete(id);
      for (const [id, points] of this.projectileHistory) {
        if (points.length < 2) continue;
        const projectile = snapshot.projectiles.find((item) => item.id === id);
        const color = projectile?.team === 1 ? 0x7ee8ff : 0xff9a72;
        for (let index = 1; index < points.length; index += 1) {
          const start = points[index - 1];
          const end = points[index];
          if (!start || !end) continue;
          const progress = index / points.length;
          this.graphics.moveTo(start.x, start.y).lineTo(end.x, end.y)
            .stroke({ color, width: 1.5 + progress * 1.5, alpha: 0.12 + progress * 0.42 });
        }
      }
    } else {
      this.projectileHistory.clear();
    }

    if (this.options.showHitboxes) {
      for (const entity of snapshot.entities) {
        const color = entity.id === focus?.id ? 0xffffff : entity.team === 1 ? 0x62d9ff : 0xff785f;
        this.graphics.circle(entity.x, entity.y, entity.radius)
          .stroke({ color, width: entity.id === focus?.id ? 3 : 2, alpha: 0.78 });
        this.graphics.moveTo(entity.x - 5, entity.y).lineTo(entity.x + 5, entity.y)
          .moveTo(entity.x, entity.y - 5).lineTo(entity.x, entity.y + 5)
          .stroke({ color, width: 1.5, alpha: 0.72 });
        if (entity.weaponAttack) {
          const weapon = getPrimaryAttack(entity.weaponAttack.weaponId);
          const facing = Math.atan2(entity.weaponAttack.direction.y, entity.weaponAttack.direction.x);
          this.drawDebugArc(entity.x, entity.y, weapon.range, facing, weapon.attackAngleDegrees, color, 0.58);
        }
      }
      for (const projectile of snapshot.projectiles) {
        const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
        const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
        const color = projectile.team === 1 ? 0x72eaff : 0xff896f;
        this.graphics.circle(x, y, projectile.radius).stroke({ color, width: 2, alpha: 0.9 });
        this.graphics.moveTo(x, y).lineTo(x + projectile.vx * 3, y + projectile.vy * 3)
          .stroke({ color, width: 1.5, alpha: 0.65 });
      }
    }

    if (this.options.showRange && focus && this.arena) {
      const fighter = getFighter(focus.fighterId);
      const rangeColor = elementColor(fighter.classification.elements[0] ?? 'neutral');
      const selectedSlot = this.options.selectedSlot;
      const primaryAttack = selectedSlot === 'basic' ? getPrimaryAttack(fighter.primaryAttackId) : null;
      const abilityId = selectedSlot === 'basic' ? null : fighter.abilitySlots[selectedSlot];
      const activation = primaryAttack
        ? { minRange: primaryAttack.minRange, maxRange: primaryAttack.range }
        : abilityId
          ? getAbilityActivationProfile(getAbility(abilityId), fighter)
          : null;
      if (activation) {
        const maxVisibleRange = Math.min(Math.hypot(this.arena.width, this.arena.height), activation.maxRange);
        if (Number.isFinite(maxVisibleRange) && maxVisibleRange < 9000) {
          this.graphics.circle(focus.x, focus.y, maxVisibleRange)
            .fill({ color: rangeColor, alpha: 0.025 })
            .stroke({ color: rangeColor, width: 3, alpha: 0.55 });
        }
        if (activation.minRange > 0 && activation.minRange < 9000) {
          this.graphics.circle(focus.x, focus.y, activation.minRange)
            .stroke({ color: 0xffb86b, width: 2, alpha: 0.72 });
        }
        if (primaryAttack) {
          const direction = focus.weaponAttack?.direction ?? { x: Math.cos(focus.rotation), y: Math.sin(focus.rotation) };
          const facing = Math.atan2(direction.y, direction.x);
          this.drawDebugArc(focus.x, focus.y, primaryAttack.range, facing, primaryAttack.attackAngleDegrees, rangeColor, 0.82);
        }
      }
    }
  }

  reset(): void {
    this.projectileHistory.clear();
    this.graphics.clear();
  }

  private drawDebugArc(x: number, y: number, radius: number, facing: number, angleDegrees: number, color: number, alpha: number): void {
    const half = Math.max(1, Math.min(360, angleDegrees)) * Math.PI / 360;
    const start = facing - half;
    const end = facing + half;
    const segments = Math.max(8, Math.ceil((end - start) / (Math.PI / 24)));
    this.graphics.moveTo(x, y);
    for (let index = 0; index <= segments; index += 1) {
      const angle = start + ((end - start) * index) / segments;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      this.graphics.lineTo(px, py);
    }
    this.graphics.lineTo(x, y).stroke({ color, width: 2, alpha });
  }
}
