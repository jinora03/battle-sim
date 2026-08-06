import { Point } from 'pixi.js';
import { getArena, type ArenaDefinition } from '@kinetic/content';
import type { AbilitySlot, EntityId, SimulationEvent, Vec2, WorldSnapshot } from '@kinetic/protocol';
import {
  getRenderProfile,
  resolveVfxQuality,
  type PresentationSettings
} from '@kinetic/visual-engine';
import { ArenaView } from './arena/ArenaView';
import { BattleCamera } from './camera/BattleCamera';
import { TrainingDebugLayer, type TrainingDebugOptions } from './debug/TrainingDebugLayer';
import { RenderDiagnosticsTracker, type RenderDiagnostics } from './diagnostics/RenderDiagnosticsTracker';
import { DamageNumberLayer } from './effects/DamageNumberLayer';
import { FighterTrailLayer } from './effects/FighterTrailLayer';
import { FxEngine, resolveCrowdFxResponse, type FxResponse } from './effects/FxEngine';
import { PresentationEventRouter } from './effects/PresentationEventRouter';
import { ScreenFlashLayer } from './effects/ScreenFlashLayer';
import { SkillTelegraphRenderer } from './effects/SkillTelegraphRenderer';
import { FighterView } from './fighters/FighterView';
import type { VisualLod } from './fighters/types';
import { LayeredVfxEngine } from './layeredVfx';
import { ProjectileLayer } from './projectiles/ProjectileLayer';
import { PixiStageComposition } from './runtime/PixiStageComposition';
import { RendererLifecycle } from './runtime/RendererLifecycle';
import { RendererSettingsController } from './runtime/RendererSettingsController';
import { PlayerTargetingLayer } from './targeting/PlayerTargetingLayer';

export * from './combatText';
export * from './massBattlePolicy';
export * from './mountedAttachments';
export type { RenderDiagnostics } from './diagnostics/RenderDiagnosticsTracker';
export type { TrainingDebugOptions } from './debug/TrainingDebugLayer';
export type { VisualLod } from './fighters/types';

export class PixiBattleRenderer {
  private readonly settingsController = new RendererSettingsController();
  private readonly diagnosticsTracker = new RenderDiagnosticsTracker();
  private readonly camera = new BattleCamera();
  private readonly arenaView = new ArenaView();
  private readonly stage = new PixiStageComposition();
  private readonly fighterTrails = new FighterTrailLayer();
  private readonly projectiles = new ProjectileLayer();
  private readonly trainingDebug = new TrainingDebugLayer();
  private readonly playerTargeting = new PlayerTargetingLayer();
  private readonly screenFlash = new ScreenFlashLayer();
  private readonly telegraphs = new SkillTelegraphRenderer();
  private readonly eventRouter = new PresentationEventRouter();
  private readonly fighterViews = new Map<EntityId, FighterView>();
  private readonly activeEntityIds = new Set<EntityId>();
  private readonly damageNumbers = new DamageNumberLayer(this.stage.combatTextLayer);
  private readonly lifecycle = new RendererLifecycle({
    resolveResolution: () => this.settingsController.resolveResolution(),
    onReady: () => this.handleRendererReady(),
    onResize: () => this.handleRendererResize(),
    onContextLostChange: (lost) => this.diagnosticsTracker.setContextLost(lost),
    onContextRestored: () => this.arenaView.drawArena()
  });

  // The public facade owns idempotent startup; RendererLifecycle owns Pixi/DOM details.
  private initPromise: Promise<void> | null = null;
  private arena!: ArenaDefinition;
  private fx: FxEngine | null = null;
  private layeredFx: LayeredVfxEngine | null = null;
  private legacyFxSuppressed = false;
  private elapsedSeconds = 0;
  private freezeMs = 0;
  private createdFighterViews = 0;
  private reusedFighterViews = 0;

  init(host: HTMLElement, arenaId: string, settings: PresentationSettings): Promise<void> {
    if (this.lifecycle.destroyed) return Promise.reject(new Error('Battle renderer has been destroyed.'));
    if (this.lifecycle.initialized) {
      this.attachHost(host);
      this.setArena(arenaId);
      this.setSettings(settings);
      return Promise.resolve();
    }
    this.lifecycle.attachHost(host);
    this.setArenaDefinition(arenaId);
    this.setSettings(settings);
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.lifecycle.initialize(host).then(() => {
      this.initPromise = null;
    }, (reason: unknown) => {
      this.initPromise = null;
      throw reason;
    });
    return this.initPromise;
  }

  attachHost(host: HTMLElement): void {
    const hostChanged = this.lifecycle.attachHost(host);
    if (hostChanged && this.lifecycle.initialized) this.camera.requestSnap();
  }

  setFixedOutputSize(width: number, height: number): void {
    if (this.lifecycle.initialized) throw new Error('Fixed output size must be configured before renderer initialization.');
    this.settingsController.setResolutionOverride(1);
    this.lifecycle.setFixedSize(width, height);
    this.lifecycle.setManualRendering(true);
  }

  getCanvas(): HTMLCanvasElement {
    if (!this.lifecycle.initialized) throw new Error('Battle renderer has not been initialized.');
    return this.lifecycle.app.canvas as HTMLCanvasElement;
  }

  renderExportFrame(snapshot: WorldSnapshot, events: readonly SimulationEvent[], dtMs: number): RenderDiagnostics {
    const diagnostics = this.render(snapshot, 0, events, dtMs);
    this.lifecycle.renderNow();
    return diagnostics;
  }

  setPlayerAimPoint(point: Vec2 | null): void {
    this.playerTargeting.setAimPoint(point);
  }

  setPointerAimEnabled(enabled: boolean): void {
    this.playerTargeting.setPointerAimEnabled(enabled);
  }

  setPlayerPreviewSlot(slot: AbilitySlot): void {
    this.playerTargeting.setPreviewSlot(slot);
  }

  setActive(active: boolean): void {
    this.lifecycle.setActive(active);
    if (active && this.lifecycle.initialized) this.camera.requestSnap();
  }

  refreshLayout(): void {
    this.lifecycle.refreshLayout();
    if (this.lifecycle.initialized) this.camera.requestSnap();
  }

  setArena(arenaId: string): void {
    if (this.arena?.id === arenaId) return;
    this.setArenaDefinition(arenaId);
    if (!this.lifecycle.initialized) return;
    this.layeredFx?.setArena(this.arena);
    this.arenaView.drawArena();
    this.camera.fit(this.lifecycle.app.screen.width, this.lifecycle.app.screen.height);
    this.camera.snap(this.lifecycle.app.screen.width, this.lifecycle.app.screen.height);
  }

  setFocusEntity(entityId: EntityId | null): void {
    this.camera.setFocusEntity(entityId);
  }

  clientToWorld(clientX: number, clientY: number): Vec2 {
    const app = this.lifecycle.app;
    const rect = app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const screenX = (clientX - rect.left) * (app.screen.width / rect.width);
    const screenY = (clientY - rect.top) * (app.screen.height / rect.height);
    const world = this.camera.worldRoot.toLocal(new Point(screenX, screenY));
    return { x: world.x, y: world.y };
  }

  setSettings(settings: PresentationSettings): void {
    const changes = this.settingsController.set(settings);
    this.arenaView.setSettings(settings);
    this.camera.setSettings(settings);
    if (!this.shouldShowDamageNumbers()) this.damageNumbers.clear();
    if (changes.resolutionChanged && this.lifecycle.initialized) this.lifecycle.queueResize(true);
    if (changes.profileChanged) {
      for (const view of this.fighterViews.values()) view.setProfile(settings.renderProfile);
    }
    if (this.lifecycle.initialized && (changes.profileChanged || changes.arenaBackgroundChanged)) {
      this.arenaView.drawArena();
    }
    if (changes.followChanged) {
      this.camera.requestSnap();
      // Settings may synchronize before Pixi Application.init() completes.
      if (this.lifecycle.initialized && !settings.cameraFollow) {
        this.camera.snap(this.lifecycle.app.screen.width, this.lifecycle.app.screen.height);
      }
    }
  }

  setPerformanceScale(scale: number): void {
    const previousResolution = this.settingsController.resolveResolution();
    if (!this.settingsController.setPerformanceScale(scale)) return;
    if (this.lifecycle.initialized
      && Math.abs(previousResolution - this.settingsController.resolveResolution()) >= 0.04) {
      this.lifecycle.queueResize(true);
    }
  }

  setTrainingDebugOptions(options: Partial<TrainingDebugOptions>): void {
    this.trainingDebug.setOptions(options);
    if (!this.shouldShowDamageNumbers()) this.damageNumbers.clear();
  }

  render(snapshot: WorldSnapshot, alpha: number, events: readonly SimulationEvent[], dtMs: number): RenderDiagnostics {
    if (!this.settingsController.hasSettings || this.lifecycle.contextLost || !this.lifecycle.active) {
      return this.diagnosticsTracker.current;
    }
    const settings = this.settingsController.current;
    const performanceScale = this.settingsController.performanceScale;
    const app = this.lifecycle.app;
    this.lifecycle.ensureCanvasMounted();
    this.elapsedSeconds += Math.min(0.05, dtMs / 1000);
    this.fighterTrails.consume(events, Math.min(0.05, dtMs / 1000));
    const frame = this.eventRouter.route(snapshot, events, settings.targetRenderFps, performanceScale);
    const {
      renderPolicy,
      presentationEvents,
      visibleProjectiles,
      missileBarrageActive
    } = frame;
    this.playerTargeting.raiseHitmarker(frame.playerHitmarkerFlash);
    if (missileBarrageActive) {
      // A barrage is continuous presentation. Keep the whole chain real-time.
      this.freezeMs = 0;
    }
    this.lifecycle.syncSize(false);
    this.arenaView.drawObstacles(snapshot);
    const profile = getRenderProfile(settings.renderProfile);
    const baseLod: VisualLod = snapshot.entities.length <= 12
      ? 'hero'
      : snapshot.entities.length <= 36
        ? 'standard'
        : 'army';
    const automaticLod: VisualLod = renderPolicy.tier === 'mass' || performanceScale < 0.5
      ? 'army'
      : performanceScale < 0.78 && baseLod === 'hero'
        ? 'standard'
        : baseLod;
    const crowdParticleScale = snapshot.entities.length <= 12
      ? 1
      : snapshot.entities.length <= 28
        ? 0.68
        : snapshot.entities.length <= 55
          ? 0.4
          : 0.22;

    this.activeEntityIds.clear();
    for (const entity of snapshot.entities) this.activeEntityIds.add(entity.id);
    for (const [id, view] of this.fighterViews) {
      if (!this.activeEntityIds.has(id)) {
        view.container.visible = false;
        this.fighterTrails.removeEntity(id);
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
        view = new FighterView(entity, settings.renderProfile, entityLod);
        this.fighterViews.set(entity.id, view);
        this.stage.fighterLayer.addChild(view.container);
        this.createdFighterViews += 1;
      } else if (!view.container.visible) {
        view.prepareForReuse();
        this.reusedFighterViews += 1;
      }
      view.container.visible = true;
      view.setLod(entity.controller === 'player' ? 'hero' : automaticLod);
    }

    const vfxQuality = resolveVfxQuality({
      effects: settings.effects,
      particleScale: settings.particleScale,
      reducedMotion: settings.reducedMotion,
      adaptiveQuality: settings.adaptiveQuality,
      performanceScale,
      fighterCount: snapshot.entities.length
    });
    const effectiveParticleScale = profile.defaultParticleScale
      * crowdParticleScale
      * settings.particleScale
      * performanceScale
      * vfxQuality.particleMultiplier;
    if (settings.effects && effectiveParticleScale > 0) {
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
        if (settings.cameraShake) {
          const shake = missileBarrageActive ? Math.min(3, response.shake) : response.shake;
          this.camera.addShake(shake * vfxQuality.shakeMultiplier);
        }
        if (settings.impactFreeze && !missileBarrageActive) {
          this.freezeMs = Math.max(this.freezeMs, response.freezeMs * vfxQuality.freezeMultiplier);
        }
        const flash = missileBarrageActive ? Math.min(0.14, response.screenFlash) : response.screenFlash;
        this.screenFlash.raise(flash * vfxQuality.flashMultiplier);
      }
    }

    this.telegraphs.render(snapshot, this.elapsedSeconds, settings.effects && settings.renderProfile !== 'debug');
    const frozen = !missileBarrageActive && settings.impactFreeze && this.freezeMs > 0;
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
          settings.reducedMotion,
          snapshot.battleEnded && snapshot.winningTeam === entity.team,
          settings.showMountedAttachments,
          settings.showFighterHealthRings
        );
        const hasKnockbackTrail = this.fighterTrails.hasKnockbackTrail(entity.id);
        const shouldSampleTrail = performanceScale >= 0.48
          && (snapshot.entities.length <= 24
            || entity.controller === 'player'
            || entity.id % Math.ceil(snapshot.entities.length / 24) === 0);
        if (hasKnockbackTrail || shouldSampleTrail) this.fighterTrails.update(entity, alpha);
      }
      this.fighterTrails.draw(snapshot, settings);
    }
    if (settings.effects) {
      this.layeredFx?.update(
        snapshot,
        alpha,
        this.elapsedSeconds,
        frozen ? 0 : Math.min(0.05, dtMs / 1000),
        vfxQuality,
        settings.trails,
        renderPolicy.maxProjectileTrails,
        renderPolicy.tier === 'mass'
      );
    } else {
      this.layeredFx?.reset();
    }
    this.projectiles.draw(visibleProjectiles, alpha, this.elapsedSeconds);
    this.playerTargeting.draw(snapshot, alpha);
    const combatTextEvents = this.trainingDebug.showDamageNumbers ? events : presentationEvents;
    this.damageNumbers.consume(combatTextEvents, snapshot, this.shouldShowDamageNumbers());
    this.trainingDebug.draw(snapshot, alpha);
    this.damageNumbers.update(dtMs);

    if (!this.legacyFxSuppressed) this.fx?.update(frozen ? 0 : Math.min(0.05, dtMs / 1000));
    this.screenFlash.draw(settings, dtMs, app.screen.width, app.screen.height);
    this.camera.update(snapshot, app.screen.width, app.screen.height);
    const cssWidth = Math.max(1, this.lifecycle.lastHostWidth || Math.round(app.screen.width));
    const cssHeight = Math.max(1, this.lifecycle.lastHostHeight || Math.round(app.screen.height));
    const layeredDiagnostics = this.layeredFx?.getDiagnostics() ?? {
      activeGroundMarks: 0,
      activeResiduals: 0,
      activeWeaponEffects: 0,
      projectileTrails: 0
    };
    return this.diagnosticsTracker.update({
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
      qualityScale: performanceScale,
      resolution: this.lifecycle.lastResolution,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      renderScale: settings.renderScale,
      cssWidth,
      cssHeight,
      pixelWidth: Math.max(1, app.canvas.width),
      pixelHeight: Math.max(1, app.canvas.height),
      orientation: cssWidth >= cssHeight ? 'landscape' : 'portrait',
      resizeCount: this.lifecycle.resizeCount,
      contextLost: this.lifecycle.contextLost,
      renderTier: renderPolicy.tier,
      targetRenderFps: renderPolicy.targetFps,
      presentationEvents: presentationEvents.length,
      projectileVisuals: visibleProjectiles.length
    });
  }

  getDiagnostics(): RenderDiagnostics {
    return this.diagnosticsTracker.snapshot();
  }

  reset(): void {
    for (const view of this.fighterViews.values()) {
      view.container.visible = false;
      view.prepareForReuse();
      view.container.visible = false;
    }
    this.activeEntityIds.clear();
    this.fighterTrails.reset();
    this.projectiles.reset();
    this.trainingDebug.reset();
    this.playerTargeting.reset();
    this.damageNumbers.clear();
    this.arenaView.resetObstacles();
    this.screenFlash.reset();
    this.fx?.reset();
    this.legacyFxSuppressed = false;
    this.layeredFx?.reset();
    this.telegraphs.reset();
    this.freezeMs = 0;
    this.eventRouter.reset();
    this.camera.reset();
  }

  destroy(): void {
    if (this.lifecycle.destroyed) return;
    if (this.lifecycle.initialized) this.reset();
    for (const view of this.fighterViews.values()) view.destroy();
    this.fighterViews.clear();
    this.layeredFx?.destroy();
    this.layeredFx = null;
    this.fx = null;
    this.lifecycle.destroy();
    this.initPromise = null;
  }

  private setArenaDefinition(arenaId: string): void {
    this.arena = getArena(arenaId);
    this.arenaView.setArena(this.arena);
    this.camera.setArena(this.arena);
    this.trainingDebug.setArena(this.arena);
  }

  private handleRendererReady(): void {
    const app = this.lifecycle.app;
    this.stage.mount(app, this.camera, this.arenaView, {
      trail: this.fighterTrails.graphics,
      projectile: this.projectiles.graphics,
      trainingDebug: this.trainingDebug.graphics,
      playerTargeting: this.playerTargeting.graphics,
      telegraphs: this.telegraphs.container,
      screenFlash: this.screenFlash.graphics
    });
    this.fx = new FxEngine(this.stage.fxLayer);
    this.layeredFx = new LayeredVfxEngine({
      arena: this.stage.groundFxLayer,
      world: this.stage.fxLayer,
      fighter: this.stage.fighterFxLayer,
      weapon: this.stage.weaponFxLayer,
      projectile: this.stage.projectileFxLayer,
      foreground: this.stage.screenFxLayer
    }, this.arena);
    this.arenaView.drawArena();
  }

  private handleRendererResize(): void {
    const app = this.lifecycle.app;
    this.camera.fit(app.screen.width, app.screen.height);
    this.camera.requestSnap();
    this.camera.snap(app.screen.width, app.screen.height);
  }

  private shouldShowDamageNumbers(): boolean {
    return this.settingsController.hasSettings
      && (this.settingsController.current.showDamageNumbers || this.trainingDebug.showDamageNumbers);
  }
}
