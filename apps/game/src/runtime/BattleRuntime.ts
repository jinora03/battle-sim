import { BattleAudioEngine, type AudioDiagnostics } from '@kinetic/audio';
import { getGameMode } from '@kinetic/content';
import { AiController, PlayerController, type AiDecisionDebug, type AiWorkloadStats } from '@kinetic/controllers';
import {
  AchievementEngine,
  BattleStatsTracker,
  getDifficultyPreset,
  type AchievementUnlock,
  type BattleCompletionSummary,
  type FighterStats
} from '@kinetic/meta';
import type {
  AbilityRejectedEvent,
  AbilitySlot,
  BattleDefinition,
  BattleResultSnapshot,
  BattleObjectiveSnapshot,
  BattleParticipant,
  ControllerKind,
  SimulationCommand,
  SimulationEvent,
  Vec2,
  WorldSnapshot
} from '@kinetic/protocol';
import { PixiBattleRenderer, resolveMassBattleRenderPolicy, type RenderDiagnostics } from '@kinetic/renderer-pixi';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner, SIM_TICK_MS } from '@kinetic/simulation';
import type { PresentationSettings } from '@kinetic/visual-engine';
import type { ReplayExportSource } from '@kinetic/video-export';
import { DEFAULT_BATTLE_SETUP, type BattleSetup } from './BattleSetup';
import { diagnosticsIntervalForEntityCount, metaEvaluationIntervalForEntityCount, RuntimePerformanceProfiler, type PerformanceBottleneck, type PerformancePressure } from './performance';

export interface RecentSkillActivity {
  entityId: number;
  fighterId: string;
  abilityId: string;
  slot: AbilitySlot;
  phase: 'started' | 'resolved';
  tick: number;
}

export interface RecentArenaActivity {
  label: string;
  tick: number;
}

export interface TeamSummary {
  team: number;
  alive: number;
  total: number;
  hp: number;
  maxHp: number;
}

export interface RuntimePerformance {
  simulationMs: number;
  aiMs: number;
  playerInputMs: number;
  replayMs: number;
  simulationCoreMs: number;
  snapshotMs: number;
  postSimulationMs: number;
  diagnosticsMs: number;
  renderMs: number;
  frameMs: number;
  simulationP95Ms: number;
  renderP95Ms: number;
  frameP95Ms: number;
  renderFps: number;
  qualityScale: number;
  slowFrames: number;
  droppedSimulationTicks: number;
  longFrameStreak: number;
  stepsLastFrame: number;
  pressure: PerformancePressure;
  bottleneck: PerformanceBottleneck;
}

export interface RuntimeDiagnostics {
  tick: number;
  checksum: string;
  battleEnded: boolean;
  winningTeam: number | null;
  result: BattleResultSnapshot | null;
  entities: WorldSnapshot['entities'];
  obstacles: WorldSnapshot['obstacles'];
  objective: BattleObjectiveSnapshot;
  stats: Record<number, FighterStats>;
  achievements: string[];
  replayFrames: number;
  replayCommands: number;
  replayStoredCommands: number;
  replayCompressionRatio: number;
  recentSkills: RecentSkillActivity[];
  recentArenaActivity: RecentArenaActivity[];
  recentAbilityRejection: AbilityRejectedEvent | null;
  playerEntityIds: number[];
  simulationMetrics: WorldSnapshot['metrics'];
  renderDiagnostics: RenderDiagnostics;
  audioDiagnostics: AudioDiagnostics;
  performance: RuntimePerformance;
  teams: TeamSummary[];
  aiDecisions: AiDecisionDebug[];
  aiWorkload: AiWorkloadStats;
}

export interface RuntimeMetaCallbacks {
  onAchievementUnlocked?(unlock: AchievementUnlock): void;
  onBattleCompleted?(summary: BattleCompletionSummary): void;
}

export class BattleRuntime {
  private runner!: LocalSimulationRunner;
  private readonly ai = new AiController(false);
  private readonly player = new PlayerController();
  private readonly stats = new BattleStatsTracker();
  private readonly achievements: AchievementEngine;
  private readonly audio = new BattleAudioEngine();
  private readonly renderer = new PixiBattleRenderer();
  private replay!: ReplayRecorder;
  private settings: PresentationSettings;
  private raf = 0;
  private lastTime = performance.now();
  private accumulator = 0;
  private diagnosticsTick = -1;
  private recentSkills: RecentSkillActivity[] = [];
  private recentArenaActivity: RecentArenaActivity[] = [];
  private recentAbilityRejection: AbilityRejectedEvent | null = null;
  private seed: number;
  private setup: BattleSetup;
  private playerEntityIds: number[] = [];
  private renderDiagnostics: RenderDiagnostics = { lod: 'hero', fighterViews: 0, pooledFighterViews: 0, createdFighterViews: 0, reusedFighterViews: 0, particleScale: 1, activeParticles: 0, vfxQuality: 'high', groundMarks: 0, residualParticles: 0, weaponEffects: 0, projectileTrails: 0, qualityScale: 1, resolution: 1, devicePixelRatio: 1, renderScale: 1, cssWidth: 1, cssHeight: 1, pixelWidth: 1, pixelHeight: 1, orientation: 'landscape', resizeCount: 0, contextLost: false, renderTier: 'full', targetRenderFps: 60, presentationEvents: 0, projectileVisuals: 0 };
  private audioDiagnostics: AudioDiagnostics = { eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: 22 };
  private performance: RuntimePerformance = {
    simulationMs: 0,
    aiMs: 0,
    playerInputMs: 0,
    replayMs: 0,
    simulationCoreMs: 0,
    snapshotMs: 0,
    postSimulationMs: 0,
    diagnosticsMs: 0,
    renderMs: 0,
    frameMs: 0,
    simulationP95Ms: 0,
    renderP95Ms: 0,
    frameP95Ms: 0,
    renderFps: 0,
    qualityScale: 1,
    slowFrames: 0,
    droppedSimulationTicks: 0,
    longFrameStreak: 0,
    stepsLastFrame: 0,
    pressure: 'healthy',
    bottleneck: 'balanced'
  };
  private simulationSampleMs = 0;
  private aiSampleMs = 0;
  private playerInputSampleMs = 0;
  private replaySampleMs = 0;
  private simulationCoreSampleMs = 0;
  private snapshotSampleMs = 0;
  private postSimulationSampleMs = 0;
  private diagnosticsSampleMs = 0;
  private cachedChecksum = '--------';
  private checksumTick = -1;
  private detailedDiagnosticsEnabled = false;
  private readonly performanceProfiler = new RuntimePerformanceProfiler();
  private latestSnapshot!: WorldSnapshot;
  private active = true;
  private teamTotals = new Map<number, number>();
  private teamMaxHpTotals = new Map<number, number>();
  private currentBattle!: BattleDefinition;
  private completionEmitted = false;
  private lastRenderAt = 0;
  private adaptiveQualityScale = 1;
  private slowFrameStreak = 0;
  private fastFrameStreak = 0;
  private pendingRenderEvents: SimulationEvent[] = [];
  private pendingMetaEvents: SimulationEvent[] = [];
  private lastMetaEvaluationTick = -1;
  private readonly fighterIdByEntityId = new Map<number, string>();
  private aiEntityIds: number[] = [];
  private paused = false;
  private startPromise: Promise<void> | null = null;
  private started = false;
  private destroyed = false;
  private lastActivityPruneTick = -1;

  constructor(
    private host: HTMLElement,
    seed: number,
    settings: PresentationSettings,
    private readonly onDiagnostics: (diagnostics: RuntimeDiagnostics) => void,
    setup: BattleSetup = DEFAULT_BATTLE_SETUP,
    private readonly metaCallbacks: RuntimeMetaCallbacks = {},
    initialAchievementIds: readonly string[] = []
  ) {
    this.seed = seed;
    this.settings = { ...settings };
    this.setup = { ...setup };
    this.achievements = new AchievementEngine(undefined, initialAchievementIds);
  }

  start(): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Battle runtime has been destroyed.'));
    if (this.started) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().then(() => {
      if (this.destroyed) throw new Error('Battle runtime was destroyed during startup.');
      this.started = true;
      this.startPromise = null;
    }, (reason: unknown) => {
      this.startPromise = null;
      throw reason;
    });
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    const battle = this.createBattle(this.seed);
    this.currentBattle = battle;
    this.completionEmitted = false;
    this.runner = new LocalSimulationRunner(battle);
    this.latestSnapshot = this.runner.getRuntimeSnapshot();
    this.captureTeamTotals(battle, this.latestSnapshot);
    this.replay = new ReplayRecorder(battle);
    await this.renderer.init(this.host, battle.arenaId, this.settings);
    if (this.destroyed) {
      this.renderer.destroy();
      throw new Error('Battle runtime was destroyed during renderer initialization.');
    }
    this.renderer.setActive(this.active);
    this.renderer.setPerformanceScale(this.adaptiveQualityScale);
    this.audio.setVolume(this.settings.masterVolume);
    this.configureControllers();
    this.renderCurrentSnapshot();
    this.emitDiagnostics();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  restart(seed = this.seed, setup: BattleSetup = this.setup): void {
    if (this.destroyed || !this.started) return;
    this.audio.reset();
    this.seed = seed >>> 0;
    this.setup = { ...setup };
    const battle = this.createBattle(this.seed);
    this.currentBattle = battle;
    this.completionEmitted = false;
    this.runner = new LocalSimulationRunner(battle);
    this.latestSnapshot = this.runner.getRuntimeSnapshot();
    this.captureTeamTotals(battle, this.latestSnapshot);
    this.ai.reset();
    this.player.reset();
    this.stats.reset();
    this.replay.reset(battle);
    this.renderer.setArena(battle.arenaId);
    this.renderer.reset();
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.diagnosticsTick = -1;
    this.cachedChecksum = '--------';
    this.checksumTick = -1;
    this.aiSampleMs = 0;
    this.playerInputSampleMs = 0;
    this.replaySampleMs = 0;
    this.simulationCoreSampleMs = 0;
    this.snapshotSampleMs = 0;
    this.postSimulationSampleMs = 0;
    this.diagnosticsSampleMs = 0;
    this.recentSkills = [];
    this.recentArenaActivity = [];
    this.recentAbilityRejection = null;
    this.pendingRenderEvents = [];
    this.pendingMetaEvents = [];
    this.lastMetaEvaluationTick = -1;
    this.lastActivityPruneTick = -1;
    this.lastRenderAt = 0;
    this.performanceProfiler.reset();
    this.performance = {
      simulationMs: 0,
      aiMs: 0,
      playerInputMs: 0,
      replayMs: 0,
      simulationCoreMs: 0,
      snapshotMs: 0,
      postSimulationMs: 0,
      diagnosticsMs: 0,
      renderMs: 0,
      frameMs: 0,
      simulationP95Ms: 0,
      renderP95Ms: 0,
      frameP95Ms: 0,
      renderFps: 0,
      qualityScale: this.adaptiveQualityScale,
      slowFrames: 0,
      droppedSimulationTicks: 0,
      longFrameStreak: 0,
      stepsLastFrame: 0,
      pressure: 'healthy',
      bottleneck: 'balanced'
    };
    this.configureControllers();
    this.renderer.setActive(this.active);
    this.renderCurrentSnapshot();
    this.emitDiagnostics();
  }

  setSettings(settings: PresentationSettings): void {
    this.settings = { ...settings };
    this.renderer.setSettings(settings);
    this.audio.setEnabled(settings.audio);
    this.audio.setVolume(settings.masterVolume);
    if (!settings.adaptiveQuality) {
      this.adaptiveQualityScale = 1;
      this.slowFrameStreak = 0;
      this.fastFrameStreak = 0;
      this.renderer.setPerformanceScale(1);
    }
  }

  setDetailedDiagnosticsEnabled(enabled: boolean): void {
    if (this.detailedDiagnosticsEnabled === enabled) return;
    this.detailedDiagnosticsEnabled = enabled;
    this.ai.setDetailedDebugEnabled(enabled);
    if (!this.latestSnapshot || !this.replay) return;
    this.emitDiagnostics(true);
  }

  setUnlockedAchievements(ids: readonly string[]): void {
    this.achievements.replaceUnlocked(ids);
    if (!this.runner || !this.replay) return;
    this.emitDiagnostics();
  }

  async enableAudio(): Promise<void> {
    await this.audio.enable();
    this.audio.setEnabled(true);
    this.audio.setVolume(this.settings.masterVolume);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.lastTime = performance.now();
    if (paused) this.player.setMovement({ x: 0, y: 0 });
    void this.audio.setPaused(paused);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.lastTime = performance.now();
    this.renderer.setActive(active);
    if (active && this.latestSnapshot) this.renderCurrentSnapshot();
  }

  attachHost(host: HTMLElement): void {
    this.host = host;
    this.renderer.attachHost(host);
    this.renderer.setActive(this.active);
  }

  refreshRendererLayout(): void {
    this.renderer.refreshLayout();
  }

  queuePlayerCommand(command: SimulationCommand): void {
    this.player.queue(command);
  }

  setPlayerMovement(direction: Vec2): void {
    this.player.setMovement(direction);
  }

  setPlayerAim(direction: Vec2): void {
    this.player.setAim(direction);
  }

  setPointerAimEnabled(enabled: boolean): void {
    this.renderer.setPointerAimEnabled(enabled);
    if (!enabled) this.player.clearAimPoint();
  }

  setAimAssist(strength: number): void {
    this.player.setAimAssist(strength);
  }

  setPlayerAimFromClient(clientX: number, clientY: number): void {
    if (this.playerEntityIds.length === 0) return;
    const player = this.latestSnapshot.entities.find((entity) => entity.id === this.playerEntityIds[0]);
    if (!player) return;
    const world = this.renderer.clientToWorld(clientX, clientY);
    this.renderer.setPlayerAimPoint(world);
    this.player.setAimAt(world, { x: world.x - player.x, y: world.y - player.y });
  }

  setPlayerMouseDriveFromClient(clientX: number, clientY: number): void {
    if (this.playerEntityIds.length === 0) return;
    const player = this.latestSnapshot.entities.find((entity) => entity.id === this.playerEntityIds[0]);
    if (!player) return;
    const world = this.renderer.clientToWorld(clientX, clientY);
    this.renderer.setPlayerAimPoint(world);
    const delta = { x: world.x - player.x, y: world.y - player.y };
    const distance = Math.hypot(delta.x, delta.y);
    this.player.setAimAt(world, delta);
    const deadzone = Math.max(18, player.radius * 0.55);
    const fullSpeedDistance = 240;
    if (distance <= deadzone) {
      this.player.setMovement({ x: 0, y: 0 });
      return;
    }
    const normalized = { x: delta.x / distance, y: delta.y / distance };
    const t = Math.max(0, Math.min(1, (distance - deadzone) / (fullSpeedDistance - deadzone)));
    const eased = t * t * (3 - 2 * t);
    this.player.setMovement({ x: normalized.x * eased, y: normalized.y * eased });
  }

  activatePlayerAbility(slot: AbilitySlot): void {
    this.renderer.setPlayerPreviewSlot(slot);
    this.player.activate(slot);
  }

  previewPlayerAbility(slot: AbilitySlot): void {
    this.renderer.setPlayerPreviewSlot(slot);
  }

  exportReplay(): string {
    if (!this.replay) return '';
    return JSON.stringify(this.replay.export(), null, 2);
  }

  createReplayExportSource(): ReplayExportSource {
    if (!this.replay || !this.runner) throw new Error('Battle replay is not ready yet.');
    const snapshot = this.runner.getSnapshot();
    return {
      replay: this.replay.export(),
      endTick: snapshot.tick,
      checksum: checksumSnapshot(snapshot)
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.started = false;
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.audio.reset();
    this.renderer.destroy();
  }

  private readonly frame = (now: number): void => {
    if (this.paused || !this.active) {
      this.lastTime = now;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const frameMs = Math.min(250, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    this.accumulator += frameMs;
    let steps = 0;
    const simulationStart = performance.now();
    this.aiSampleMs = 0;
    this.playerInputSampleMs = 0;
    this.replaySampleMs = 0;
    this.simulationCoreSampleMs = 0;
    this.snapshotSampleMs = 0;
    this.postSimulationSampleMs = 0;

    while (this.accumulator >= SIM_TICK_MS && steps < 8) {
      const before = this.latestSnapshot;
      if (before.battleEnded) {
        this.accumulator = 0;
        break;
      }
      const detailedTiming = this.detailedDiagnosticsEnabled;
      const aiStart = detailedTiming ? performance.now() : 0;
      const commands = this.ai.commandsForTick(before);
      if (detailedTiming) this.aiSampleMs += performance.now() - aiStart;

      const playerInputStart = detailedTiming ? performance.now() : 0;
      commands.push(...this.player.commandsForTick(before));
      if (detailedTiming) this.playerInputSampleMs += performance.now() - playerInputStart;

      const replayStart = detailedTiming ? performance.now() : 0;
      this.replay.record(before.tick, commands);
      if (detailedTiming) this.replaySampleMs += performance.now() - replayStart;

      const simulationCoreStart = detailedTiming ? performance.now() : 0;
      const events = this.runner.step(commands);
      if (detailedTiming) this.simulationCoreSampleMs += performance.now() - simulationCoreStart;

      const postSimulationStart = detailedTiming ? performance.now() : 0;
      this.appendRenderEvents(events);
      let activityChanged = false;
      for (const event of events) {
        if (event.type === 'weaponAttackStarted') {
          const fighterId = this.fighterIdByEntityId.get(event.entityId) ?? 'unknown';
          this.recentSkills.push({ entityId: event.entityId, fighterId, abilityId: event.weaponId, slot: 'basic', phase: 'started', tick: event.tick });
          activityChanged = true;
        } else if (event.type === 'abilityActivated') {
          const fighterId = this.fighterIdByEntityId.get(event.entityId) ?? 'unknown';
          this.recentSkills.push({ entityId: event.entityId, fighterId, abilityId: event.abilityId, slot: event.slot, phase: 'started', tick: event.tick });
          activityChanged = true;
        } else if (event.type === 'abilityResolved') {
          const fighterId = this.fighterIdByEntityId.get(event.entityId) ?? 'unknown';
          this.recentSkills.push({ entityId: event.entityId, fighterId, abilityId: event.abilityId, slot: event.slot, phase: 'resolved', tick: event.tick });
          activityChanged = true;
        } else if (event.type === 'abilityRejected') {
          this.recentAbilityRejection = event;
        }
        else if (event.type === 'zoneEntered') { this.recentArenaActivity.push({ label: `#${event.entityId} entered ${event.kind}`, tick: event.tick }); activityChanged = true; }
        else if (event.type === 'hazardTriggered') { this.recentArenaActivity.push({ label: `${event.kind} hazard hit #${event.entityId}`, tick: event.tick }); activityChanged = true; }
        else if (event.type === 'obstacleDestroyed') { this.recentArenaActivity.push({ label: `${event.obstacleId} destroyed`, tick: event.tick }); activityChanged = true; }
      }
      if (activityChanged || this.lastActivityPruneTick < 0 || this.runner.tick - this.lastActivityPruneTick >= 30) {
        this.pruneRecentActivity(this.runner.tick);
      }
      this.stats.consume(events);
      for (const event of events) this.pendingMetaEvents.push(event);
      const snapshotStart = detailedTiming ? performance.now() : 0;
      this.latestSnapshot = this.runner.getRuntimeSnapshot();
      if (detailedTiming) this.snapshotSampleMs += performance.now() - snapshotStart;
      const metaInterval = metaEvaluationIntervalForEntityCount(this.latestSnapshot.entities.length);
      const metaDue = this.latestSnapshot.battleEnded
        || this.lastMetaEvaluationTick < 0
        || this.latestSnapshot.tick - this.lastMetaEvaluationTick >= metaInterval;
      let statsSnapshot: Record<number, FighterStats> | null = null;
      if (metaDue) {
        statsSnapshot = this.stats.snapshot();
        const unlocked = this.achievements.consume(this.latestSnapshot, statsSnapshot, this.pendingMetaEvents);
        this.pendingMetaEvents.length = 0;
        this.lastMetaEvaluationTick = this.latestSnapshot.tick;
        for (const item of unlocked) this.metaCallbacks.onAchievementUnlocked?.(item);
      }
      if (this.latestSnapshot.battleEnded && !this.completionEmitted) {
        this.completionEmitted = true;
        statsSnapshot ??= this.stats.snapshot();
        const playerTeam = this.currentBattle.participants.find((participant) => participant.controller === 'player')?.team ?? null;
        this.metaCallbacks.onBattleCompleted?.({
          battle: structuredClone(this.currentBattle),
          durationTicks: this.latestSnapshot.tick,
          winningTeam: this.latestSnapshot.winningTeam,
          playerTeam,
          stats: statsSnapshot,
          difficulty: this.setup.difficulty
        });
      }
      this.audioDiagnostics = this.audio.consume(events, this.latestSnapshot.entities.length, this.playerEntityIds, this.aiEntityIds);
      if (detailedTiming) this.postSimulationSampleMs += performance.now() - postSimulationStart;
      this.accumulator -= SIM_TICK_MS;
      steps += 1;
    }

    this.simulationSampleMs = performance.now() - simulationStart;
    if (steps === 8 && this.accumulator >= SIM_TICK_MS) {
      const droppedTicks = Math.max(0, Math.floor(this.accumulator / SIM_TICK_MS) - 1);
      this.performanceProfiler.addDroppedSimulationTicks(droppedTicks);
      this.accumulator = SIM_TICK_MS;
    }
    const renderPolicy = resolveMassBattleRenderPolicy(this.latestSnapshot.entities.length, this.settings.targetRenderFps, this.adaptiveQualityScale);
    const renderInterval = 1000 / renderPolicy.targetFps;
    const shouldRender = this.lastRenderAt === 0 || now - this.lastRenderAt >= renderInterval - 1;
    let renderMs = 0;
    let renderFps = this.performance.renderFps;
    if (shouldRender) {
      const alpha = this.accumulator / SIM_TICK_MS;
      const renderStart = performance.now();
      this.renderDiagnostics = this.renderer.render(this.latestSnapshot, alpha, this.pendingRenderEvents, Math.max(renderInterval, now - this.lastRenderAt));
      renderMs = performance.now() - renderStart;
      renderFps = this.lastRenderAt > 0 ? 1000 / Math.max(1, now - this.lastRenderAt) : this.settings.targetRenderFps;
      this.lastRenderAt = now;
      this.pendingRenderEvents = [];
      this.updateAdaptiveQuality(this.simulationSampleMs + renderMs, renderInterval);
    }

    const profile = this.performanceProfiler.record({ simulationMs: this.simulationSampleMs, renderMs, frameMs }, renderInterval);
    const blend = 0.12;
    this.performance = {
      simulationMs: this.performance.simulationMs * (1 - blend) + this.simulationSampleMs * blend,
      aiMs: this.performance.aiMs * (1 - blend) + this.aiSampleMs * blend,
      playerInputMs: this.performance.playerInputMs * (1 - blend) + this.playerInputSampleMs * blend,
      replayMs: this.performance.replayMs * (1 - blend) + this.replaySampleMs * blend,
      simulationCoreMs: this.performance.simulationCoreMs * (1 - blend) + this.simulationCoreSampleMs * blend,
      snapshotMs: this.performance.snapshotMs * (1 - blend) + this.snapshotSampleMs * blend,
      postSimulationMs: this.performance.postSimulationMs * (1 - blend) + this.postSimulationSampleMs * blend,
      diagnosticsMs: this.performance.diagnosticsMs * (1 - blend) + this.diagnosticsSampleMs * blend,
      renderMs: this.performance.renderMs * (1 - blend) + renderMs * blend,
      frameMs: this.performance.frameMs * (1 - blend) + frameMs * blend,
      simulationP95Ms: profile.simulationP95Ms,
      renderP95Ms: profile.renderP95Ms,
      frameP95Ms: profile.frameP95Ms,
      renderFps: this.performance.renderFps * (1 - blend) + renderFps * blend,
      qualityScale: this.adaptiveQualityScale,
      slowFrames: this.performance.slowFrames,
      droppedSimulationTicks: profile.droppedSimulationTicks,
      longFrameStreak: profile.longFrameStreak,
      stepsLastFrame: steps,
      pressure: profile.pressure,
      bottleneck: profile.bottleneck
    };

    const diagnosticsInterval = diagnosticsIntervalForEntityCount(this.latestSnapshot.entities.length);
    if (this.runner.tick !== this.diagnosticsTick && (this.runner.tick % diagnosticsInterval === 0 || this.latestSnapshot.battleEnded)) {
      this.diagnosticsTick = this.runner.tick;
      this.emitDiagnostics();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private updateAdaptiveQuality(workMs: number, budgetMs: number): void {
    if (!this.settings.adaptiveQuality) return;
    const slow = workMs > budgetMs * 0.86;
    const fast = workMs < budgetMs * 0.48;
    this.slowFrameStreak = slow ? this.slowFrameStreak + 1 : Math.max(0, this.slowFrameStreak - 2);
    this.fastFrameStreak = fast ? this.fastFrameStreak + 1 : Math.max(0, this.fastFrameStreak - 1);
    if (slow) this.performance.slowFrames += 1;
    if (this.slowFrameStreak >= 20 && this.adaptiveQualityScale > 0.4) {
      this.adaptiveQualityScale = Math.max(0.4, Math.round((this.adaptiveQualityScale - 0.12) * 100) / 100);
      this.slowFrameStreak = 0;
      this.fastFrameStreak = 0;
      this.renderer.setPerformanceScale(this.adaptiveQualityScale);
    } else if (this.fastFrameStreak >= 180 && this.adaptiveQualityScale < 1) {
      this.adaptiveQualityScale = Math.min(1, Math.round((this.adaptiveQualityScale + 0.08) * 100) / 100);
      this.fastFrameStreak = 0;
      this.renderer.setPerformanceScale(this.adaptiveQualityScale);
    }
  }

  private renderCurrentSnapshot(): void {
    if (!this.latestSnapshot || !this.active) return;
    this.renderDiagnostics = this.renderer.render(this.latestSnapshot, 0, [], 0);
    this.lastRenderAt = performance.now();
  }

  private configureControllers(): void {
    this.fighterIdByEntityId.clear();
    for (const entity of this.latestSnapshot.entities) this.fighterIdByEntityId.set(entity.id, entity.fighterId);
    this.playerEntityIds = this.latestSnapshot.entities.filter((entity) => entity.controller === 'player').map((entity) => entity.id);
    this.aiEntityIds = this.latestSnapshot.entities.filter((entity) => entity.controller === 'ai').map((entity) => entity.id);
    this.player.setControlledEntities(this.playerEntityIds);
    this.renderer.setFocusEntity(this.playerEntityIds[0] ?? null);
    this.renderer.setPlayerPreviewSlot('basic');
    const player = this.latestSnapshot.entities.find((entity) => entity.id === this.playerEntityIds[0]);
    if (player) this.renderer.setPlayerAimPoint({ x: player.x + Math.cos(player.rotation) * 180, y: player.y + Math.sin(player.rotation) * 180 });
  }

  private emitDiagnostics(forceChecksum = false): void {
    const diagnosticsStart = performance.now();
    const snapshot = this.runner.getSnapshot();
    const checksumDue = forceChecksum || snapshot.battleEnded || this.checksumTick < 0 || snapshot.tick - this.checksumTick >= 60;
    if (checksumDue) {
      this.cachedChecksum = checksumSnapshot(snapshot);
      this.checksumTick = snapshot.tick;
    }
    this.onDiagnostics({
      tick: snapshot.tick,
      checksum: this.cachedChecksum,
      battleEnded: snapshot.battleEnded,
      winningTeam: snapshot.winningTeam,
      result: snapshot.result,
      entities: snapshot.entities,
      obstacles: snapshot.obstacles,
      objective: snapshot.objective,
      stats: this.stats.snapshot(),
      achievements: this.achievements.listUnlocked().map((item) => item.name),
      replayFrames: this.replay.frameCount,
      replayCommands: this.replay.commandCount,
      replayStoredCommands: this.replay.storedCommandCount,
      replayCompressionRatio: this.replay.compressionRatio,
      recentSkills: [...this.recentSkills],
      recentArenaActivity: [...this.recentArenaActivity],
      recentAbilityRejection: this.recentAbilityRejection
        && snapshot.tick - this.recentAbilityRejection.tick <= 90
        ? { ...this.recentAbilityRejection }
        : null,
      playerEntityIds: [...this.playerEntityIds],
      simulationMetrics: snapshot.metrics,
      renderDiagnostics: { ...this.renderDiagnostics },
      audioDiagnostics: { ...this.audioDiagnostics },
      performance: { ...this.performance },
      teams: this.teamSummaries(snapshot),
      aiDecisions: this.detailedDiagnosticsEnabled ? this.ai.getDecisionDebug() : [],
      aiWorkload: this.ai.getWorkloadStats()
    });
    this.diagnosticsSampleMs = performance.now() - diagnosticsStart;
  }

  private captureTeamTotals(battle: BattleDefinition, snapshot: WorldSnapshot): void {
    this.teamTotals.clear();
    this.teamMaxHpTotals.clear();
    for (const participant of battle.participants) this.teamTotals.set(participant.team, (this.teamTotals.get(participant.team) ?? 0) + 1);
    for (const entity of snapshot.entities) this.teamMaxHpTotals.set(entity.team, (this.teamMaxHpTotals.get(entity.team) ?? 0) + entity.maxHp);
  }

  private teamSummaries(snapshot: WorldSnapshot): TeamSummary[] {
    const totals = new Map<number, TeamSummary>();
    for (const entity of snapshot.entities) {
      const current = totals.get(entity.team) ?? { team: entity.team, alive: 0, total: this.teamTotals.get(entity.team) ?? 0, hp: 0, maxHp: this.teamMaxHpTotals.get(entity.team) ?? 0 };
      current.alive += entity.hp > 0 ? 1 : 0;
      current.hp += Math.max(0, entity.hp);
      totals.set(entity.team, current);
    }
    for (const [team, total] of this.teamTotals) {
      if (!totals.has(team)) totals.set(team, { team, alive: 0, total, hp: 0, maxHp: this.teamMaxHpTotals.get(team) ?? 0 });
    }
    return [...totals.values()].sort((a, b) => a.team - b.team);
  }

  private appendRenderEvents(events: readonly SimulationEvent[]): void {
    const limit = 256;
    for (const event of events) {
      // Rejection feedback belongs to the HUD and should not consume renderer
      // presentation budget or reach particle presentation systems.
      if (event.type !== 'abilityRejected') this.pendingRenderEvents.push(event);
    }
    const overflow = this.pendingRenderEvents.length - limit;
    if (overflow > 0) this.pendingRenderEvents.splice(0, overflow);
  }

  private pruneRecentActivity(tick: number): void {
    this.lastActivityPruneTick = tick;
    const skillCutoff = tick - 180;
    let skillWrite = 0;
    for (const item of this.recentSkills) {
      if (item.tick < skillCutoff) continue;
      this.recentSkills[skillWrite] = item;
      skillWrite += 1;
    }
    this.recentSkills.length = skillWrite;
    if (this.recentSkills.length > 16) this.recentSkills.splice(0, this.recentSkills.length - 16);

    const arenaCutoff = tick - 240;
    let arenaWrite = 0;
    for (const item of this.recentArenaActivity) {
      if (item.tick < arenaCutoff) continue;
      this.recentArenaActivity[arenaWrite] = item;
      arenaWrite += 1;
    }
    this.recentArenaActivity.length = arenaWrite;
    if (this.recentArenaActivity.length > 12) this.recentArenaActivity.splice(0, this.recentArenaActivity.length - 12);
  }

  private createBattle(seed: number): BattleDefinition {
    const mode = getGameMode(this.setup.modeId);
    const participants: BattleParticipant[] = [];
    const addTeam = (
      fighterId: string,
      moduleIds: readonly string[],
      team: number,
      count: number,
      firstController: ControllerKind,
      statScale?: BattleParticipant['statScale']
    ) => {
      for (let index = 0; index < count; index += 1) {
        participants.push({
          fighterId,
          team,
          controller: index === 0 ? firstController : 'ai',
          loadout: { moduleIds: [...moduleIds] },
          ...(statScale ? { statScale } : {})
        });
      }
    };

    if (mode.id === 'duel') {
      addTeam(this.setup.fighterAId, this.setup.moduleIdsA, 1, 1, this.setup.controllerA);
      addTeam(this.setup.fighterBId, this.setup.moduleIdsB, 2, 1, this.setup.controllerB);
    } else if (mode.id === 'team-battle' || mode.id === 'mass-skirmish') {
      const minTeamSize = mode.id === 'mass-skirmish' ? 5 : 2;
      const maxPerTeam = Math.floor(mode.maxUnits / 2);
      addTeam(this.setup.fighterAId, this.setup.moduleIdsA, 1, Math.max(minTeamSize, Math.min(maxPerTeam, this.setup.teamSizeA)), this.setup.controllerA);
      addTeam(this.setup.fighterBId, this.setup.moduleIdsB, 2, Math.max(minTeamSize, Math.min(maxPerTeam, this.setup.teamSizeB)), this.setup.controllerB);
    } else if (mode.id === 'battle-royale') {
      const total = Math.max(3, Math.min(mode.maxUnits, this.setup.teamSizeA + this.setup.teamSizeB));
      for (let index = 0; index < total; index += 1) {
        participants.push({
          fighterId: index % 2 === 0 ? this.setup.fighterAId : this.setup.fighterBId,
          team: index + 1,
          controller: index === 0 ? this.setup.controllerA : 'ai',
          loadout: { moduleIds: [...(index % 2 === 0 ? this.setup.moduleIdsA : this.setup.moduleIdsB)] }
        });
      }
    } else if (mode.id === 'boss-raid') {
      addTeam(this.setup.fighterAId, this.setup.moduleIdsA, 1, Math.max(1, Math.min(6, this.setup.teamSizeA)), this.setup.controllerA);
      addTeam(this.setup.fighterBId, this.setup.moduleIdsB, mode.bossTeam ?? 2, 1, this.setup.controllerB, { hp: 4.5, radius: 1.65, mass: 3.2, damage: 1.65, speed: 0.86 });
    } else {
      addTeam(this.setup.fighterAId, this.setup.moduleIdsA, mode.survivorTeam ?? 1, 1, this.setup.controllerA, { hp: 1.35 });
      addTeam(this.setup.fighterBId, this.setup.moduleIdsB, 2, Math.max(2, Math.min(12, this.setup.teamSizeB)), this.setup.controllerB);
    }

    const playerTeam = participants.find((participant) => participant.controller === 'player')?.team ?? null;
    const scaledEnemyTeam = playerTeam ?? (participants.some((participant) => participant.team === 2) ? 2 : null);
    if (scaledEnemyTeam !== null) {
      const difficulty = getDifficultyPreset(this.setup.difficulty);
      for (const participant of participants) {
        if (participant.team !== scaledEnemyTeam) continue;
        const current = participant.statScale ?? {};
        participant.statScale = {
          hp: (current.hp ?? 1) * difficulty.enemyHpScale,
          radius: current.radius ?? 1,
          mass: current.mass ?? 1,
          damage: (current.damage ?? 1) * difficulty.enemyDamageScale,
          speed: (current.speed ?? 1) * difficulty.enemySpeedScale
        };
      }
    }

    return {
      seed: seed >>> 0,
      arenaId: this.setup.arenaId,
      modeId: this.setup.modeId,
      participants,
      rules: {
        friendlyFire: this.setup.friendlyFire,
        teamCollision: this.setup.teamCollision,
        teamCollisionScale: this.setup.teamCollision === 'soft' ? 0.24 : 1,
        maxBattleTicks: mode.id === 'mass-skirmish' ? 5400 : 9000
      }
    };
  }
}
