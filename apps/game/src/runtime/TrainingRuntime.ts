import { BattleAudioEngine, type AudioDiagnostics } from '@kinetic/audio';
import { PlayerController } from '@kinetic/controllers';
import type {
  AbilitySlot,
  BattleDefinition,
  BattleParticipant,
  SimulationCommand,
  SimulationEvent,
  Vec2,
  WorldSnapshot
} from '@kinetic/protocol';
import { PixiBattleRenderer, type RenderDiagnostics, type TrainingDebugOptions } from '@kinetic/renderer-pixi';
import { checksumSnapshot, LocalSimulationRunner, SIM_TICK_MS } from '@kinetic/simulation';
import type { PresentationSettings } from '@kinetic/visual-engine';

export type TrainingTargetPattern = 'stationary' | 'moving' | 'group-3' | 'group-5';
export type TrainingSpeed = 0.25 | 0.5 | 1;

export interface TrainingSetup {
  trainerFighterId: string;
  trainerModuleIds: string[];
  targetFighterId: string;
  targetPattern: TrainingTargetPattern;
  selectedSlot: AbilitySlot;
  seed: number;
}

export interface TrainingOptions {
  damageEnabled: boolean;
  cooldownsEnabled: boolean;
  invulnerableTargets: boolean;
  showRange: boolean;
  showHitboxes: boolean;
  showProjectilePaths: boolean;
  showDamageNumbers: boolean;
}

export interface TrainingDamageRecord {
  tick: number;
  targetId: number;
  amount: number;
  element: string;
  prevented: boolean;
  hpAfter: number;
}

export interface TrainingDiagnostics {
  tick: number;
  checksum: string;
  snapshot: WorldSnapshot;
  paused: boolean;
  speed: TrainingSpeed;
  recentEvents: SimulationEvent[];
  recentDamage: TrainingDamageRecord[];
  renderDiagnostics: RenderDiagnostics;
  audioDiagnostics: AudioDiagnostics;
  playerEntityId: number | null;
  targetEntityIds: number[];
}

export const DEFAULT_TRAINING_SETUP: TrainingSetup = {
  trainerFighterId: 'volt-striker',
  trainerModuleIds: [],
  targetFighterId: 'mech-bruiser',
  targetPattern: 'stationary',
  selectedSlot: 'basic',
  seed: 515151
};

export const DEFAULT_TRAINING_OPTIONS: TrainingOptions = {
  damageEnabled: true,
  cooldownsEnabled: false,
  invulnerableTargets: true,
  showRange: true,
  showHitboxes: false,
  showProjectilePaths: true,
  showDamageNumbers: true
};

const EMPTY_RENDER_DIAGNOSTICS: RenderDiagnostics = {
  lod: 'hero', fighterViews: 0, pooledFighterViews: 0, createdFighterViews: 0, reusedFighterViews: 0, particleScale: 1, activeParticles: 0, vfxQuality: 'high', groundMarks: 0, residualParticles: 0, weaponEffects: 0, projectileTrails: 0, qualityScale: 1, resolution: 1,
  devicePixelRatio: 1, renderScale: 1, cssWidth: 1, cssHeight: 1, pixelWidth: 1, pixelHeight: 1,
  orientation: 'landscape', resizeCount: 0, contextLost: false,
  renderTier: 'full', targetRenderFps: 60, presentationEvents: 0, projectileVisuals: 0
};

const EMPTY_AUDIO_DIAGNOSTICS: AudioDiagnostics = {
  eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: 22
};

export class TrainingRuntime {
  private runner!: LocalSimulationRunner;
  private readonly player = new PlayerController();
  private readonly renderer = new PixiBattleRenderer();
  private readonly audio = new BattleAudioEngine();
  private settings: PresentationSettings;
  private setup: TrainingSetup;
  private options: TrainingOptions;
  private paused = false;
  private systemSuspended = false;
  private active: boolean;
  private speed: TrainingSpeed = 1;
  private raf = 0;
  private lastTime = performance.now();
  private lastRenderAt = 0;
  private lastDiagnosticsAt = 0;
  private accumulator = 0;
  private pendingRenderEvents: SimulationEvent[] = [];
  private recentEvents: SimulationEvent[] = [];
  private recentDamage: TrainingDamageRecord[] = [];
  private renderDiagnostics: RenderDiagnostics = { ...EMPTY_RENDER_DIAGNOSTICS };
  private audioDiagnostics: AudioDiagnostics = { ...EMPTY_AUDIO_DIAGNOSTICS };
  private playerEntityId: number | null = null;
  private targetEntityIds: number[] = [];

  constructor(
    private host: HTMLElement,
    settings: PresentationSettings,
    private readonly onDiagnostics: (diagnostics: TrainingDiagnostics) => void,
    setup: TrainingSetup = DEFAULT_TRAINING_SETUP,
    options: TrainingOptions = DEFAULT_TRAINING_OPTIONS,
    initialActive = true
  ) {
    this.settings = { ...settings, cameraFollow: false };
    this.setup = { ...setup };
    this.options = { ...options };
    this.active = initialActive;
  }

  async start(): Promise<void> {
    this.runner = this.createRunner();
    await this.renderer.init(this.host, 'training-grid', this.settings);
    this.renderer.setSettings(this.settings);
    this.renderer.setActive(this.active);
    this.audio.setEnabled(this.settings.audio);
    this.audio.setVolume(this.settings.masterVolume);
    this.configureEntities();
    this.applyDebugOptions();
    this.lastTime = performance.now();
    this.renderCurrent(0);
    this.emitDiagnostics(true);
    this.raf = requestAnimationFrame(this.frame);
  }

  restart(setup: TrainingSetup = this.setup): void {
    this.audio.reset();
    this.setup = { ...setup, seed: setup.seed >>> 0 };
    this.runner = this.createRunner();
    this.player.reset();
    this.renderer.setArena('training-grid');
    this.renderer.reset();
    this.pendingRenderEvents = [];
    this.recentEvents = [];
    this.recentDamage = [];
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.configureEntities();
    this.applyDebugOptions();
    this.renderCurrent(0);
    this.emitDiagnostics(true);
  }

  setSettings(settings: PresentationSettings): void {
    this.settings = { ...settings, cameraFollow: false };
    this.renderer.setSettings(this.settings);
    this.audio.setEnabled(this.settings.audio);
    this.audio.setVolume(this.settings.masterVolume);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.player.setMovement({ x: 0, y: 0 });
    void this.audio.setPaused(this.paused || this.systemSuspended || !this.active);
    this.emitDiagnostics(true);
  }

  setSystemSuspended(suspended: boolean): void {
    if (this.systemSuspended === suspended) return;
    this.systemSuspended = suspended;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.player.setMovement({ x: 0, y: 0 });
    void this.audio.setPaused(this.paused || this.systemSuspended || !this.active);
    this.emitDiagnostics(true);
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.lastRenderAt = 0;
    this.player.setMovement({ x: 0, y: 0 });
    this.renderer.setActive(active);
    void this.audio.setPaused(this.paused || this.systemSuspended || !active);
    if (active) {
      this.renderCurrent(1);
      this.emitDiagnostics(true);
    }
  }

  attachHost(host: HTMLElement): void {
    this.host = host;
    this.renderer.attachHost(host);
    this.renderer.setActive(this.active);
  }

  refreshRendererLayout(): void {
    this.renderer.refreshLayout();
  }

  setSpeed(speed: TrainingSpeed): void {
    this.speed = speed;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.emitDiagnostics(true);
  }

  setOptions(options: TrainingOptions): void {
    this.options = { ...options };
    this.runner.setTrainingRules({
      enabled: true,
      damageEnabled: options.damageEnabled,
      cooldownsEnabled: options.cooldownsEnabled,
      invulnerableTeams: options.invulnerableTargets ? [2] : [],
      suppressVictory: true
    });
    this.applyDebugOptions();
    this.emitDiagnostics(true);
  }

  setSelectedSlot(slot: AbilitySlot): void {
    this.setup = { ...this.setup, selectedSlot: slot };
    this.applyDebugOptions();
    this.emitDiagnostics(true);
  }

  stepOneTick(): void {
    if (!this.paused) return;
    this.simulateOneTick();
    this.renderCurrent(1);
    this.emitDiagnostics(true);
  }

  setPlayerMovement(direction: Vec2): void {
    this.player.setMovement(direction);
  }

  setPlayerAimFromClient(clientX: number, clientY: number): void {
    if (this.playerEntityId === null) return;
    const self = this.runner.getSnapshot().entities.find((entity) => entity.id === this.playerEntityId);
    if (!self) return;
    const world = this.renderer.clientToWorld(clientX, clientY);
    this.renderer.setPlayerAimPoint(world);
    this.player.setAimAt(world, { x: world.x - self.x, y: world.y - self.y });
  }

  setPlayerMouseDriveFromClient(clientX: number, clientY: number): void {
    if (this.playerEntityId === null) return;
    const self = this.runner.getSnapshot().entities.find((entity) => entity.id === this.playerEntityId);
    if (!self) return;
    const world = this.renderer.clientToWorld(clientX, clientY);
    const delta = { x: world.x - self.x, y: world.y - self.y };
    const distance = Math.hypot(delta.x, delta.y);
    this.renderer.setPlayerAimPoint(world);
    this.player.setAimAt(world, delta);
    const deadzone = Math.max(18, self.radius * 0.55);
    if (distance <= deadzone) {
      this.player.setMovement({ x: 0, y: 0 });
      return;
    }
    const fullSpeedDistance = 240;
    const normalized = { x: delta.x / distance, y: delta.y / distance };
    const t = Math.max(0, Math.min(1, (distance - deadzone) / (fullSpeedDistance - deadzone)));
    const eased = t * t * (3 - 2 * t);
    this.player.setMovement({ x: normalized.x * eased, y: normalized.y * eased });
  }

  activateAbility(slot: AbilitySlot = this.setup.selectedSlot): void {
    this.player.activate(slot);
  }

  async enableAudio(): Promise<void> {
    await this.audio.enable();
    this.audio.setVolume(this.settings.masterVolume);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.audio.reset();
    this.player.reset();
    this.renderer.destroy();
    void this.audio.setPaused(true);
  }

  private readonly frame = (now: number) => {
    const frameDelta = Math.min(100, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    if (!this.active) {
      this.accumulator = 0;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const effectivelyPaused = this.paused || this.systemSuspended;
    if (!effectivelyPaused) {
      this.accumulator += frameDelta * this.speed;
      let steps = 0;
      while (this.accumulator >= SIM_TICK_MS && steps < 8) {
        this.simulateOneTick();
        this.accumulator -= SIM_TICK_MS;
        steps += 1;
      }
      if (steps === 8 && this.accumulator >= SIM_TICK_MS) this.accumulator = SIM_TICK_MS;
    }
    const renderInterval = 1000 / this.settings.targetRenderFps;
    if (this.lastRenderAt === 0 || now - this.lastRenderAt >= renderInterval - 1) {
      const alpha = effectivelyPaused ? 1 : Math.max(0, Math.min(1, this.accumulator / SIM_TICK_MS));
      this.renderCurrent(alpha, Math.max(renderInterval, now - this.lastRenderAt));
      this.lastRenderAt = now;
    }
    this.emitDiagnostics(false, now);
    this.raf = requestAnimationFrame(this.frame);
  };

  private simulateOneTick(): void {
    const before = this.runner.getSnapshot();
    const commands: SimulationCommand[] = [
      ...this.player.commandsForTick(before),
      ...this.targetCommands(before)
    ];
    const events = this.runner.step(commands);
    this.pendingRenderEvents.push(...events);
    this.recentEvents.push(...events);
    this.recentEvents = this.recentEvents.slice(-36);
    for (const event of events) {
      if (event.type !== 'damage') continue;
      this.recentDamage.push({
        tick: event.tick,
        targetId: event.targetId,
        amount: event.amount,
        element: event.element,
        prevented: event.prevented === true,
        hpAfter: event.hpAfter
      });
    }
    this.recentDamage = this.recentDamage.slice(-20);
    this.audioDiagnostics = this.audio.consume(events, before.entities.length, this.playerEntityId === null ? [] : [this.playerEntityId]);
  }

  private renderCurrent(alpha: number, dtMs = SIM_TICK_MS): void {
    const snapshot = this.runner.getSnapshot();
    this.renderDiagnostics = this.renderer.render(snapshot, alpha, this.pendingRenderEvents, dtMs);
    this.pendingRenderEvents = [];
  }

  private emitDiagnostics(force = false, now = performance.now()): void {
    if (!force && now - this.lastDiagnosticsAt < 100) return;
    this.lastDiagnosticsAt = now;
    const snapshot = this.runner.getSnapshot();
    this.onDiagnostics({
      tick: snapshot.tick,
      checksum: checksumSnapshot(snapshot),
      snapshot,
      paused: this.paused || this.systemSuspended || !this.active,
      speed: this.speed,
      recentEvents: [...this.recentEvents],
      recentDamage: [...this.recentDamage],
      renderDiagnostics: { ...this.renderDiagnostics },
      audioDiagnostics: { ...this.audioDiagnostics },
      playerEntityId: this.playerEntityId,
      targetEntityIds: [...this.targetEntityIds]
    });
  }

  private createRunner(): LocalSimulationRunner {
    const battle = this.createBattle();
    const runner = new LocalSimulationRunner(battle);
    runner.setTrainingRules({
      enabled: true,
      damageEnabled: this.options.damageEnabled,
      cooldownsEnabled: this.options.cooldownsEnabled,
      invulnerableTeams: this.options.invulnerableTargets ? [2] : [],
      suppressVictory: true
    });
    return runner;
  }

  private createBattle(): BattleDefinition {
    const participants: BattleParticipant[] = [
      {
        fighterId: this.setup.trainerFighterId,
        team: 1,
        controller: 'player',
        x: 245,
        y: 360,
        loadout: { moduleIds: [...this.setup.trainerModuleIds] }
      }
    ];
    const positions = targetPositions(this.setup.targetPattern);
    for (const position of positions) {
      participants.push({
        fighterId: this.setup.targetFighterId,
        team: 2,
        controller: 'replay',
        x: position.x,
        y: position.y,
        statScale: { hp: 2.5, mass: 1.35 }
      });
    }
    return {
      seed: this.setup.seed >>> 0,
      arenaId: 'training-grid',
      modeId: 'training',
      participants,
      rules: {
        friendlyFire: false,
        teamCollision: 'ghost',
        maxBattleTicks: 60 * 60 * 12,
        training: {
          enabled: true,
          damageEnabled: this.options.damageEnabled,
          cooldownsEnabled: this.options.cooldownsEnabled,
          invulnerableTeams: this.options.invulnerableTargets ? [2] : [],
          suppressVictory: true
        }
      }
    };
  }

  private configureEntities(): void {
    const snapshot = this.runner.getSnapshot();
    this.playerEntityId = snapshot.entities.find((entity) => entity.controller === 'player')?.id ?? null;
    this.targetEntityIds = snapshot.entities.filter((entity) => entity.team === 2).map((entity) => entity.id).sort((a, b) => a - b);
    this.player.setControlledEntities(this.playerEntityId === null ? [] : [this.playerEntityId]);
    this.renderer.setFocusEntity(null);
  }

  private applyDebugOptions(): void {
    const debug: Partial<TrainingDebugOptions> = {
      enabled: true,
      focusEntityId: this.playerEntityId,
      selectedSlot: this.setup.selectedSlot,
      showRange: this.options.showRange,
      showHitboxes: this.options.showHitboxes,
      showProjectilePaths: this.options.showProjectilePaths,
      showDamageNumbers: this.options.showDamageNumbers
    };
    this.renderer.setTrainingDebugOptions(debug);
  }

  private targetCommands(snapshot: WorldSnapshot): SimulationCommand[] {
    const commands: SimulationCommand[] = [];
    for (const target of snapshot.entities.filter((entity) => entity.team === 2).sort((a, b) => a.id - b.id)) {
      if (this.setup.targetPattern !== 'moving') {
        commands.push({ type: 'stop', entityId: target.id });
        continue;
      }
      const phase = (snapshot.tick + target.id * 31) % 300;
      const vertical = phase < 150 ? 1 : -1;
      const laneX = 735;
      const xCorrection = Math.max(-0.65, Math.min(0.65, (laneX - target.x) / 150));
      const yCorrection = target.y < 170 ? 0.8 : target.y > 550 ? -0.8 : vertical;
      commands.push({ type: 'move', entityId: target.id, direction: { x: xCorrection, y: yCorrection } });
    }
    return commands;
  }
}

function targetPositions(pattern: TrainingTargetPattern): Vec2[] {
  if (pattern === 'group-3') return [{ x: 700, y: 250 }, { x: 775, y: 360 }, { x: 700, y: 470 }];
  if (pattern === 'group-5') return [
    { x: 690, y: 210 }, { x: 790, y: 275 }, { x: 720, y: 360 }, { x: 790, y: 445 }, { x: 690, y: 510 }
  ];
  return [{ x: 745, y: 360 }];
}
