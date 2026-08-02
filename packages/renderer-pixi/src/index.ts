import { Application, Container, Graphics, Point } from 'pixi.js';
import { ArenaView } from './arena/ArenaView';
import { BattleCamera } from './camera/BattleCamera';
import { FxEngine, resolveCrowdFxResponse, type FxResponse } from './effects/FxEngine';
import { PresentationEventRouter } from './effects/PresentationEventRouter';
import { SkillTelegraphRenderer } from './effects/SkillTelegraphRenderer';
import { LayeredVfxEngine } from './layeredVfx';
import { DamageNumberLayer } from './effects/DamageNumberLayer';
import { FighterView } from './fighters/FighterView';
import type { VisualLod } from './fighters/types';
export * from './combatText';
export * from './massBattlePolicy';
export * from './mountedAttachments';
import { evaluatePlayerAim, resolvePlayerTargetingPreview } from './playerTargeting';
import { getAbility, getAbilityActivationProfile, getArena, getFighter, getPrimaryAttack, getProjectileSource, type ArenaDefinition } from '@kinetic/content';
import type { AbilitySlot, EntityId, EntitySnapshot, ProjectileSnapshot, SimulationEvent, Vec2, WorldSnapshot } from '@kinetic/protocol';
import { resolveCanvasResolution } from '@kinetic/platform';
import {
  elementColor,
  getRenderProfile,
  getSkillPresentation,
  resolveVfxQuality,
  type PresentationSettings
} from '@kinetic/visual-engine';


export type { VisualLod } from './fighters/types';
export interface RenderDiagnostics {
  lod: VisualLod;
  fighterViews: number;
  pooledFighterViews: number;
  createdFighterViews: number;
  reusedFighterViews: number;
  particleScale: number;
  activeParticles: number;
  vfxQuality: 'low' | 'medium' | 'high';
  groundMarks: number;
  residualParticles: number;
  weaponEffects: number;
  projectileTrails: number;
  qualityScale: number;
  resolution: number;
  devicePixelRatio: number;
  renderScale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  orientation: 'portrait' | 'landscape';
  resizeCount: number;
  contextLost: boolean;
  renderTier: 'full' | 'crowd' | 'mass';
  targetRenderFps: number;
  presentationEvents: number;
  projectileVisuals: number;
}

export interface TrainingDebugOptions {
  enabled: boolean;
  focusEntityId: EntityId | null;
  selectedSlot: AbilitySlot;
  showRange: boolean;
  showHitboxes: boolean;
  showProjectilePaths: boolean;
  showDamageNumbers: boolean;
}


interface KnockbackTrailState {
  life: number;
  maxLife: number;
  strength: number;
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

export class PixiBattleRenderer {
  private readonly app = new Application();
  private readonly camera = new BattleCamera();
  private readonly arenaLayer = new Container();
  private readonly groundFxLayer = new Container();
  private readonly trailLayer = new Container();
  private readonly projectileFxLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly telegraphLayer = new Container();
  private readonly fighterFxLayer = new Container();
  private readonly fighterLayer = new Container();
  private readonly weaponFxLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly trainingDebugLayer = new Container();
  private readonly combatTextLayer = new Container();
  private readonly foregroundLayer = new Container();
  private readonly screenFxLayer = new Container();
  private readonly arenaView = new ArenaView();
  private readonly trailGraphics = new Graphics();
  private readonly projectileGraphics = new Graphics();
  private readonly trainingDebugGraphics = new Graphics();
  private readonly playerTargetingGraphics = new Graphics();
  private readonly screenFlashGraphics = new Graphics();
  private readonly fighterViews = new Map<EntityId, FighterView>();
  private readonly activeEntityIds = new Set<EntityId>();
  private readonly eventRouter = new PresentationEventRouter();
  private readonly entityByIdScratch = new Map<EntityId, EntitySnapshot>();
  private readonly trailHistory = new Map<EntityId, Array<{ x: number; y: number }>>();
  private readonly knockbackTrails = new Map<EntityId, KnockbackTrailState>();
  private readonly projectileDebugHistory = new Map<number, Array<{ x: number; y: number }>>();
  private readonly damageNumbers = new DamageNumberLayer(this.combatTextLayer);
  private fx: FxEngine | null = null;
  private layeredFx: LayeredVfxEngine | null = null;
  private legacyFxSuppressed = false;
  private readonly telegraphs = new SkillTelegraphRenderer();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private arena!: ArenaDefinition;
  private settings!: PresentationSettings;
  private elapsedSeconds = 0;
  private freezeMs = 0;
  private screenFlash = 0;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf = 0;
  private resizeForcePending = false;
  private lastHostWidth = 0;
  private lastHostHeight = 0;
  private lastResolution = 1;
  private resizeCount = 0;
  private contextLost = false;
  private performanceScale = 1;
  private active = true;
  private playerAimPoint: Vec2 | null = null;
  private pointerAimEnabled = true;
  private playerPreviewSlot: AbilitySlot = 'basic';
  private playerHitmarkerFlash = 0;
  private createdFighterViews = 0;
  private reusedFighterViews = 0;
  private trainingDebug: TrainingDebugOptions = { ...DEFAULT_TRAINING_DEBUG };
  private diagnostics: RenderDiagnostics = {
    lod: 'hero', fighterViews: 0, pooledFighterViews: 0, createdFighterViews: 0, reusedFighterViews: 0, particleScale: 1, activeParticles: 0, vfxQuality: 'high', groundMarks: 0, residualParticles: 0, weaponEffects: 0, projectileTrails: 0, qualityScale: 1, resolution: 1,
    devicePixelRatio: 1, renderScale: 1, cssWidth: 1, cssHeight: 1, pixelWidth: 1, pixelHeight: 1,
    orientation: 'landscape', resizeCount: 0, contextLost: false,
    renderTier: 'full', targetRenderFps: 60, presentationEvents: 0, projectileVisuals: 0
  };

  init(host: HTMLElement, arenaId: string, settings: PresentationSettings): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Battle renderer has been destroyed.'));
    if (this.initialized) {
      this.attachHost(host);
      this.setArena(arenaId);
      this.setSettings(settings);
      return Promise.resolve();
    }
    this.arena = getArena(arenaId);
    this.settings = { ...settings };
    this.arenaView.setArena(this.arena);
    this.arenaView.setSettings(this.settings);
    this.camera.setArena(this.arena);
    this.camera.setSettings(this.settings);
    this.host = host;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize().then(() => {
      this.initPromise = null;
    }, (reason: unknown) => {
      this.initPromise = null;
      throw reason;
    });
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const initialHost = this.host;
    if (!initialHost?.isConnected) throw new Error('Battle renderer host is not connected.');
    const initialWidth = Math.max(1, Math.round(initialHost.getBoundingClientRect().width || initialHost.clientWidth));
    const initialHeight = Math.max(1, Math.round(initialHost.getBoundingClientRect().height || initialHost.clientHeight));
    if (initialWidth < 32 || initialHeight < 32) throw new Error('Battle renderer host does not have a usable layout yet.');
    const initialResolution = this.resolveResolution();
    this.lastResolution = initialResolution;
    await this.app.init({
      width: initialWidth,
      height: initialHeight,
      backgroundColor: 0x05070d,
      antialias: true,
      autoDensity: true,
      resolution: initialResolution,
      preference: 'webgl',
      sharedTicker: false
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer was destroyed during initialization.');
    }
    const mountHost = this.host;
    if (!mountHost?.isConnected) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer host was removed during initialization.');
    }
    this.app.canvas.classList.add('kinetic-render-canvas');
    this.app.canvas.setAttribute('aria-hidden', 'true');
    // The arena is display-only on touch (aiming is handled by React/the stick),
    // so let vertical drags over the canvas scroll the page and stop Pixi from
    // preventing default on touch gestures.
    this.app.canvas.style.touchAction = 'pan-y';
    this.app.renderer.events.autoPreventDefault = false;
    mountHost.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
    this.app.stage.addChild(this.camera.root, this.screenFxLayer);
    this.camera.worldRoot.addChild(this.arenaLayer, this.groundFxLayer, this.trailLayer, this.projectileFxLayer, this.projectileLayer, this.fighterFxLayer, this.fighterLayer, this.telegraphLayer, this.weaponFxLayer, this.fxLayer, this.trainingDebugLayer, this.combatTextLayer, this.foregroundLayer);
    this.arenaLayer.addChild(this.arenaView.container);
    this.trailLayer.addChild(this.trailGraphics);
    this.projectileLayer.addChild(this.projectileGraphics);
    this.trainingDebugLayer.addChild(this.trainingDebugGraphics);
    this.foregroundLayer.addChild(this.playerTargetingGraphics);
    this.telegraphLayer.addChild(this.telegraphs.container);
    this.screenFxLayer.addChild(this.screenFlashGraphics);
    this.fx = new FxEngine(this.fxLayer);
    this.layeredFx = new LayeredVfxEngine({
      arena: this.groundFxLayer,
      world: this.fxLayer,
      fighter: this.fighterFxLayer,
      weapon: this.weaponFxLayer,
      projectile: this.projectileFxLayer,
      foreground: this.screenFxLayer
    }, this.arena);
    this.bindResizeObserver(mountHost);
    window.addEventListener('resize', this.handleViewportResize, { passive: true });
    window.addEventListener('orientationchange', this.handleViewportResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.handleViewportResize, { passive: true });
    this.app.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.app.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.initialized = true;
    this.syncRendererSize(true);
    this.arenaView.drawArena();
    this.camera.fit(this.app.screen.width, this.app.screen.height);
    this.camera.snap(this.app.screen.width, this.app.screen.height);
  }

  attachHost(host: HTMLElement): void {
    if (this.initialized && this.host === host && this.app.canvas.parentElement === host) {
      this.ensureCanvasMounted();
      this.queueRendererResize(true);
      return;
    }
    this.host = host;
    if (!this.initialized) return;
    this.bindResizeObserver(host);
    host.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
    this.lastHostWidth = 0;
    this.lastHostHeight = 0;
    this.camera.requestSnap();
    this.queueRendererResize(true);
    requestAnimationFrame(() => this.queueRendererResize(true));
  }

  setPlayerAimPoint(point: Vec2 | null): void {
    this.playerAimPoint = point ? { ...point } : null;
  }

  /** Touch devices steer with the analog stick and have no cursor, so the aim
   *  reticle/crosshair is suppressed entirely on those devices. */
  setPointerAimEnabled(enabled: boolean): void {
    if (this.pointerAimEnabled === enabled) return;
    this.pointerAimEnabled = enabled;
    if (!enabled) this.playerTargetingGraphics.clear();
  }

  setPlayerPreviewSlot(slot: AbilitySlot): void {
    this.playerPreviewSlot = slot;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!this.initialized) return;
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = active ? 'visible' : 'hidden';
    if (!active) {
      this.app.stop();
      return;
    }
    this.ensureCanvasMounted();
    this.app.start();
    this.lastHostWidth = 0;
    this.lastHostHeight = 0;
    this.queueRendererResize(true);
    this.camera.requestSnap();
    requestAnimationFrame(() => {
      if (!this.active) return;
      this.ensureCanvasMounted();
      this.queueRendererResize(true);
      requestAnimationFrame(() => {
        if (!this.active) return;
        this.ensureCanvasMounted();
        this.queueRendererResize(true);
      });
    });
  }

  setArena(arenaId: string): void {
    if (this.arena?.id === arenaId) return;
    this.arena = getArena(arenaId);
    this.arenaView.setArena(this.arena);
    this.camera.setArena(this.arena);
    if (!this.initialized) return;
    this.layeredFx?.setArena(this.arena);
    this.arenaView.drawArena();
    this.camera.fit(this.app.screen.width, this.app.screen.height);
    this.camera.snap(this.app.screen.width, this.app.screen.height);
  }

  setFocusEntity(entityId: EntityId | null): void {
    this.camera.setFocusEntity(entityId);
  }

  clientToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const screenX = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const screenY = (clientY - rect.top) * (this.app.screen.height / rect.height);
    const world = this.camera.worldRoot.toLocal(new Point(screenX, screenY));
    return { x: world.x, y: world.y };
  }

  setSettings(settings: PresentationSettings): void {
    const profileChanged =
      this.settings?.renderProfile !== settings.renderProfile;
    const arenaBackgroundChanged =
      this.settings?.arenaBackground !== settings.arenaBackground;
    const resolutionChanged =
      this.settings?.maxDevicePixelRatio !== settings.maxDevicePixelRatio ||
      this.settings?.renderScale !== settings.renderScale ||
      this.settings?.adaptiveQuality !== settings.adaptiveQuality;
    const followChanged = this.settings?.cameraFollow !== settings.cameraFollow;
    this.settings = { ...settings };
    this.arenaView.setSettings(this.settings);
    this.camera.setSettings(this.settings);
    if (!this.shouldShowDamageNumbers()) this.damageNumbers.clear();
    if (resolutionChanged && this.initialized) this.queueRendererResize(true);
    if (profileChanged) {
      for (const view of this.fighterViews.values())
        view.setProfile(settings.renderProfile);
    }
    if (this.initialized && (profileChanged || arenaBackgroundChanged)) {
      this.arenaView.drawArena();
    }
    if (followChanged) {
      this.camera.requestSnap();

      // Settings can be synchronized before Pixi Application.init() finishes.
      // app.screen is unavailable until the renderer is initialized.
      if (this.initialized && !settings.cameraFollow) {
        this.camera.snap(this.app.screen.width, this.app.screen.height);
      }
    }
  }

  setPerformanceScale(scale: number): void {
    const next = Math.max(0.35, Math.min(1, scale));
    if (Math.abs(next - this.performanceScale) < 0.001) return;
    const previousResolution = this.resolveResolution();
    this.performanceScale = next;
    if (this.initialized && Math.abs(previousResolution - this.resolveResolution()) >= 0.04) {
      this.queueRendererResize(true);
    }
  }

  setTrainingDebugOptions(options: Partial<TrainingDebugOptions>): void {
    this.trainingDebug = { ...this.trainingDebug, ...options };
    if (!this.trainingDebug.enabled || !this.trainingDebug.showProjectilePaths) this.projectileDebugHistory.clear();
    if (!this.shouldShowDamageNumbers()) this.damageNumbers.clear();
  }

  render(snapshot: WorldSnapshot, alpha: number, events: readonly SimulationEvent[], dtMs: number): RenderDiagnostics {
    if (!this.settings || this.contextLost || !this.active) return this.diagnostics;
    this.ensureCanvasMounted();
    this.elapsedSeconds += Math.min(0.05, dtMs / 1000);
    this.updateKnockbackTrailState(events, Math.min(0.05, dtMs / 1000));
    const frame = this.eventRouter.route(
      snapshot,
      events,
      this.settings.targetRenderFps,
      this.performanceScale
    );
    const {
      playerEntityIds,
      renderPolicy,
      presentationEvents,
      visibleProjectiles,
      missileBarrageActive
    } = frame;
    this.playerHitmarkerFlash = Math.max(
      this.playerHitmarkerFlash,
      frame.playerHitmarkerFlash
    );
    if (missileBarrageActive) {
      // A barrage is continuous presentation: missiles fly, hit, launch a
      // fighter, then cause body/wall/death events on later ticks. Hit-stop
      // during any part of that chain is perceived as the whole game freezing.
      // Clear previously queued freeze and keep the barrage fully real-time.
      this.freezeMs = 0;
    }
    this.syncRendererSize(false);
    this.arenaView.drawObstacles(snapshot);
    const profile = getRenderProfile(this.settings.renderProfile);
    const baseLod: VisualLod = snapshot.entities.length <= 12 ? 'hero' : snapshot.entities.length <= 36 ? 'standard' : 'army';
    const automaticLod: VisualLod = renderPolicy.tier === 'mass' || this.performanceScale < 0.5 ? 'army' : this.performanceScale < 0.78 && baseLod === 'hero' ? 'standard' : baseLod;
    const crowdParticleScale = snapshot.entities.length <= 12 ? 1 : snapshot.entities.length <= 28 ? 0.68 : snapshot.entities.length <= 55 ? 0.4 : 0.22;

    this.activeEntityIds.clear();
    for (const entity of snapshot.entities) this.activeEntityIds.add(entity.id);
    for (const [id, view] of this.fighterViews) {
      if (!this.activeEntityIds.has(id)) {
        view.container.visible = false;
        this.trailHistory.delete(id);
        this.knockbackTrails.delete(id);
      }
    }
    for (const entity of snapshot.entities) {
      let view = this.fighterViews.get(entity.id);
      if (view && !view.matches(entity)) {
        view.destroy();
        this.fighterViews.delete(entity.id);
        view = undefined;
      }
      if (!view) {
        const entityLod: VisualLod = entity.controller === 'player' ? 'hero' : automaticLod;
        view = new FighterView(entity, this.settings.renderProfile, entityLod);
        this.fighterViews.set(entity.id, view);
        this.fighterLayer.addChild(view.container);
        this.createdFighterViews += 1;
      } else if (!view.container.visible) {
        view.prepareForReuse();
        this.reusedFighterViews += 1;
      }
      view.container.visible = true;
      view.setLod(entity.controller === 'player' ? 'hero' : automaticLod);
    }

    const vfxQuality = resolveVfxQuality({
      effects: this.settings.effects,
      particleScale: this.settings.particleScale,
      reducedMotion: this.settings.reducedMotion,
      adaptiveQuality: this.settings.adaptiveQuality,
      performanceScale: this.performanceScale,
      fighterCount: snapshot.entities.length
    });
    const effectiveParticleScale = profile.defaultParticleScale * crowdParticleScale * this.settings.particleScale * this.performanceScale * vfxQuality.particleMultiplier;
    if (this.settings.effects && effectiveParticleScale > 0) {
      const useLegacyFx = snapshot.entities.length <= 40 && vfxQuality.tier !== 'low';
      let response: FxResponse | null = null;
      if (useLegacyFx) {
        this.legacyFxSuppressed = false;
        response = this.fx?.consume(presentationEvents, snapshot, effectiveParticleScale) ?? null;
      } else {
        if (!this.legacyFxSuppressed) this.fx?.reset();
        this.legacyFxSuppressed = true;
        response = resolveCrowdFxResponse(presentationEvents);
      }
      this.layeredFx?.consume(presentationEvents, snapshot, vfxQuality, {
        maxResidualEffects: renderPolicy.maxResidualEffects,
        maxWeaponEffects: renderPolicy.maxWeaponEffects,
        maxGroundMarks: renderPolicy.maxGroundMarks
      });
      if (response) {
        if (this.settings.cameraShake) {
          const shake = missileBarrageActive ? Math.min(3, response.shake) : response.shake;
          this.camera.addShake(shake * vfxQuality.shakeMultiplier);
        }
        if (this.settings.impactFreeze && !missileBarrageActive) this.freezeMs = Math.max(this.freezeMs, response.freezeMs * vfxQuality.freezeMultiplier);
        const screenFlash = missileBarrageActive ? Math.min(0.14, response.screenFlash) : response.screenFlash;
        this.screenFlash = Math.max(this.screenFlash, screenFlash * vfxQuality.flashMultiplier);
      }
    }

    this.telegraphs.render(snapshot, this.elapsedSeconds, this.settings.effects && this.settings.renderProfile !== 'debug');

    const frozen = !missileBarrageActive && this.settings.impactFreeze && this.freezeMs > 0;
    this.freezeMs = Math.max(0, this.freezeMs - dtMs);

    if (!frozen) {
      for (const entity of snapshot.entities) {
        const view = this.fighterViews.get(entity.id)!;
        const impact = this.eventRouter.impactByEntity.get(entity.id) ?? 0;
        if (impact > 0) view.hit(impact);
        this.eventRouter.impactByEntity.set(entity.id, impact * 0.72);
        const damage = this.eventRouter.damageByEntity.get(entity.id) ?? 0;
        if (damage > 0) view.damage(damage);
        this.eventRouter.damageByEntity.delete(entity.id);
        view.update(
          entity,
          alpha,
          this.elapsedSeconds,
          this.settings.reducedMotion,
          snapshot.battleEnded && snapshot.winningTeam === entity.team,
          this.settings.showMountedAttachments,
          this.settings.showFighterHealthRings
        );
        const hasKnockbackTrail = this.knockbackTrails.has(entity.id);
        if (hasKnockbackTrail || (this.performanceScale >= 0.48 && (snapshot.entities.length <= 24 || entity.controller === 'player' || entity.id % Math.ceil(snapshot.entities.length / 24) === 0))) this.updateTrail(entity, alpha);
      }
      this.drawTrails(snapshot);
    }
    if (this.settings.effects) this.layeredFx?.update(snapshot, alpha, this.elapsedSeconds, frozen ? 0 : Math.min(0.05, dtMs / 1000), vfxQuality, this.settings.trails, renderPolicy.maxProjectileTrails, renderPolicy.tier === 'mass');
    else this.layeredFx?.reset();
    this.drawProjectiles(visibleProjectiles, alpha);
    this.drawPlayerTargeting(snapshot, alpha);
    const combatTextEvents = this.trainingDebug.enabled && this.trainingDebug.showDamageNumbers
      ? events
      : presentationEvents;
    this.damageNumbers.consume(combatTextEvents, snapshot, this.shouldShowDamageNumbers());
    this.drawTrainingDebug(snapshot, alpha);
    this.damageNumbers.update(dtMs);

    if (!this.legacyFxSuppressed) this.fx?.update(frozen ? 0 : Math.min(0.05, dtMs / 1000));
    this.drawScreenFlash(dtMs);
    this.camera.update(snapshot, this.app.screen.width, this.app.screen.height);
    const cssWidth = Math.max(1, this.lastHostWidth || Math.round(this.app.screen.width));
    const cssHeight = Math.max(1, this.lastHostHeight || Math.round(this.app.screen.height));
    const layeredDiagnostics = this.layeredFx?.getDiagnostics() ?? { activeGroundMarks: 0, activeResiduals: 0, activeWeaponEffects: 0, projectileTrails: 0 };
    this.diagnostics = {
      lod: automaticLod,
      fighterViews: snapshot.entities.length,
      pooledFighterViews: Math.max(0, this.fighterViews.size - snapshot.entities.length),
      createdFighterViews: this.createdFighterViews,
      reusedFighterViews: this.reusedFighterViews,
      particleScale: effectiveParticleScale,
      activeParticles: (this.fx?.activeParticleCount() ?? 0) + layeredDiagnostics.activeResiduals,
      vfxQuality: vfxQuality.tier,
      groundMarks: layeredDiagnostics.activeGroundMarks,
      residualParticles: layeredDiagnostics.activeResiduals,
      weaponEffects: layeredDiagnostics.activeWeaponEffects,
      projectileTrails: layeredDiagnostics.projectileTrails,
      qualityScale: this.performanceScale,
      resolution: this.lastResolution,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      renderScale: this.settings.renderScale,
      cssWidth,
      cssHeight,
      pixelWidth: Math.max(1, this.app.canvas.width),
      pixelHeight: Math.max(1, this.app.canvas.height),
      orientation: cssWidth >= cssHeight ? 'landscape' : 'portrait',
      resizeCount: this.resizeCount,
      contextLost: this.contextLost,
      renderTier: renderPolicy.tier,
      targetRenderFps: renderPolicy.targetFps,
      presentationEvents: presentationEvents.length,
      projectileVisuals: visibleProjectiles.length
    };
    return this.diagnostics;
  }

  getDiagnostics(): RenderDiagnostics { return { ...this.diagnostics }; }

  reset(): void {
    for (const view of this.fighterViews.values()) {
      view.container.visible = false;
      view.prepareForReuse();
      view.container.visible = false;
    }
    this.activeEntityIds.clear();
    this.trailHistory.clear();
    this.knockbackTrails.clear();
    this.projectileDebugHistory.clear();
    this.damageNumbers.clear();
    this.trailGraphics.clear();
    this.projectileGraphics.clear();
    this.trainingDebugGraphics.clear();
    this.playerTargetingGraphics.clear();
    this.arenaView.resetObstacles();
    this.screenFlashGraphics.clear();
    this.fx?.reset();
    this.legacyFxSuppressed = false;
    this.layeredFx?.reset();
    this.telegraphs.reset();
    this.freezeMs = 0;
    this.eventRouter.reset();
    this.screenFlash = 0;
    this.playerHitmarkerFlash = 0;
    this.camera.reset();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeRaf !== 0) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = 0;
    window.removeEventListener('resize', this.handleViewportResize);
    window.removeEventListener('orientationchange', this.handleViewportResize);
    window.visualViewport?.removeEventListener('resize', this.handleViewportResize);
    if (this.initialized) {
      this.app.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.app.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.reset();
    }
    for (const view of this.fighterViews.values()) view.destroy();
    this.fighterViews.clear();
    this.layeredFx?.destroy();
    this.layeredFx = null;
    if (this.initialized) this.app.destroy(true, { children: true });
    this.initialized = false;
    this.fx = null;
    this.host = null;
  }

  private updateKnockbackTrailState(events: readonly SimulationEvent[], dtSeconds: number): void {
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

  private updateTrail(entity: EntitySnapshot, alpha: number): void {
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

  private drawTrails(snapshot: WorldSnapshot): void {
    this.trailGraphics.clear();
    if (!this.settings.trails || this.settings.renderProfile === 'debug') return;
    const snapshotMap = this.entityByIdScratch;
    snapshotMap.clear();
    for (const entity of snapshot.entities) snapshotMap.set(entity.id, entity);
    for (const [id, points] of this.trailHistory) {
      if (points.length < 2) continue;
      const entity = snapshotMap.get(id);
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
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color,
            width: (5 + progress * 10) * strengthScale,
            alpha: progress * 0.22 * lifeRatio
          });
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color: 0xffffff,
            width: (1.8 + progress * 4.5) * strengthScale,
            alpha: progress * 0.62 * lifeRatio
          });
          if (index % 3 === 0) this.trailGraphics.circle(b.x, b.y, 2.5 + progress * 3.5).fill({ color, alpha: 0.24 * lifeRatio });
        } else {
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width: 1.5 + progress * 5, alpha: progress * 0.3 });
        }
      }
    }
  }


  private drawProjectiles(projectiles: readonly ProjectileSnapshot[], alpha: number): void {
    this.projectileGraphics.clear();
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
        this.projectileGraphics.moveTo(tailX + sideX * projectile.radius * 0.72, tailY + sideY * projectile.radius * 0.72)
          .lineTo(x + dx * length * 0.45, y + dy * length * 0.45)
          .lineTo(tailX - sideX * projectile.radius * 0.72, tailY - sideY * projectile.radius * 0.72)
          .closePath().fill({ color: 0xdce8ef, alpha: 0.98 });
        this.projectileGraphics.moveTo(tailX, tailY).lineTo(tailX - dx * projectile.radius * 1.4, tailY - dy * projectile.radius * 1.4)
          .stroke({ color: 0xffa13c, width: Math.max(3, projectile.radius * 0.55), alpha: 0.92 });
        this.projectileGraphics.circle(x + dx * length * 0.35, y + dy * length * 0.35, Math.max(2.5, projectile.radius * 0.34)).fill({ color: 0xff6538, alpha: 0.95 });
        continue;
      }
      if (weapon.id === 'demolition-bomb') {
        const pulse = projectile.fuseRemainingTicks > 0 ? 0.65 + Math.sin(this.elapsedSeconds * 14) * 0.25 : 1;
        this.projectileGraphics.circle(x, y, projectile.radius * 1.4).fill({ color: 0x151821, alpha: 0.98 });
        this.projectileGraphics.circle(x, y, projectile.radius * 0.92).stroke({ color: 0xff8a37, width: 3, alpha: 0.95 });
        const fuseX = x + Math.cos(projectile.rotation - 1.1) * projectile.radius * 1.1;
        const fuseY = y + Math.sin(projectile.rotation - 1.1) * projectile.radius * 1.1;
        this.projectileGraphics.moveTo(x, y).lineTo(fuseX, fuseY).stroke({ color: 0xc8b08a, width: 3, alpha: 0.9 });
        this.projectileGraphics.circle(fuseX, fuseY, 3 + pulse * 2).fill({ color: 0xffdd68, alpha: 1 });
        this.projectileGraphics.circle(x, projectile.y + projectile.radius * 0.75, projectile.radius * 0.8).fill({ color: 0x000000, alpha: 0.18 });
        continue;
      }
      const length = Math.max(12, Math.hypot(projectile.vx, projectile.vy) * 2.2);
      const dx = Math.cos(projectile.rotation);
      const dy = Math.sin(projectile.rotation);
      this.projectileGraphics.moveTo(x - dx * length, y - dy * length).lineTo(x + dx * projectile.radius, y + dy * projectile.radius)
        .stroke({ color, width: Math.max(3, projectile.radius * 0.75), alpha: 0.72 });
      this.projectileGraphics.circle(x, y, projectile.radius).fill({ color: 0xeaffff, alpha: 0.95 });
    }
  }

  private shouldShowDamageNumbers(): boolean {
    return this.settings?.showDamageNumbers === true
      || (this.trainingDebug.enabled && this.trainingDebug.showDamageNumbers);
  }

  private drawTrainingDebug(snapshot: WorldSnapshot, alpha: number): void {
    this.trainingDebugGraphics.clear();
    if (!this.trainingDebug.enabled) return;

    const focus = snapshot.entities.find((entity) => entity.id === this.trainingDebug.focusEntityId)
      ?? snapshot.entities.find((entity) => entity.controller === 'player');

    if (this.trainingDebug.showProjectilePaths) {
      const activeProjectileIds = new Set<number>();
      for (const projectile of snapshot.projectiles) {
        activeProjectileIds.add(projectile.id);
        const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
        const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
        const history = this.projectileDebugHistory.get(projectile.id) ?? [];
        const last = history.at(-1);
        if (!last || Math.hypot(x - last.x, y - last.y) > 2) {
          history.push({ x, y });
          if (history.length > 64) history.shift();
          this.projectileDebugHistory.set(projectile.id, history);
        }
      }
      for (const id of [...this.projectileDebugHistory.keys()]) if (!activeProjectileIds.has(id)) this.projectileDebugHistory.delete(id);
      for (const [id, points] of this.projectileDebugHistory) {
        if (points.length < 2) continue;
        const projectile = snapshot.projectiles.find((item) => item.id === id);
        const color = projectile?.team === 1 ? 0x7ee8ff : 0xff9a72;
        for (let index = 1; index < points.length; index += 1) {
          const start = points[index - 1];
          const end = points[index];
          if (!start || !end) continue;
          const progress = index / points.length;
          this.trainingDebugGraphics.moveTo(start.x, start.y).lineTo(end.x, end.y)
            .stroke({ color, width: 1.5 + progress * 1.5, alpha: 0.12 + progress * 0.42 });
        }
      }
    } else {
      this.projectileDebugHistory.clear();
    }

    if (this.trainingDebug.showHitboxes) {
      for (const entity of snapshot.entities) {
        const color = entity.id === focus?.id ? 0xffffff : entity.team === 1 ? 0x62d9ff : 0xff785f;
        this.trainingDebugGraphics.circle(entity.x, entity.y, entity.radius)
          .stroke({ color, width: entity.id === focus?.id ? 3 : 2, alpha: 0.78 });
        this.trainingDebugGraphics.moveTo(entity.x - 5, entity.y).lineTo(entity.x + 5, entity.y)
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
        this.trainingDebugGraphics.circle(x, y, projectile.radius).stroke({ color, width: 2, alpha: 0.9 });
        this.trainingDebugGraphics.moveTo(x, y).lineTo(x + projectile.vx * 3, y + projectile.vy * 3)
          .stroke({ color, width: 1.5, alpha: 0.65 });
      }
    }

    if (this.trainingDebug.showRange && focus) {
      const fighter = getFighter(focus.fighterId);
      const rangeColor = elementColor(fighter.classification.elements[0] ?? 'neutral');
      const selectedSlot = this.trainingDebug.selectedSlot;
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
          this.trainingDebugGraphics.circle(focus.x, focus.y, maxVisibleRange)
            .fill({ color: rangeColor, alpha: 0.025 })
            .stroke({ color: rangeColor, width: 3, alpha: 0.55 });
        }
        if (activation.minRange > 0 && activation.minRange < 9000) {
          this.trainingDebugGraphics.circle(focus.x, focus.y, activation.minRange)
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

  private drawDebugArc(x: number, y: number, radius: number, facing: number, angleDegrees: number, color: number, alpha: number): void {
    const half = Math.max(1, Math.min(360, angleDegrees)) * Math.PI / 360;
    const start = facing - half;
    const end = facing + half;
    const segments = Math.max(8, Math.ceil((end - start) / (Math.PI / 24)));
    this.trainingDebugGraphics.moveTo(x, y);
    for (let index = 0; index <= segments; index += 1) {
      const angle = start + ((end - start) * index) / segments;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) this.trainingDebugGraphics.lineTo(px, py);
      else this.trainingDebugGraphics.lineTo(px, py);
    }
    this.trainingDebugGraphics.lineTo(x, y).stroke({ color, width: 2, alpha });
  }

  private readonly handleViewportResize = (): void => {
    this.queueRendererResize(false);
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.diagnostics = { ...this.diagnostics, contextLost: true };
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.diagnostics = { ...this.diagnostics, contextLost: false };
    this.arenaView.drawArena();
    this.queueRendererResize(true);
  };

  private bindResizeObserver(host: HTMLElement): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.queueRendererResize(false))
      : null;
    this.resizeObserver?.observe(host, { box: 'content-box' });
  }

  private drawTouchAimArrow(player: EntitySnapshot, x: number, y: number): void {
    // Restore the skill range indicator for the currently selected/previewed slot.
    const preview = resolvePlayerTargetingPreview(player, this.playerPreviewSlot);
    if (preview.finiteRange && preview.maxRange > 0) {
      this.playerTargetingGraphics.circle(x, y, preview.maxRange).fill({ color: 0x72f2a0, alpha: 0.012 }).stroke({ color: 0x72f2a0, width: 2, alpha: 0.32 });
      if (preview.minRange > 0) this.playerTargetingGraphics.circle(x, y, preview.minRange).stroke({ color: 0xffb85b, width: 1.6, alpha: 0.42 });
    } else if (preview.targeting === 'self') {
      this.playerTargetingGraphics.circle(x, y, player.radius * 1.75).stroke({ color: 0x72f2a0, width: 2.4, alpha: 0.5 });
    }
    // Simple dark aim line (no arrowhead) showing the fighter's facing/aim, with a
    // faint light edge so it stays readable on the dark arena.
    const nx = Math.cos(player.rotation);
    const ny = Math.sin(player.rotation);
    const x1 = x + nx * player.radius * 1.1;
    const y1 = y + ny * player.radius * 1.1;
    const x2 = x + nx * player.radius * 3.4;
    const y2 = y + ny * player.radius * 3.4;
    this.playerTargetingGraphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0xe6eefb, width: 5, alpha: 0.26 });
    this.playerTargetingGraphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x0a0d14, width: 3, alpha: 0.92 });
  }

  private drawPlayerTargeting(snapshot: WorldSnapshot, alpha: number): void {
    this.playerTargetingGraphics.clear();
    const player = snapshot.entities.find((entity) => entity.controller === 'player');
    if (!player) return;
    const x = player.prevX + (player.x - player.prevX) * alpha;
    const y = player.prevY + (player.y - player.prevY) * alpha;
    if (!this.pointerAimEnabled) {
      this.drawTouchAimArrow(player, x, y);
      return;
    }
    if (!this.playerAimPoint) return;
    const preview = resolvePlayerTargetingPreview(player, this.playerPreviewSlot);
    const validity = evaluatePlayerAim(snapshot, player, this.playerAimPoint, preview);
    const color = validity.valid ? 0x72f2a0 : validity.reason === 'too-close' ? 0xffc05c : 0xff5b68;
    if (preview.finiteRange && preview.maxRange > 0) {
      this.playerTargetingGraphics.circle(x, y, preview.maxRange).fill({ color, alpha: 0.012 }).stroke({ color, width: 2, alpha: 0.38 });
      if (preview.minRange > 0) this.playerTargetingGraphics.circle(x, y, preview.minRange).stroke({ color: 0xffb85b, width: 1.6, alpha: 0.5 });
    } else if (preview.targeting === 'self') {
      this.playerTargetingGraphics.circle(x, y, player.radius * 1.75).stroke({ color, width: 2.5, alpha: 0.55 });
    }
    const aimDx = this.playerAimPoint.x - x;
    const aimDy = this.playerAimPoint.y - y;
    const aimLength = Math.hypot(aimDx, aimDy) || 1;
    const nx = aimDx / aimLength;
    const ny = aimDy / aimLength;
    const arrowDistance = player.radius * 1.78;
    const arrowX = x + nx * arrowDistance;
    const arrowY = y + ny * arrowDistance;
    const sideX = -ny;
    const sideY = nx;
    this.playerTargetingGraphics.moveTo(arrowX + nx * 11, arrowY + ny * 11)
      .lineTo(arrowX - nx * 8 + sideX * 7, arrowY - ny * 8 + sideY * 7)
      .lineTo(arrowX - nx * 8 - sideX * 7, arrowY - ny * 8 - sideY * 7)
      .closePath().fill({ color, alpha: 0.96 });
    const crossX = this.playerAimPoint.x;
    const crossY = this.playerAimPoint.y;
    const crossRadius = preview.targeting === 'area' ? 15 : 10;
    this.playerTargetingGraphics.circle(crossX, crossY, crossRadius).stroke({ color, width: 2.4, alpha: 0.94 });
    this.playerTargetingGraphics.moveTo(crossX - crossRadius - 7, crossY).lineTo(crossX - 3, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX + 3, crossY).lineTo(crossX + crossRadius + 7, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX, crossY - crossRadius - 7).lineTo(crossX, crossY - 3).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX, crossY + 3).lineTo(crossX, crossY + crossRadius + 7).stroke({ color, width: 2, alpha: 0.9 });
    if (preview.targeting === 'area') this.playerTargetingGraphics.circle(crossX, crossY, Math.min(110, Math.max(28, preview.maxRange * 0.14))).stroke({ color, width: 1.3, alpha: 0.3 });
    if (this.playerHitmarkerFlash > 0.02) {
      const markerAlpha = Math.min(1, this.playerHitmarkerFlash);
      const markerRadius = 12 + markerAlpha * 5;
      this.playerTargetingGraphics.moveTo(crossX - markerRadius, crossY - markerRadius).lineTo(crossX - 4, crossY - 4)
        .moveTo(crossX + markerRadius, crossY - markerRadius).lineTo(crossX + 4, crossY - 4)
        .moveTo(crossX - markerRadius, crossY + markerRadius).lineTo(crossX - 4, crossY + 4)
        .moveTo(crossX + markerRadius, crossY + markerRadius).lineTo(crossX + 4, crossY + 4)
        .stroke({ color: 0xffffff, width: 3.4, alpha: markerAlpha });
    }
    this.playerHitmarkerFlash *= 0.82;
  }

  private ensureCanvasMounted(): void {
    if (!this.initialized || !this.host) return;
    if (this.app.canvas.parentElement !== this.host) this.host.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
  }

  private queueRendererResize(force = false): void {
    if (!this.initialized) return;
    this.resizeForcePending ||= force;
    if (this.resizeRaf !== 0) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      const shouldForce = this.resizeForcePending;
      this.resizeForcePending = false;
      this.syncRendererSize(shouldForce);
    });
  }

  private resolveResolution(): number {
    const adaptiveScale = this.settings?.adaptiveQuality
      ? 0.58 + this.performanceScale * 0.42
      : 1;
    return resolveCanvasResolution({
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      maxDevicePixelRatio: this.settings?.maxDevicePixelRatio ?? 1,
      renderScale: this.settings?.renderScale ?? 1,
      adaptiveScale
    }).effectiveResolution;
  }

  private syncRendererSize(force: boolean): void {
    if (!this.initialized || !this.host || this.contextLost) return;
    const rect = this.host.getBoundingClientRect();
    const measuredWidth = rect.width || this.host.clientWidth;
    const measuredHeight = rect.height || this.host.clientHeight;
    if (measuredWidth < 2 || measuredHeight < 2) return;
    const width = Math.max(1, Math.round(measuredWidth));
    const height = Math.max(1, Math.round(measuredHeight));
    const resolution = this.resolveResolution();
    const widthDelta = Math.abs(width - this.lastHostWidth);
    const heightDelta = Math.abs(height - this.lastHostHeight);
    const sizeChanged = force
      ? widthDelta > 0 || heightDelta > 0
      : widthDelta >= 2 || heightDelta >= 2;
    const resolutionChanged = Math.abs(resolution - this.lastResolution) >= 0.01;
    if (!sizeChanged && !resolutionChanged) return;
    this.lastHostWidth = width;
    this.lastHostHeight = height;
    this.lastResolution = resolution;
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height);
    this.resizeCount += 1;
    this.camera.fit(this.app.screen.width, this.app.screen.height);
    this.camera.requestSnap();
    this.camera.snap(this.app.screen.width, this.app.screen.height);
  }

  private drawScreenFlash(dtMs: number): void {
    this.screenFlashGraphics.clear();
    if (!this.settings.effects || !this.settings.screenFlash || this.screenFlash <= 0.005) {
      this.screenFlash = 0;
      return;
    }
    this.screenFlashGraphics.rect(0, 0, this.app.screen.width, this.app.screen.height).fill({ color: 0xffffff, alpha: this.screenFlash * 0.16 });
    this.screenFlash *= Math.pow(0.78, Math.max(1, dtMs / 16.67));
  }


}
