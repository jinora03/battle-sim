import { Container } from 'pixi.js';
import type { ArenaDefinition } from '@kinetic/content';
import type { EntityId, Vec2, WorldSnapshot } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';
import { calculateArenaFit, calculateCameraTarget } from '../camera';

/** Owns camera fit, focus following and presentation-only screen shake. */
export class BattleCamera {
  readonly root = new Container();
  readonly shakeRoot = new Container();
  readonly worldRoot = new Container();

  private arena: ArenaDefinition | null = null;
  private settings: PresentationSettings | null = null;
  private baseScale = 1;
  private cameraScale = 1;
  private cameraX = 0;
  private cameraY = 0;
  private needsSnap = true;
  private focusEntityId: EntityId | null = null;
  private lastFocusPosition: Vec2 | null = null;
  private shake = 0;

  constructor() {
    this.root.addChild(this.shakeRoot);
    this.shakeRoot.addChild(this.worldRoot);
  }

  setArena(arena: ArenaDefinition): void {
    this.arena = arena;
    this.lastFocusPosition = null;
    this.needsSnap = true;
  }

  setSettings(settings: PresentationSettings): void {
    const followChanged = this.settings?.cameraFollow !== settings.cameraFollow;
    this.settings = settings;
    if (followChanged) this.needsSnap = true;
  }

  setFocusEntity(entityId: EntityId | null): void {
    if (this.focusEntityId === entityId) return;
    this.focusEntityId = entityId;
    this.lastFocusPosition = null;
    this.needsSnap = true;
  }

  requestSnap(): void {
    this.needsSnap = true;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  getCurrentScale(): number {
    return this.cameraScale;
  }

  fit(viewportWidth: number, viewportHeight: number): void {
    if (!this.arena) return;
    this.baseScale = calculateArenaFit(
      viewportWidth,
      viewportHeight,
      this.arena.width,
      this.arena.height
    ).scale;
  }

  snap(viewportWidth: number, viewportHeight: number): void {
    if (!this.arena || !this.settings) return;
    const focus = this.settings.cameraFollow ? this.lastFocusPosition : null;
    const target = this.target(viewportWidth, viewportHeight, focus);
    this.cameraScale = target.scale;
    this.cameraX = target.x;
    this.cameraY = target.y;
    this.root.scale.set(this.cameraScale);
    this.root.position.set(this.cameraX, this.cameraY);
    this.shakeRoot.position.set(0, 0);
    this.needsSnap = false;
  }

  update(snapshot: WorldSnapshot, viewportWidth: number, viewportHeight: number): void {
    if (!this.arena || !this.settings) return;
    if (!this.settings.cameraShake || this.settings.reducedMotion) this.shake = 0;
    const focusEntity = this.settings.cameraFollow && this.focusEntityId !== null
      ? snapshot.entities.find((entity) => entity.id === this.focusEntityId)
      : undefined;
    this.lastFocusPosition = focusEntity ? { x: focusEntity.x, y: focusEntity.y } : null;
    const target = this.target(viewportWidth, viewportHeight, this.lastFocusPosition);

    if (this.needsSnap) {
      this.cameraScale = target.scale;
      this.cameraX = target.x;
      this.cameraY = target.y;
      this.needsSnap = false;
    } else {
      this.cameraScale += (target.scale - this.cameraScale) * 0.08;
      this.cameraX += (target.x - this.cameraX) * 0.1;
      this.cameraY += (target.y - this.cameraY) * 0.1;
    }

    const amount = this.shake * this.cameraScale;
    const screenOffsetX = amount > 0.05 ? (Math.random() * 2 - 1) * amount : 0;
    const screenOffsetY = amount > 0.05 ? (Math.random() * 2 - 1) * amount : 0;
    const shakeOffsetX = screenOffsetX / Math.max(0.0001, this.cameraScale);
    const shakeOffsetY = screenOffsetY / Math.max(0.0001, this.cameraScale);
    this.root.scale.set(this.cameraScale);
    this.root.position.set(this.cameraX, this.cameraY);
    this.shakeRoot.position.set(shakeOffsetX, shakeOffsetY);
    this.worldRoot.position.set(0, 0);
    this.worldRoot.scale.set(1);
    this.shake *= 0.82;
  }

  reset(): void {
    this.shake = 0;
    this.shakeRoot.position.set(0, 0);
    this.needsSnap = true;
  }

  private target(viewportWidth: number, viewportHeight: number, focus: Vec2 | null): { scale: number; x: number; y: number } {
    if (!this.arena || !this.settings) return { scale: 1, x: 0, y: 0 };
    return calculateCameraTarget({
      viewportWidth,
      viewportHeight,
      arenaWidth: this.arena.width,
      arenaHeight: this.arena.height,
      baseScale: this.baseScale,
      focus,
      follow: this.settings.cameraFollow,
      reducedMotion: this.settings.reducedMotion
    });
  }
}
