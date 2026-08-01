import {
  CONTENT_VERSION,
  getAbility,
  getAbilityActivationProfile,
  getArena,
  getElementMultiplier,
  getFighter,
  getGameMode,
  getPrimaryAttack,
  getProjectileSource,
  getStatus,
  type AbilityAction,
  type AbilityCondition,
  type AbilityDefinition,
  type ArenaObstacleDefinition,
  type ArenaZoneDefinition,
  type PrimaryAttackDefinition,
  type ProjectileSourceDefinition
} from '@kinetic/content';
import type {
  AbilitySlot,
  ActivateAbilityCommand,
  ActivatePrimaryAttackCommand,
  ArenaObstacleSnapshot,
  BattleDefinition,
  BattleEndReason,
  BattleResultSnapshot,
  BattleObjectiveSnapshot,
  BattleRules,
  BattleParticipant,
  DamageEvent,
  Element,
  EntityId,
  SimulationCommand,
  SimulationEvent,
  ProjectileSnapshot,
  SimulationMetricsSnapshot,
  TeamId,
  TrainingBattleRules,
  Vec2,
  WorldSnapshot
} from '@kinetic/protocol';
import { SeededRng } from './rng';
import { SpatialHashGrid } from './spatialHash';
import { World, type ActiveCastState, type ActiveWeaponAttackState, type ArmedAbilityState } from './world';

export const ENGINE_VERSION = '1.1.6-stage7.5';
export { CONTENT_VERSION };
export const SIM_TICK_RATE = 60;
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

const SOLAR_LASER_ABILITY_ID = 'solar-laser';
const SOLAR_LASER_EYE_CHARGE_TICKS = 30;
const SOLAR_LASER_LOCK_TICKS = 18;
const SOLAR_LASER_WARMUP_TICKS = SOLAR_LASER_EYE_CHARGE_TICKS + SOLAR_LASER_LOCK_TICKS;
const SOLAR_LASER_DAMAGE_INTERVAL_TICKS = 6;
const SOLAR_LASER_RAMP_STAGE_TICKS = 54;
const SOLAR_LASER_RANGE = 1080;
const SOLAR_LASER_HALF_WIDTH = 9;

export interface SimulationRunner {
  readonly tick: number;
  getSnapshot(): WorldSnapshot;
  getRuntimeSnapshot(): WorldSnapshot;
  step(commands: readonly SimulationCommand[]): SimulationEvent[];
}

interface CollisionContext {
  self: EntityId;
  target: EntityId;
  impact: number;
  normal: Vec2;
}

type TriggerContext = { self: EntityId; target: EntityId | null; impact: number; normal: Vec2; abilityId: string };

interface RuntimeObstacle {
  definition: ArenaObstacleDefinition;
  hp: number;
  alive: boolean;
}

interface RuntimeProjectile {
  id: number;
  sourceId: EntityId;
  team: TeamId;
  weapon: ProjectileSourceDefinition;
  targetId: EntityId | null;
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number;
  radius: number;
  remainingTicks: number;
  totalTicks: number;
  ageTicks: number;
  fuseRemainingTicks: number;
  alive: boolean;
}

interface PendingProjectileLaunch {
  launchTick: number;
  sequence: number;
  sourceId: EntityId;
  projectileId: string;
  direction: Vec2;
  targetId: EntityId | null;
}

interface EnvironmentModifiers {
  steering: number;
  damping: number | null;
  maxSpeed: number;
}

interface ExternalImpulseState extends Vec2 {
  retention: number;
  maxSpeed: number;
  minWallBounces: number;
  wallBounces: number;
  trailStrength: number;
}

interface ExternalImpulseOptions {
  retention?: number;
  maxSpeed?: number;
  minWallBounces?: number;
  trailStrength?: number;
}

type ResolvedBattleRules = Required<Pick<BattleRules, 'friendlyFire' | 'teamCollision' | 'teamCollisionScale' | 'maxBattleTicks'>>;

type ResolvedTrainingRules = {
  enabled: boolean;
  damageEnabled: boolean;
  cooldownsEnabled: boolean;
  invulnerableTeams: Set<TeamId>;
  suppressVictory: boolean;
};

function normalizeVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function tryGetPrimaryAttack(id: string): PrimaryAttackDefinition | null {
  try {
    return getPrimaryAttack(id);
  } catch {
    return null;
  }
}

function createSimulationMetrics(activeEntities = 0): SimulationMetricsSnapshot {
  return {
    activeEntities,
    commandsProcessed: 0,
    candidatePairs: 0,
    contactsResolved: 0,
    sameTeamContacts: 0,
    occupiedBroadphaseCells: 0,
    maxBroadphaseBucket: 0,
    projectileEntityChecks: 0,
    projectileObstacleChecks: 0,
    invalidNumericStates: 0
  };
}

export class LocalSimulationRunner implements SimulationRunner {
  private readonly rng: SeededRng;
  private readonly world: World;
  private readonly arena;
  private readonly mode;
  private readonly spatial: SpatialHashGrid;
  private readonly obstacles = new Map<string, RuntimeObstacle>();
  private readonly obstacleList: RuntimeObstacle[] = [];
  private readonly projectileCandidateIds: EntityId[] = [];
  private readonly hazardReadyTick = new Map<string, number>();
  // Reusable active-id buffers for loops that can kill entities mid-iteration.
  // Each call site owns a dedicated buffer so the reuse can never alias a
  // concurrently-iterated one; none of these loops nest inside each other.
  private readonly statusIdScratch: EntityId[] = [];
  private readonly zoneIdScratch: EntityId[] = [];
  private readonly obstacleIdScratch: EntityId[] = [];
  private readonly meleeIdScratch: EntityId[] = [];
  private readonly zoneCurrentScratch = new Set<string>();
  private readonly zoneById = new Map<string, ArenaZoneDefinition>();
  private readonly rules: ResolvedBattleRules;
  private trainingRules: ResolvedTrainingRules;
  private stepMetrics: SimulationMetricsSnapshot = createSimulationMetrics();
  private snapshotCache: WorldSnapshot | null = null;
  private readonly runtimeObstacleSnapshots: ArenaObstacleSnapshot[] = [];
  private readonly runtimeProjectileSnapshots: ProjectileSnapshot[] = [];
  private readonly runtimeObjectiveSnapshot: BattleObjectiveSnapshot = { kind: 'elimination', label: 'Last team standing', progress: 0, remainingTicks: null };
  private readonly runtimeMetricsSnapshot: SimulationMetricsSnapshot = createSimulationMetrics();
  private maxEntityRadius = 0;
  private tickValue = 0;
  private battleEndedValue = false;
  private winningTeamValue: TeamId | null = null;
  private resultValue: BattleResultSnapshot | null = null;
  private readonly activeCasts = new Map<EntityId, ActiveCastState>();
  private readonly armedAbilities = new Map<EntityId, Map<string, ArmedAbilityState>>();
  private readonly activeWeaponAttacks = new Map<EntityId, ActiveWeaponAttackState>();
  private readonly explicitFacingThisTick = new Set<EntityId>();
  // Locomotion and impact velocity must not share the same speed cap. Keeping
  // semantic external impulse separate prevents AI/Training `stop` commands
  // and normal max-speed clamping from erasing explosions before they move.
  private readonly externalImpulse = new Map<EntityId, ExternalImpulseState>();
  private readonly projectiles: RuntimeProjectile[] = [];
  private readonly pendingProjectileLaunches: PendingProjectileLaunch[] = [];
  private nextProjectileId = 1;
  private nextPendingProjectileSequence = 1;

  constructor(private readonly battle: BattleDefinition, maxEntities = 2048) {
    this.arena = getArena(battle.arenaId);
    this.mode = getGameMode(battle.modeId);
    if (!this.arena.allowedModes.includes(this.mode.id)) throw new Error(`${this.mode.name} is not allowed in ${this.arena.name}`);
    if (battle.participants.length < this.mode.minUnits || battle.participants.length > this.mode.maxUnits) {
      throw new Error(`${this.mode.name} requires ${this.mode.minUnits}-${this.mode.maxUnits} fighters`);
    }

    const largeBattle = battle.participants.length > 12;
    this.rules = {
      friendlyFire: battle.rules?.friendlyFire ?? false,
      teamCollision: battle.rules?.teamCollision ?? (largeBattle ? 'soft' : 'full'),
      teamCollisionScale: battle.rules?.teamCollisionScale ?? (largeBattle ? 0.24 : 0.5),
      maxBattleTicks: battle.rules?.maxBattleTicks ?? (this.mode.id === 'mass-skirmish' ? 5400 : 9000)
    };
    this.trainingRules = resolveTrainingRules(battle.rules?.training);
    this.rng = new SeededRng(battle.seed);
    this.world = new World(maxEntities);
    this.spatial = new SpatialHashGrid(this.arena.width, this.arena.height, this.arena.spatialCellSize);
    for (const definition of this.arena.obstacles) {
      const obstacle = { definition, hp: definition.destructible ? definition.maxHp : 0, alive: true };
      this.obstacles.set(definition.id, obstacle);
      this.obstacleList.push(obstacle);
    }
    this.obstacleList.sort((a, b) => a.definition.id.localeCompare(b.definition.id));
    for (const zone of this.arena.zones) this.zoneById.set(zone.id, zone);
    this.spawnInitialParticipants();
    for (const id of this.world.activeIdsView()) this.maxEntityRadius = Math.max(this.maxEntityRadius, this.world.radius[id] ?? 0);
  }

  get tick(): number {
    return this.tickValue;
  }

  get definition(): BattleDefinition {
    return this.battle;
  }

  get training(): Readonly<{ enabled: boolean; damageEnabled: boolean; cooldownsEnabled: boolean; invulnerableTeams: TeamId[]; suppressVictory: boolean }> {
    return {
      enabled: this.trainingRules.enabled,
      damageEnabled: this.trainingRules.damageEnabled,
      cooldownsEnabled: this.trainingRules.cooldownsEnabled,
      invulnerableTeams: [...this.trainingRules.invulnerableTeams].sort((a, b) => a - b),
      suppressVictory: this.trainingRules.suppressVictory
    };
  }

  setTrainingRules(patch: TrainingBattleRules): void {
    const current: TrainingBattleRules = {
      enabled: this.trainingRules.enabled,
      damageEnabled: this.trainingRules.damageEnabled,
      cooldownsEnabled: this.trainingRules.cooldownsEnabled,
      invulnerableTeams: [...this.trainingRules.invulnerableTeams],
      suppressVictory: this.trainingRules.suppressVictory
    };
    this.trainingRules = resolveTrainingRules({ ...current, ...patch });
    if (!this.trainingRules.cooldownsEnabled) this.world.clearAbilityCooldowns();
    this.snapshotCache = null;
  }

  /**
   * Allocation-stable snapshot for the live browser loop. The returned object
   * and all nested arrays/objects are reused and mutated on the next call.
   * Use getSnapshot() whenever immutable historical state is required.
   */
  getRuntimeSnapshot(): WorldSnapshot {
    this.updateRuntimeObstacleSnapshots();
    this.updateRuntimeProjectileSnapshots();
    this.updateRuntimeObjectiveSnapshot();
    this.copyRuntimeMetrics();
    return this.world.runtimeSnapshot(
      this.tickValue,
      this.battle.seed,
      this.arena.id,
      this.mode.id,
      this.battleEndedValue,
      this.winningTeamValue,
      this.resultValue,
      this.activeCasts,
      this.armedAbilities,
      this.activeWeaponAttacks,
      this.runtimeObstacleSnapshots,
      this.runtimeProjectileSnapshots,
      this.runtimeObjectiveSnapshot,
      this.runtimeMetricsSnapshot
    );
  }

  getSnapshot(): WorldSnapshot {
    if (this.snapshotCache) return this.snapshotCache;
    this.snapshotCache = this.world.snapshot(
      this.tickValue,
      this.battle.seed,
      this.arena.id,
      this.mode.id,
      this.battleEndedValue,
      this.winningTeamValue,
      this.resultValue,
      this.activeCasts,
      this.armedAbilities,
      this.activeWeaponAttacks,
      this.obstacleSnapshots(),
      this.projectileSnapshots(),
      this.objectiveSnapshot(),
      this.stepMetrics
    );
    return this.snapshotCache;
  }

  step(commands: readonly SimulationCommand[]): SimulationEvent[] {
    if (this.battleEndedValue) return [];
    this.snapshotCache = null;
    this.tickValue += 1;
    this.stepMetrics = createSimulationMetrics(this.world.activeCount());
    const events: SimulationEvent[] = [];
    this.world.copyPreviousTransforms();
    this.explicitFacingThisTick.clear();

    this.tickStatuses(events);
    this.tickWeaponAttacks(events);
    this.tickAbilityCasts(events);
    this.tickPendingProjectileLaunches(events);
    this.expireArmedAbilities();
    this.processCommands(commands, events);
    this.updateArenaZones(events);
    this.integrateMotion();
    this.rebuildSpatialIndex();
    this.updateProjectiles(events);
    this.resolveArenaBounds(events);
    this.resolveObstacleCollisions(events);
    this.resolveEntityCollisions(events);
    this.enforceSolarLaserLocks();
    this.recoverInvalidNumericState();
    this.checkVictory(events);
    return events;
  }

  private rebuildSpatialIndex(): void {
    this.spatial.rebuild(this.world.activeIdsView(), (id) => this.world.x[id] ?? 0, (id) => this.world.y[id] ?? 0);
    const diagnostics = this.spatial.getDiagnostics();
    this.stepMetrics.occupiedBroadphaseCells = diagnostics.occupiedCells;
    this.stepMetrics.maxBroadphaseBucket = diagnostics.maxBucketSize;
  }

  private spawnInitialParticipants(): void {
    const count = this.battle.participants.length;
    const zoneUsage = new Map<string, number>();
    for (let index = 0; index < count; index += 1) {
      const participant = this.battle.participants[index];
      if (!participant) continue;
      const fallback = this.defaultSpawn(participant, index, count, zoneUsage);
      this.world.spawn(participant, participant.x ?? fallback.x, participant.y ?? fallback.y, this.rng);
    }
  }

  private defaultSpawn(participant: BattleParticipant, index: number, count: number, zoneUsage: Map<string, number>): Vec2 {
    const requested = participant.spawnZoneId ? this.arena.spawnZones.find((zone) => zone.id === participant.spawnZoneId) : undefined;
    const teamZones = this.arena.spawnZones.filter((zone) => zone.team === participant.team);
    const genericZones = this.arena.spawnZones.filter((zone) => zone.team === undefined);
    const zone = requested ?? teamZones[index % Math.max(1, teamZones.length)] ?? genericZones[index % Math.max(1, genericZones.length)];
    if (zone) {
      const usage = zoneUsage.get(zone.id) ?? 0;
      zoneUsage.set(zone.id, usage + 1);
      const columns = Math.max(1, Math.floor(zone.width / 75));
      const row = Math.floor(usage / columns);
      const column = usage % columns;
      const jitterX = this.rng.range(-8, 8);
      const jitterY = this.rng.range(-8, 8);
      return {
        x: zone.x + Math.min(zone.width - 28, 28 + column * 70) + jitterX,
        y: zone.y + Math.min(zone.height - 28, 28 + row * 70) + jitterY
      };
    }

    const centerX = this.arena.width / 2;
    const centerY = this.arena.height / 2;
    const radius = Math.min(this.arena.width, this.arena.height) * 0.32;
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
  }

  private processCommands(commands: readonly SimulationCommand[], events: SimulationEvent[]): void {
    const ordered = [...commands].sort((a, b) => a.entityId - b.entityId || a.type.localeCompare(b.type));
    this.stepMetrics.commandsProcessed = ordered.length;
    for (const command of ordered) {
      if (!this.world.isAlive(command.entityId)) continue;
      if (command.type === 'move') {
        if (!this.isSolarLaserChanneling(command.entityId)) this.applyMove(command.entityId, command.direction, command.facing);
      } else if (command.type === 'stop') {
        if (this.isSolarLaserChanneling(command.entityId)) {
          this.lockSolarLaserCaster(command.entityId);
        } else {
          const impulse = this.externalImpulse.get(command.entityId);
          this.world.vx[command.entityId] = impulse?.x ?? 0;
          this.world.vy[command.entityId] = impulse?.y ?? 0;
        }
      } else if (command.type === 'activatePrimaryAttack') this.activatePrimaryAttack(command, events);
      else if (command.slot === 'basic') {
        // Replay/custom-content migration: Basic is now the fighter's authoritative primary attack.
        this.activatePrimaryAttack({ type: 'activatePrimaryAttack', entityId: command.entityId, ...(command.targetId !== undefined ? { targetId: command.targetId } : {}), ...(command.direction ? { direction: command.direction } : {}) }, events);
      } else this.activateAbility(command, events);
    }
  }

  private applyMove(id: EntityId, direction: Vec2, facing?: Vec2): void {
    if (facing) {
      const facingLength = Math.hypot(facing.x, facing.y);
      if (facingLength > 0.0001) {
        this.world.rotation[id] = Math.atan2(facing.y, facing.x);
        this.explicitFacingThisTick.add(id);
      }
    }
    const length = Math.hypot(direction.x, direction.y);
    if (length < 0.0001) return;
    const speedMultiplier = this.world.getSpeedMultiplier(id);
    const activeCast = this.activeCasts.get(id);
    const castAbility = activeCast ? getAbility(activeCast.abilityId) : null;
    const activePrimaryAttack = this.activeWeaponAttacks.get(id);
    const primaryMovementMultiplier = activePrimaryAttack && !getPrimaryAttack(activePrimaryAttack.weaponId).movementAllowed ? 0 : 1;
    const castMovementMultiplier = castAbility ? castAbility.castMovementMultiplier : 1;
    const environment = this.environmentModifiers(id);
    const acceleration = (this.world.moveAcceleration[id] ?? 0) * speedMultiplier * castMovementMultiplier * primaryMovementMultiplier * environment.steering;
    this.world.vx[id] = (this.world.vx[id] ?? 0) + (direction.x / length) * acceleration;
    this.world.vy[id] = (this.world.vy[id] ?? 0) + (direction.y / length) * acceleration;
  }

  private integrateMotion(): void {
    // Read-only over the active set (moves entities, never adds/removes them).
    for (const id of this.world.activeIdsView()) {
      const environment = this.environmentModifiers(id);
      const damping = environment.damping ?? (this.world.damping[id] ?? 1);
      const impulse = this.externalImpulse.get(id) ?? { x: 0, y: 0, retention: 0.92, maxSpeed: 48, minWallBounces: 0, wallBounces: 0, trailStrength: 0 };
      let locomotionX = ((this.world.vx[id] ?? 0) - impulse.x) * damping;
      let locomotionY = ((this.world.vy[id] ?? 0) - impulse.y) * damping;
      const locomotionSpeed = Math.hypot(locomotionX, locomotionY);
      const maxSpeed = (this.world.maxSpeed[id] ?? 1) * this.world.getSpeedMultiplier(id) * environment.maxSpeed;
      if (locomotionSpeed > maxSpeed) {
        const scale = maxSpeed / locomotionSpeed;
        locomotionX *= scale;
        locomotionY *= scale;
      }

      // External impacts decay independently and are intentionally not clamped to
      // walking speed. Ice preserves slides; water damps displacement faster.
      const environmentalRetention = environment.damping !== null
        ? environment.damping >= 0.999 ? 0.965 : 0.875
        : 0.92;
      const impulseRetention = Math.max(environmentalRetention, impulse.retention ?? 0.92);
      const impulseX = impulse.x * impulseRetention;
      const impulseY = impulse.y * impulseRetention;
      if (Math.hypot(impulseX, impulseY) > 0.035) {
        this.externalImpulse.set(id, { ...impulse, x: impulseX, y: impulseY });
      } else this.externalImpulse.delete(id);

      const vx = locomotionX + impulseX;
      const vy = locomotionY + impulseY;
      const speed = Math.hypot(vx, vy);
      this.world.vx[id] = vx;
      this.world.vy[id] = vy;
      this.world.x[id] = (this.world.x[id] ?? 0) + vx;
      this.world.y[id] = (this.world.y[id] ?? 0) + vy;
      // Movement no longer overrides explicit look direction every tick. Controllers
      // can face a target while orbiting or retreating. Velocity remains the
      // fallback for replay/legacy commands that do not provide `facing`.
      if (speed > 0.05 && !this.explicitFacingThisTick.has(id)) this.world.rotation[id] = Math.atan2(vy, vx);
    }
  }

  private updateArenaZones(events: SimulationEvent[]): void {
    if (this.arena.zones.length === 0) return;
    // Zone hazards can kill mid-loop; iterate a stable copy. Zone membership is
    // rebuilt into a reused Set and the containing zones are visited in arena
    // order, preserving the original event order without per-entity allocations.
    for (const id of this.world.copyActiveIdsInto(this.zoneIdScratch)) {
      const previous = this.world.getActiveZoneIds(id);
      const x = this.world.x[id] ?? 0;
      const y = this.world.y[id] ?? 0;
      const current = this.zoneCurrentScratch;
      current.clear();

      for (const zone of this.arena.zones) {
        if (!this.zoneContains(zone, x, y)) continue;
        current.add(zone.id);
        if (!previous.has(zone.id)) {
          events.push({ type: 'zoneEntered', tick: this.tickValue, entityId: id, zoneId: zone.id, kind: zone.kind, position: { x, y } });
        }
        this.applyZoneEffect(id, zone, events);
      }
      for (const zoneId of previous) {
        if (current.has(zoneId)) continue;
        const zone = this.zoneById.get(zoneId);
        if (zone) events.push({ type: 'zoneExited', tick: this.tickValue, entityId: id, zoneId, kind: zone.kind, position: { x, y } });
      }
      this.world.setActiveZones(id, current);
    }
  }

  private applyZoneEffect(id: EntityId, zone: ArenaZoneDefinition, events: SimulationEvent[]): void {
    if (zone.kind === 'wind') {
      const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
      this.world.vx[id] = (this.world.vx[id] ?? 0) + (zone.direction.x / length) * zone.strength;
      this.world.vy[id] = (this.world.vy[id] ?? 0) + (zone.direction.y / length) * zone.strength;
      return;
    }

    const key = `${id}:${zone.id}`;
    const readyTick = this.hazardReadyTick.get(key) ?? 0;
    if (this.tickValue < readyTick) return;
    this.hazardReadyTick.set(key, this.tickValue + zone.intervalTicks);

    if (zone.statusId) this.applyStatus(id, id, zone.statusId, Math.max(zone.intervalTicks * 2, 60), events);
    let damage = zone.damage;
    let force = 0;
    if (zone.kind === 'electric' && this.world.hasStatus(id, 'wet')) damage *= 1.75;
    if (zone.kind === 'electric' && zone.strength > 0) {
      const angle = ((id * 97 + this.tickValue * 13) % 360) * (Math.PI / 180);
      force = zone.strength;
      const invMass = 1 / this.world.getEffectiveMass(id);
      this.world.vx[id] = (this.world.vx[id] ?? 0) + Math.cos(angle) * force * invMass;
      this.world.vy[id] = (this.world.vy[id] ?? 0) + Math.sin(angle) * force * invMass;
    }
    if (damage > 0) this.dealDamage(null, id, damage, zone.kind === 'lava' ? 'fire' : zone.kind === 'electric' ? 'electric' : 'neutral', events);
    if (damage > 0 || force > 0) {
      events.push({
        type: 'hazardTriggered', tick: this.tickValue, entityId: id, zoneId: zone.id, kind: zone.kind,
        position: { x: this.world.x[id] ?? 0, y: this.world.y[id] ?? 0 }, damage, force
      });
    }
  }

  private environmentModifiers(id: EntityId): EnvironmentModifiers {
    const active = this.world.getActiveZoneIds(id);
    let steering = 1;
    let damping: number | null = null;
    let maxSpeed = 1;
    for (const zoneId of active) {
      const zone = this.zoneById.get(zoneId);
      if (!zone) continue;
      if (zone.kind === 'ice') {
        steering *= Math.max(0.25, 1 - zone.strength);
        damping = Math.max(damping ?? 0, 0.9992);
        maxSpeed *= 1.08;
      } else if (zone.kind === 'water') {
        steering *= Math.max(0.45, zone.strength);
        damping = Math.min(damping ?? 1, 0.988);
        maxSpeed *= 0.82;
      }
    }
    return { steering, damping, maxSpeed };
  }

  private resolveArenaBounds(events: SimulationEvent[]): void {
    for (const id of this.world.activeIdsView()) {
      const r = this.world.radius[id] ?? 0;
      const baseRestitution = this.world.restitution[id] ?? 1;
      let x = this.world.x[id] ?? 0;
      let y = this.world.y[id] ?? 0;
      let vx = this.world.vx[id] ?? 0;
      let vy = this.world.vy[id] ?? 0;
      const impulse = this.externalImpulse.get(id);
      let impulseX = impulse?.x ?? 0;
      let impulseY = impulse?.y ?? 0;
      let magnitude = 0;
      let hitWall = false;
      const preservingBounces = impulse !== undefined && impulse.wallBounces < impulse.minWallBounces;
      const restitution = preservingBounces ? Math.max(baseRestitution, 0.985) : baseRestitution;

      if (x - r < 0) {
        x = r; hitWall = true; magnitude = Math.max(magnitude, Math.abs(vx)); vx = Math.abs(vx) * restitution; impulseX = Math.abs(impulseX) * restitution;
      } else if (x + r > this.arena.width) {
        x = this.arena.width - r; hitWall = true; magnitude = Math.max(magnitude, Math.abs(vx)); vx = -Math.abs(vx) * restitution; impulseX = -Math.abs(impulseX) * restitution;
      }
      if (y - r < 0) {
        y = r; hitWall = true; magnitude = Math.max(magnitude, Math.abs(vy)); vy = Math.abs(vy) * restitution; impulseY = Math.abs(impulseY) * restitution;
      } else if (y + r > this.arena.height) {
        y = this.arena.height - r; hitWall = true; magnitude = Math.max(magnitude, Math.abs(vy)); vy = -Math.abs(vy) * restitution; impulseY = -Math.abs(impulseY) * restitution;
      }

      this.world.x[id] = x;
      this.world.y[id] = y;
      this.world.vx[id] = vx;
      this.world.vy[id] = vy;
      if (impulse) {
        const wallBounces = impulse.wallBounces + (hitWall ? 1 : 0);
        this.externalImpulse.set(id, {
          ...impulse,
          x: impulseX,
          y: impulseY,
          wallBounces,
          retention: wallBounces >= impulse.minWallBounces ? Math.min(impulse.retention, 0.92) : impulse.retention
        });
      }
      if (magnitude > 1.5) events.push({ type: 'wallImpact', tick: this.tickValue, entityId: id, position: { x, y }, magnitude });
    }
  }

  private resolveObstacleCollisions(events: SimulationEvent[]): void {
    for (const id of this.world.copyActiveIdsInto(this.obstacleIdScratch)) {
      for (const obstacle of this.obstacleList) {
        if (!obstacle.alive) continue;
        const contact = obstacle.definition.shape === 'circle'
          ? this.circleObstacleContact(id, obstacle.definition)
          : this.boxObstacleContact(id, obstacle.definition);
        if (!contact) continue;

        const { normal, overlap, position } = contact;
        this.world.x[id] = (this.world.x[id] ?? 0) + normal.x * overlap;
        this.world.y[id] = (this.world.y[id] ?? 0) + normal.y * overlap;
        const vx = this.world.vx[id] ?? 0;
        const vy = this.world.vy[id] ?? 0;
        const velocityInto = vx * normal.x + vy * normal.y;
        let magnitude = 0;
        if (velocityInto < 0) {
          magnitude = -velocityInto * this.world.getEffectiveMass(id);
          const restitution = Math.min(this.world.restitution[id] ?? 1, obstacle.definition.restitution);
          this.world.vx[id] = vx - (1 + restitution) * velocityInto * normal.x;
          this.world.vy[id] = vy - (1 + restitution) * velocityInto * normal.y;
          const impulse = this.externalImpulse.get(id);
          if (impulse) {
            const impulseInto = impulse.x * normal.x + impulse.y * normal.y;
            if (impulseInto < 0) {
              this.externalImpulse.set(id, {
                ...impulse,
                x: impulse.x - (1 + restitution) * impulseInto * normal.x,
                y: impulse.y - (1 + restitution) * impulseInto * normal.y
              });
            }
          }
        }
        if (magnitude <= 0.05) continue;
        events.push({ type: 'obstacleImpact', tick: this.tickValue, entityId: id, obstacleId: obstacle.definition.id, position, magnitude });
        if (obstacle.definition.contactDamage > 0 && magnitude > 2) {
          this.dealDamage(null, id, obstacle.definition.contactDamage * Math.min(2, magnitude / 6), 'neutral', events);
        }
        if (obstacle.definition.destructible && magnitude >= obstacle.definition.breakImpulseThreshold) {
          const amount = Math.max(0, (magnitude - obstacle.definition.breakImpulseThreshold) * obstacle.definition.impactDamageScale);
          obstacle.hp = Math.max(0, obstacle.hp - amount);
          events.push({ type: 'obstacleDamaged', tick: this.tickValue, sourceId: id, obstacleId: obstacle.definition.id, amount, hpAfter: obstacle.hp, position });
          if (obstacle.hp <= 0) {
            obstacle.alive = false;
            events.push({ type: 'obstacleDestroyed', tick: this.tickValue, sourceId: id, obstacleId: obstacle.definition.id, position });
          }
        }
      }
    }
  }

  private circleObstacleContact(id: EntityId, obstacle: ArenaObstacleDefinition): { normal: Vec2; overlap: number; position: Vec2 } | null {
    const dx = (this.world.x[id] ?? 0) - obstacle.x;
    const dy = (this.world.y[id] ?? 0) - obstacle.y;
    const combined = (this.world.radius[id] ?? 0) + obstacle.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= combined * combined) return null;
    const distance = Math.max(0.0001, Math.sqrt(distSq));
    const normal = distance <= 0.0001 ? { x: 1, y: 0 } : { x: dx / distance, y: dy / distance };
    return {
      normal,
      overlap: combined - distance,
      position: { x: obstacle.x + normal.x * obstacle.radius, y: obstacle.y + normal.y * obstacle.radius }
    };
  }

  private boxObstacleContact(id: EntityId, obstacle: ArenaObstacleDefinition): { normal: Vec2; overlap: number; position: Vec2 } | null {
    const x = this.world.x[id] ?? 0;
    const y = this.world.y[id] ?? 0;
    const r = this.world.radius[id] ?? 0;
    const halfW = obstacle.width / 2;
    const halfH = obstacle.height / 2;
    const minX = obstacle.x - halfW;
    const maxX = obstacle.x + halfW;
    const minY = obstacle.y - halfH;
    const maxY = obstacle.y + halfH;
    const closestX = Math.max(minX, Math.min(maxX, x));
    const closestY = Math.max(minY, Math.min(maxY, y));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) return null;

    if (distSq > 0.000001) {
      const distance = Math.sqrt(distSq);
      return { normal: { x: dx / distance, y: dy / distance }, overlap: r - distance, position: { x: closestX, y: closestY } };
    }

    let nearestValue = x - minX;
    let normal: Vec2 = { x: -1, y: 0 };
    let position: Vec2 = { x: minX, y };
    const right = maxX - x;
    if (right < nearestValue) { nearestValue = right; normal = { x: 1, y: 0 }; position = { x: maxX, y }; }
    const top = y - minY;
    if (top < nearestValue) { nearestValue = top; normal = { x: 0, y: -1 }; position = { x, y: minY }; }
    const bottom = maxY - y;
    if (bottom < nearestValue) { nearestValue = bottom; normal = { x: 0, y: 1 }; position = { x, y: maxY }; }
    return { normal, overlap: r + nearestValue, position };
  }

  private resolveEntityCollisions(events: SimulationEvent[]): void {
    this.spatial.forEachCandidatePair((a, b) => {
      this.stepMetrics.candidatePairs += 1;
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
      if (sameTeam && this.rules.teamCollision === 'ghost') return;
      this.stepMetrics.contactsResolved += 1;
      if (sameTeam) this.stepMetrics.sameTeamContacts += 1;
      const physicalScale = sameTeam && this.rules.teamCollision === 'soft' ? this.rules.teamCollisionScale : 1;
      const distance = Math.max(0.0001, Math.sqrt(distSq));
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = radiusSum - distance;
      const massA = this.world.getEffectiveMass(a);
      const massB = this.world.getEffectiveMass(b);
      const invA = 1 / massA;
      const invB = 1 / massB;
      const invTotal = invA + invB;

      const correction = (overlap / invTotal) * physicalScale;
      this.world.x[a] = ax - nx * correction * invA;
      this.world.y[a] = ay - ny * correction * invA;
      this.world.x[b] = bx + nx * correction * invB;
      this.world.y[b] = by + ny * correction * invB;

      const rvx = (this.world.vx[b] ?? 0) - (this.world.vx[a] ?? 0);
      const rvy = (this.world.vy[b] ?? 0) - (this.world.vy[a] ?? 0);
      const velAlongNormal = rvx * nx + rvy * ny;
      const relativeSpeed = Math.hypot(rvx, rvy);
      const closingSpeed = Math.max(0, -velAlongNormal);
      let impulseMagnitude = 0;
      if (velAlongNormal < 0) {
        const restitution = Math.min(this.world.restitution[a] ?? 1, this.world.restitution[b] ?? 1);
        impulseMagnitude = ((-(1 + restitution) * velAlongNormal) / invTotal) * physicalScale;
        const ix = impulseMagnitude * nx;
        const iy = impulseMagnitude * ny;
        this.world.vx[a] = (this.world.vx[a] ?? 0) - ix * invA;
        this.world.vy[a] = (this.world.vy[a] ?? 0) - iy * invA;
        this.world.vx[b] = (this.world.vx[b] ?? 0) + ix * invB;
        this.world.vy[b] = (this.world.vy[b] ?? 0) + iy * invB;
      }

      const magnitude = Math.max(impulseMagnitude, closingSpeed);
      const position = { x: (this.world.x[a]! + this.world.x[b]!) / 2, y: (this.world.y[a]! + this.world.y[b]!) / 2 };
      if (magnitude > 0.05) events.push({ type: 'impact', tick: this.tickValue, a, b, position, magnitude, relativeSpeed });

      // Contact always transfers momentum, but it never causes health damage by itself.
      // Damage is only produced by an explicitly armed collision ability or another
      // declared gameplay source such as a projectile, blast, weapon, or hazard.
      const hostileContact = !sameTeam || this.rules.friendlyFire;
      if (hostileContact && magnitude > 0.05 && this.world.isAlive(a) && this.world.isAlive(b)) {
        this.triggerCollisionAbilities({ self: a, target: b, impact: magnitude, normal: { x: nx, y: ny } }, events);
        this.triggerCollisionAbilities({ self: b, target: a, impact: magnitude, normal: { x: -nx, y: -ny } }, events);
      }
    });
  }

  private activatePrimaryAttack(command: ActivatePrimaryAttackCommand, events: SimulationEvent[]): void {
    if (this.activeCasts.has(command.entityId) || this.activeWeaponAttacks.has(command.entityId)) return;
    const fighter = getFighter(this.world.getFighterId(command.entityId));
    const attack = getPrimaryAttack(fighter.primaryAttackId);
    if (this.trainingRules.cooldownsEnabled && !this.world.isPrimaryAttackReady(command.entityId, attack.id, this.tickValue)) return;
    const target = command.targetId !== undefined && this.world.isAlive(command.targetId) ? command.targetId : null;
    const direction = this.resolveAbilityDirection(command.entityId, target, command.direction);
    if (!this.primaryAttackIsValid(command.entityId, attack, target, direction)) return;
    if (this.trainingRules.cooldownsEnabled) this.world.setPrimaryAttackCooldown(command.entityId, attack.id, this.tickValue + attack.cooldownTicks);
    const position = { x: this.world.x[command.entityId] ?? 0, y: this.world.y[command.entityId] ?? 0 };
    const windupTicks = Math.max(0, attack.windupTicks);
    this.activeWeaponAttacks.set(command.entityId, {
      weaponId: attack.id,
      category: attack.behavior,
      style: attack.style,
      phase: windupTicks > 0 ? 'windup' : 'active',
      targetId: target,
      direction: { ...direction },
      remainingTicks: windupTicks > 0 ? windupTicks : this.primaryActiveTicks(attack),
      totalTicks: windupTicks > 0 ? windupTicks : this.primaryActiveTicks(attack),
      executed: false,
      shotsFired: 0,
      hitTargetIds: new Set()
    });
    events.push({ type: 'weaponAttackStarted', tick: this.tickValue, entityId: command.entityId, weaponId: attack.id, category: attack.behavior, position, direction, windupTicks });
  }

  private primaryAttackIsValid(self: EntityId, attack: PrimaryAttackDefinition, target: EntityId | null, direction: Vec2): boolean {
    const areaBehavior = ['spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior);
    if (!areaBehavior && target === null) return false;
    if (target === null) return true;
    if (!this.world.isAlive(target) || this.world.getTeam(target) === this.world.getTeam(self)) return false;
    const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
    const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
    const distance = Math.hypot(dx, dy);
    const effectiveMaximum = attack.behavior === 'melee' || attack.behavior === 'spin' || attack.behavior === 'continuous' || attack.behavior === 'orbit' || attack.behavior === 'slam'
      ? (this.world.radius[self] ?? 0) + attack.range + (this.world.radius[target] ?? 0)
      : attack.range;
    if (distance < attack.minRange || distance > effectiveMaximum) return false;
    if (['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior) && !this.hasLineOfSight(self, target)) return false;
    if (!areaBehavior && attack.attackAngleDegrees < 320) {
      const length = distance || 1;
      const dot = Math.max(-1, Math.min(1, direction.x * (dx / length) + direction.y * (dy / length)));
      const tolerance = Math.max(18, attack.attackAngleDegrees / 2 + 35) * Math.PI / 180;
      if (Math.acos(dot) > tolerance) return false;
    }
    return true;
  }

  private primaryActiveTicks(attack: PrimaryAttackDefinition): number {
    const burstTicks = attack.behavior === 'ranged' || attack.behavior === 'automatic' || attack.behavior === 'beam'
      ? Math.max(1, ((attack.burstCount ?? 1) - 1) * Math.max(1, attack.burstIntervalTicks ?? 1) + 1)
      : 1;
    return Math.max(1, attack.activeTicks, burstTicks);
  }

  private activateAbility(command: ActivateAbilityCommand, events: SimulationEvent[]): void {
    if (this.activeCasts.has(command.entityId) || this.activeWeaponAttacks.has(command.entityId)) return;
    const fighter = getFighter(this.world.getFighterId(command.entityId));
    const abilityId = fighter.abilitySlots[command.slot];
    if (!abilityId) return;
    const ability = getAbility(abilityId);
    if (this.trainingRules.cooldownsEnabled && !this.world.isAbilityReady(command.entityId, ability.id, this.tickValue)) return;

    const target = command.targetId !== undefined && this.world.isAlive(command.targetId) ? command.targetId : null;
    const direction = this.resolveAbilityDirection(command.entityId, target, command.direction);
    if (!this.activationIsValid(command.entityId, ability, target, direction)) return;

    const castTicks = ability.castTicks;
    const cooldownTicks = ability.cooldownTicks;
    if (this.trainingRules.cooldownsEnabled) this.world.setAbilityCooldown(command.entityId, ability.id, this.tickValue + cooldownTicks);
    events.push({
      type: 'abilityActivated', tick: this.tickValue, entityId: command.entityId, abilityId: ability.id, slot: command.slot,
      position: { x: this.world.x[command.entityId] ?? 0, y: this.world.y[command.entityId] ?? 0 }, direction, castTicks
    });
    if (castTicks <= 0) {
      this.resolveActivatedAbility(command.entityId, ability, command.slot, target, direction, events);
      return;
    }

    this.activeCasts.set(command.entityId, {
      abilityId: ability.id,
      slot: command.slot,
      targetId: target,
      direction,
      remainingTicks: castTicks,
      totalTicks: castTicks,
      anchorX: this.world.x[command.entityId] ?? 0,
      anchorY: this.world.y[command.entityId] ?? 0
    });
  }

  private tickAbilityCasts(events: SimulationEvent[]): void {
    const ids = [...this.activeCasts.keys()].sort((a, b) => a - b);
    for (const entityId of ids) {
      const cast = this.activeCasts.get(entityId);
      if (!cast) continue;
      if (!this.world.isAlive(entityId)) {
        this.activeCasts.delete(entityId);
        continue;
      }

      if (cast.abilityId === SOLAR_LASER_ABILITY_ID) {
        this.tickSolarLaserCast(entityId, cast, events);
      }

      cast.remainingTicks -= 1;
      if (cast.remainingTicks > 0) continue;
      this.activeCasts.delete(entityId);
      const ability = getAbility(cast.abilityId);
      const target = cast.targetId !== null && this.world.isAlive(cast.targetId) ? cast.targetId : null;
      this.resolveActivatedAbility(entityId, ability, cast.slot, target, cast.direction, events);
    }
  }

  private tickSolarLaserCast(entityId: EntityId, cast: ActiveCastState, events: SimulationEvent[]): void {
    let targetId = cast.targetId;
    if (targetId === null || !this.world.isAlive(targetId) || this.world.getTeam(targetId) === this.world.getTeam(entityId)) {
      targetId = this.hostileTargetsByDistance(entityId)[0] ?? null;
      cast.targetId = targetId;
    }

    if (targetId !== null) {
      const dx = (this.world.x[targetId] ?? 0) - (this.world.x[entityId] ?? 0);
      const dy = (this.world.y[targetId] ?? 0) - (this.world.y[entityId] ?? 0);
      const distance = Math.hypot(dx, dy);
      if (distance > 0.0001) {
        cast.direction = { x: dx / distance, y: dy / distance };
        this.world.rotation[entityId] = Math.atan2(cast.direction.y, cast.direction.x);
      }

      const elapsedTicks = cast.totalTicks - cast.remainingTicks;
      const beamTicks = elapsedTicks - SOLAR_LASER_WARMUP_TICKS;
      const beamActive = beamTicks >= 0;
      const damagePulse = beamActive && beamTicks % SOLAR_LASER_DAMAGE_INTERVAL_TICKS === 0;
      if (damagePulse && this.solarLaserHitsTarget(entityId, targetId, cast.direction)) {
        const rampStage = beamTicks < SOLAR_LASER_RAMP_STAGE_TICKS
          ? 0
          : beamTicks < SOLAR_LASER_RAMP_STAGE_TICKS * 2
            ? 1
            : 2;
        const damage = rampStage === 0 ? 2.2 : rampStage === 1 ? 3.5 : 5.2;
        this.dealDamage(entityId, targetId, damage, 'fire', events);
      }
    }

    this.lockSolarLaserCaster(entityId);
  }

  private isSolarLaserChanneling(entityId: EntityId): boolean {
    return this.activeCasts.get(entityId)?.abilityId === SOLAR_LASER_ABILITY_ID;
  }

  private solarLaserHitsTarget(entityId: EntityId, targetId: EntityId, direction: Vec2): boolean {
    if (!this.world.isAlive(entityId) || !this.world.isAlive(targetId)) return false;
    if (!this.hasLineOfSight(entityId, targetId)) return false;

    const originX = this.world.x[entityId] ?? 0;
    const originY = this.world.y[entityId] ?? 0;
    const targetX = this.world.x[targetId] ?? 0;
    const targetY = this.world.y[targetId] ?? 0;
    const beamDirection = normalizeVector(direction);
    const offsetX = targetX - originX;
    const offsetY = targetY - originY;
    const projection = offsetX * beamDirection.x + offsetY * beamDirection.y;
    const targetRadius = this.world.radius[targetId] ?? 0;

    if (projection < -targetRadius || projection > SOLAR_LASER_RANGE + targetRadius) return false;

    const closestX = originX + beamDirection.x * Math.max(0, projection);
    const closestY = originY + beamDirection.y * Math.max(0, projection);
    const perpendicularX = targetX - closestX;
    const perpendicularY = targetY - closestY;
    const hitRadius = targetRadius + SOLAR_LASER_HALF_WIDTH;
    return perpendicularX * perpendicularX + perpendicularY * perpendicularY <= hitRadius * hitRadius;
  }

  private lockSolarLaserCaster(entityId: EntityId): void {
    const cast = this.activeCasts.get(entityId);
    if (!cast || cast.abilityId !== SOLAR_LASER_ABILITY_ID) return;
    this.world.x[entityId] = cast.anchorX;
    this.world.y[entityId] = cast.anchorY;
    this.world.prevX[entityId] = cast.anchorX;
    this.world.prevY[entityId] = cast.anchorY;
    this.world.vx[entityId] = 0;
    this.world.vy[entityId] = 0;
    if (cast.targetId !== null && this.world.isAlive(cast.targetId)) {
      const dx = (this.world.x[cast.targetId] ?? 0) - cast.anchorX;
      const dy = (this.world.y[cast.targetId] ?? 0) - cast.anchorY;
      if (Math.hypot(dx, dy) > 0.0001) {
        cast.direction = normalizeVector({ x: dx, y: dy });
        this.world.rotation[entityId] = Math.atan2(cast.direction.y, cast.direction.x);
      }
    }
    this.externalImpulse.delete(entityId);
  }

  private enforceSolarLaserLocks(): void {
    for (const entityId of this.activeCasts.keys()) {
      if (this.isSolarLaserChanneling(entityId)) this.lockSolarLaserCaster(entityId);
    }
  }

  private resolveActivatedAbility(entityId: EntityId, ability: AbilityDefinition, slot: AbilitySlot, target: EntityId | null, direction: Vec2, events: SimulationEvent[]): void {
    if (!this.world.isAlive(entityId)) return;
    const hasCollisionTrigger = ability.triggers.some((trigger) => trigger.event === 'ON_COLLISION');
    this.executeTriggers(ability, 'ON_ACTIVATE', { self: entityId, target, impact: 0, normal: direction, abilityId: ability.id }, events);

    if (hasCollisionTrigger) {
      this.armCollisionAbility(entityId, ability);
      return;
    }

    events.push({
      type: 'abilityResolved', tick: this.tickValue, entityId, abilityId: ability.id, slot,
      position: { x: this.world.x[entityId] ?? 0, y: this.world.y[entityId] ?? 0 }, direction
    });
  }

  private armCollisionAbility(entityId: EntityId, ability: AbilityDefinition): void {
    const activation = getAbilityActivationProfile(ability, this.world.getFighterId(entityId));
    if (activation.collisionWindowTicks <= 0) return;
    const armed = this.armedAbilities.get(entityId) ?? new Map<string, ArmedAbilityState>();
    armed.set(ability.id, {
      abilityId: ability.id,
      expiresTick: this.tickValue + activation.collisionWindowTicks,
      totalTicks: activation.collisionWindowTicks
    });
    this.armedAbilities.set(entityId, armed);
  }

  private expireArmedAbilities(): void {
    for (const [entityId, armed] of this.armedAbilities) {
      if (!this.world.isAlive(entityId)) {
        this.armedAbilities.delete(entityId);
        continue;
      }
      for (const [abilityId, state] of armed) if (state.expiresTick <= this.tickValue) armed.delete(abilityId);
      if (armed.size === 0) this.armedAbilities.delete(entityId);
    }
  }

  private triggerCollisionAbilities(context: CollisionContext, events: SimulationEvent[]): void {
    const armed = this.armedAbilities.get(context.self);
    if (!armed || armed.size === 0) return;
    const fighter = getFighter(this.world.getFighterId(context.self));
    const slotByAbility = new Map<string, AbilitySlot>();
    for (const slot of ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'] as AbilitySlot[]) {
      const abilityId = fighter.abilitySlots[slot];
      if (abilityId) slotByAbility.set(abilityId, slot);
    }

    for (const abilityId of [...armed.keys()].sort()) {
      const state = armed.get(abilityId);
      if (!state || state.expiresTick <= this.tickValue) continue;
      const slot = slotByAbility.get(abilityId);
      if (!slot) continue;
      const ability = getAbility(abilityId);
      const triggerContext: TriggerContext = { ...context, abilityId: ability.id };
      const fired = this.executeTriggers(ability, 'ON_COLLISION', triggerContext, events);
      if (!fired) continue;
      armed.delete(abilityId);
      const position = { x: this.world.x[context.self] ?? 0, y: this.world.y[context.self] ?? 0 };
      events.push({ type: 'abilityResolved', tick: this.tickValue, entityId: context.self, abilityId: ability.id, slot, position, direction: context.normal });
    }
    if (armed.size === 0) this.armedAbilities.delete(context.self);
  }

  private activationIsValid(self: EntityId, ability: AbilityDefinition, target: EntityId | null, direction: Vec2): boolean {
    const activation = getAbilityActivationProfile(ability, this.world.getFighterId(self));
    if (activation.targeting !== 'self' && target === null && activation.targeting !== 'direction') return false;

    if (target !== null) {
      if (!this.world.isAlive(target) || this.world.getTeam(target) === this.world.getTeam(self)) return false;
      const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
      const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
      const distance = Math.hypot(dx, dy);
      if (distance < activation.minRange || distance > activation.maxRange) return false;
      if (activation.requiresLineOfSight && !this.hasLineOfSight(self, target)) return false;
      if (activation.aimToleranceDegrees < 180) {
        const length = distance || 1;
        const dot = Math.max(-1, Math.min(1, direction.x * (dx / length) + direction.y * (dy / length)));
        const angle = Math.acos(dot) * 180 / Math.PI;
        if (angle > activation.aimToleranceDegrees) return false;
      }
    }

    if (activation.targeting === 'area' && activation.minimumTargets > 0) {
      const nearby = this.world.activeIds().filter((id) => {
        if (id === self || this.world.getTeam(id) === this.world.getTeam(self)) return false;
        const dx = (this.world.x[id] ?? 0) - (this.world.x[self] ?? 0);
        const dy = (this.world.y[id] ?? 0) - (this.world.y[self] ?? 0);
        return dx * dx + dy * dy <= activation.maxRange * activation.maxRange;
      }).length;
      if (nearby < activation.minimumTargets) return false;
    }
    return true;
  }

  private hasLineOfSight(self: EntityId, target: EntityId): boolean {
    const ax = this.world.x[self] ?? 0;
    const ay = this.world.y[self] ?? 0;
    const bx = this.world.x[target] ?? 0;
    const by = this.world.y[target] ?? 0;
    for (const obstacle of this.obstacleList) {
      if (!obstacle.alive) continue;
      const definition = obstacle.definition;
      if (definition.shape === 'circle') {
        if (segmentIntersectsCircle(ax, ay, bx, by, definition.x, definition.y, definition.radius)) return false;
      } else if (segmentIntersectsBox(ax, ay, bx, by, definition.x - definition.width / 2, definition.y - definition.height / 2, definition.width, definition.height)) {
        return false;
      }
    }
    return true;
  }

  private executeTriggers(ability: AbilityDefinition, event: 'ON_ACTIVATE' | 'ON_COLLISION' | 'ON_HEALTH_BELOW', context: TriggerContext, events: SimulationEvent[]): boolean {
    let fired = false;
    for (const trigger of ability.triggers) {
      if (trigger.event !== event) continue;
      if (!trigger.conditions.every((condition) => this.conditionPasses(condition, context))) continue;
      fired = true;
      for (const action of trigger.actions) this.executeAction(action, context, events);
    }
    return fired;
  }

  private conditionPasses(condition: AbilityCondition, context: { self: EntityId; target: EntityId | null; impact: number }): boolean {
    if (condition.type === 'IMPACT_ABOVE') return context.impact >= condition.value;
    if (condition.type === 'SELF_HAS_STATUS') return this.world.hasStatus(context.self, condition.statusId);
    return (this.world.hp[context.self] ?? 0) / Math.max(1, this.world.maxHp[context.self] ?? 1) <= condition.ratio;
  }

  private executeAction(action: AbilityAction, context: TriggerContext, events: SimulationEvent[]): void {
    const { self, target } = context;
    if (!this.world.isAlive(self)) return;

    switch (action.type) {
      case 'APPLY_IMPULSE_SELF': {
        const length = Math.hypot(context.normal.x, context.normal.y) || 1;
        this.addExternalImpulse(self, (context.normal.x / length) * action.magnitude, (context.normal.y / length) * action.magnitude);
        break;
      }
      case 'DEAL_DAMAGE_TARGET':
        if (target !== null) this.dealDamage(self, target, action.amount, action.element, events);
        break;
      case 'APPLY_STATUS_SELF':
        this.applyStatus(self, self, action.statusId, action.durationTicks, events);
        break;
      case 'APPLY_STATUS_TARGET':
        if (target !== null) this.applyStatus(self, target, action.statusId, action.durationTicks, events);
        break;
      case 'REMOVE_STATUS_SELF':
        this.world.removeStatus(self, action.statusId);
        break;
      case 'APPLY_KNOCKBACK_TARGET':
        if (target !== null && this.world.isAlive(target)) this.applyKnockback(self, target, action.magnitude, events, 'ability');
        break;
      case 'RADIAL_IMPULSE': {
        const sign = action.direction === 'pull' ? -1 : 1;
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => this.applyKnockback(self, other, action.magnitude * sign, events, 'ability'));
        break;
      }
      case 'RADIAL_DAMAGE':
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => this.dealDamage(self, other, action.amount, action.element, events));
        break;
      case 'DIRECTIONAL_DAMAGE':
        this.forEachInCone(self, action.range, action.arcDegrees, action.enemiesOnly, context.normal, (other) => {
          this.dealDamage(self, other, action.amount, action.element, events);
          if (action.knockback > 0 && this.world.isAlive(other)) this.applyKnockback(self, other, action.knockback, events, 'ability');
        });
        break;
      case 'RADIAL_STATUS':
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => this.applyStatus(self, other, action.statusId, action.durationTicks, events));
        break;
      case 'EXPLODE': {
        const position = { x: this.world.x[self] ?? 0, y: this.world.y[self] ?? 0 };
        this.forEachInRadius(self, action.radius, action.enemiesOnly, (other) => {
          if (action.damage > 0) this.dealDamage(self, other, action.damage, action.element, events);
          if (action.impulse > 0 && this.world.isAlive(other)) this.applyKnockback(self, other, this.damageScaledImpulse(action.impulse, action.damage), events, 'explosion', this.explosionImpulseOptions(action.damage, context.abilityId));
        });
        events.push({
          type: 'blast', tick: this.tickValue, sourceId: self, abilityId: context.abilityId, kind: action.kind, position,
          radius: action.radius, force: this.damageScaledImpulse(action.impulse, action.damage), damage: action.damage, element: action.element
        });
        break;
      }
      case 'EXPLODE_AT_TARGET': {
        if (target === null || !this.world.isAlive(target)) break;
        const position = { x: this.world.x[target] ?? 0, y: this.world.y[target] ?? 0 };
        this.forEachAroundPoint(self, position, action.radius, action.enemiesOnly, (other) => {
          if (action.damage > 0) this.dealDamage(self, other, action.damage, action.element, events);
          if (action.impulse > 0 && this.world.isAlive(other)) {
            const fallback = {
              x: (this.world.x[other] ?? 0) - (this.world.x[self] ?? 0),
              y: (this.world.y[other] ?? 0) - (this.world.y[self] ?? 0)
            };
            this.applyKnockbackFromPoint(self, position, other, this.damageScaledImpulse(action.impulse, action.damage), events, 'explosion', fallback, this.explosionImpulseOptions(action.damage, context.abilityId));
          }
        });
        events.push({
          type: 'blast', tick: this.tickValue, sourceId: self, abilityId: context.abilityId, kind: action.kind, position,
          radius: action.radius, force: this.damageScaledImpulse(action.impulse, action.damage), damage: action.damage, element: action.element
        });
        break;
      }
      case 'LAUNCH_PROJECTILES': {
        const projectile = getProjectileSource(action.projectileId);
        const candidates = this.hostileTargetsByDistance(self);
        const selectedTarget = target !== null && this.world.isAlive(target) && this.world.getTeam(target) !== this.world.getTeam(self)
          ? target
          : null;
        const baseDirection = normalizeVector(context.normal);
        const count = Math.max(1, action.count);
        const intervalTicks = Math.max(0, action.intervalTicks ?? 0);
        for (let index = 0; index < count; index += 1) {
          const targetId = action.targetMode === 'selected'
            ? selectedTarget
            : action.targetMode === 'nearest'
              ? (selectedTarget ?? candidates[0] ?? null)
              : (candidates.length > 0 ? candidates[index % candidates.length] ?? null : selectedTarget);
          let direction = baseDirection;
          if (action.pattern === 'radial') {
            const angle = Math.atan2(baseDirection.y, baseDirection.x) + (index / count) * Math.PI * 2;
            direction = { x: Math.cos(angle), y: Math.sin(angle) };
          } else if (action.pattern === 'fan' && count > 1) {
            const spread = action.spreadDegrees * Math.PI / 180;
            const angle = Math.atan2(baseDirection.y, baseDirection.x) + ((index / (count - 1)) - 0.5) * spread;
            direction = { x: Math.cos(angle), y: Math.sin(angle) };
          } else if (targetId !== null) {
            direction = normalizeVector({
              x: (this.world.x[targetId] ?? 0) - (this.world.x[self] ?? 0),
              y: (this.world.y[targetId] ?? 0) - (this.world.y[self] ?? 0)
            });
          }

          const delayTicks = index * intervalTicks;
          if (delayTicks === 0) {
            this.spawnProjectile(self, projectile, direction, events, 0, 1, targetId);
          } else {
            this.pendingProjectileLaunches.push({
              launchTick: this.tickValue + delayTicks,
              sequence: this.nextPendingProjectileSequence++,
              sourceId: self,
              projectileId: action.projectileId,
              direction,
              targetId
            });
          }
        }
        break;
      }
      case 'USE_WEAPON':
        // Deprecated. Skills cannot execute the fighter's primary attack in Stage 7.2.
        break;
      case 'HEAL_SELF':
        this.world.hp[self] = Math.min(this.world.maxHp[self] ?? 0, (this.world.hp[self] ?? 0) + action.amount);
        break;
    }
  }

  private tickPendingProjectileLaunches(events: SimulationEvent[]): void {
    if (this.pendingProjectileLaunches.length === 0) return;
    this.pendingProjectileLaunches.sort((a, b) => a.launchTick - b.launchTick || a.sequence - b.sequence);
    let consumed = 0;
    for (const launch of this.pendingProjectileLaunches) {
      if (launch.launchTick > this.tickValue) break;
      consumed += 1;
      if (!this.world.isAlive(launch.sourceId)) continue;
      const projectile = getProjectileSource(launch.projectileId);
      const targetId = launch.targetId !== null && this.world.isAlive(launch.targetId) ? launch.targetId : null;
      this.spawnProjectile(launch.sourceId, projectile, launch.direction, events, 0, 1, targetId);
    }
    if (consumed > 0) this.pendingProjectileLaunches.splice(0, consumed);
  }

  private tickWeaponAttacks(events: SimulationEvent[]): void {
    for (const source of [...this.activeWeaponAttacks.keys()].sort((a, b) => a - b)) {
      const state = this.activeWeaponAttacks.get(source);
      if (!state) continue;
      if (!this.world.isAlive(source)) {
        this.activeWeaponAttacks.delete(source);
        continue;
      }
      const weapon = getPrimaryAttack(state.weaponId);
      if (state.phase === 'windup') {
        state.remainingTicks -= 1;
        if (state.remainingTicks > 0) continue;
        state.phase = 'active';
        state.remainingTicks = this.primaryActiveTicks(weapon);
        state.totalTicks = state.remainingTicks;
        continue;
      }
      if (state.phase === 'active') {
        if (weapon.behavior === 'ranged' || weapon.behavior === 'automatic' || weapon.behavior === 'beam') {
          const burstCount = Math.max(1, weapon.burstCount ?? 1);
          const interval = Math.max(1, weapon.burstIntervalTicks ?? 1);
          const elapsed = state.totalTicks - state.remainingTicks;
          if (state.shotsFired < burstCount && elapsed >= state.shotsFired * interval) {
            this.spawnProjectile(source, weapon, state.direction, events, state.shotsFired, burstCount, state.targetId);
            state.shotsFired += 1;
          }
          state.executed = state.shotsFired >= burstCount;
        } else if (!state.executed || ['continuous', 'spin', 'orbit'].includes(weapon.behavior)) {
          if (weapon.behavior === 'throwable') {
            if (!state.executed) this.spawnProjectile(source, weapon, state.direction, events, 0, 1, state.targetId);
          } else {
            const elapsed = state.totalTicks - state.remainingTicks;
            const repeatInterval = Math.max(1, weapon.repeatHitIntervalTicks ?? 12);
            if (weapon.behavior === 'continuous' && elapsed > 0 && elapsed % repeatInterval === 0) state.hitTargetIds.clear();
            this.resolveMeleeWeapon(source, weapon, state.direction, state.hitTargetIds, events);
          }
          state.executed = true;
        }
        state.remainingTicks -= 1;
        if (state.remainingTicks > 0) continue;
        const recoveryTicks = Math.max(0, weapon.recoveryTicks);
        if (recoveryTicks === 0) {
          this.activeWeaponAttacks.delete(source);
        } else {
          state.phase = 'recovery';
          state.remainingTicks = recoveryTicks;
          state.totalTicks = recoveryTicks;
        }
        continue;
      }
      state.remainingTicks -= 1;
      if (state.remainingTicks <= 0) this.activeWeaponAttacks.delete(source);
    }
  }

  private resolveMeleeWeapon(source: EntityId, weapon: PrimaryAttackDefinition, direction: Vec2, alreadyHit: Set<EntityId>, events: SimulationEvent[]): void {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const sourceTeam = this.world.getTeam(source);
    const dirLength = Math.hypot(direction.x, direction.y) || 1;
    const nx = direction.x / dirLength;
    const ny = direction.y / dirLength;
    const halfArc = weapon.attackAngleDegrees * Math.PI / 360;
    // activeIdList is maintained in ascending id order, so the prior explicit
    // sort was redundant. Reuse a stable buffer since damage can kill mid-loop.
    const candidates = this.world.copyActiveIdsInto(this.meleeIdScratch);
    for (const target of candidates) {
      if (target === source) continue;
      if (alreadyHit.has(target)) continue;
      if (!weapon.friendlyFire && this.world.getTeam(target) === sourceTeam) continue;
      const dx = (this.world.x[target] ?? 0) - sx;
      const dy = (this.world.y[target] ?? 0) - sy;
      const distance = Math.hypot(dx, dy);
      const effectiveReach = (this.world.radius[source] ?? 0) + weapon.range + (this.world.radius[target] ?? 0);
      if (distance < weapon.minRange || distance > effectiveReach) continue;
      const dot = distance > 0 ? (dx / distance) * nx + (dy / distance) * ny : 1;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > halfArc) continue;
      alreadyHit.add(target);
      this.dealDamage(source, target, weapon.damage, this.primaryElement(source), events);
      if (this.world.isAlive(target)) {
        this.applyKnockback(source, target, weapon.knockback, events, 'weapon');
        for (const status of weapon.onHitStatuses ?? []) this.applyStatus(source, target, status.statusId, status.durationTicks, events);
      }
      events.push({ type: 'weaponHit', tick: this.tickValue, sourceId: source, targetId: target, weaponId: weapon.id, position: { x: this.world.x[target] ?? 0, y: this.world.y[target] ?? 0 }, damage: weapon.damage, knockback: weapon.knockback });
      if (!['spin', 'continuous', 'orbit', 'slam'].includes(weapon.behavior)) break;
    }
  }

  private spawnProjectile(
    source: EntityId,
    weapon: ProjectileSourceDefinition,
    direction: Vec2,
    events: SimulationEvent[],
    shotIndex = 0,
    shotCount = 1,
    targetId: EntityId | null = null
  ): void {
    const definition = weapon.projectile;
    if (!definition) return;
    const normalized = normalizeVector(direction);
    const baseAngle = Math.atan2(normalized.y, normalized.x);
    const primary = tryGetPrimaryAttack(weapon.id);
    const spreadRadians = (primary?.spreadDegrees ?? 0) * Math.PI / 180;
    const offset = shotCount <= 1 ? 0 : ((shotIndex / (shotCount - 1)) - 0.5) * spreadRadians;
    const angle = baseAngle + offset;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const spawnDistance = (this.world.radius[source] ?? 20) + definition.radius + 5;
    const totalTicks = Math.max(1, definition.lifetimeTicks);
    const projectile: RuntimeProjectile = {
      id: this.nextProjectileId++, sourceId: source, team: this.world.getTeam(source), weapon, targetId,
      x: (this.world.x[source] ?? 0) + nx * spawnDistance, y: (this.world.y[source] ?? 0) + ny * spawnDistance,
      prevX: (this.world.x[source] ?? 0) + nx * spawnDistance, prevY: (this.world.y[source] ?? 0) + ny * spawnDistance,
      vx: nx * definition.speed, vy: ny * definition.speed,
      radius: definition.radius, remainingTicks: totalTicks, totalTicks, ageTicks: 0,
      fuseRemainingTicks: definition.fuseTicks, alive: true
    };
    this.projectiles.push(projectile);
    events.push({
      type: 'projectileSpawned', tick: this.tickValue, projectileId: projectile.id, sourceId: source,
      weaponId: weapon.id, position: { x: projectile.x, y: projectile.y }, velocity: { x: projectile.vx, y: projectile.vy },
      ...(targetId !== null ? { targetId } : {})
    });
  }

  private updateProjectiles(events: SimulationEvent[]): void {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      const definition = projectile.weapon.projectile;
      if (!definition) { projectile.alive = false; continue; }
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
      this.steerHomingProjectile(projectile);
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.ageTicks += 1;
      projectile.remainingTicks -= 1;
      if (projectile.fuseRemainingTicks > 0) projectile.fuseRemainingTicks -= 1;

      let impactTarget: EntityId | null = null;
      const queryPadding = projectile.radius + this.maxEntityRadius;
      this.projectileCandidateIds.splice(0);
      this.spatial.forEachInAabb(
        Math.min(projectile.prevX, projectile.x) - queryPadding,
        Math.min(projectile.prevY, projectile.y) - queryPadding,
        Math.max(projectile.prevX, projectile.x) + queryPadding,
        Math.max(projectile.prevY, projectile.y) + queryPadding,
        (id) => this.projectileCandidateIds.push(id)
      );
      this.projectileCandidateIds.sort((a, b) => a - b);
      for (const target of this.projectileCandidateIds) {
        this.stepMetrics.projectileEntityChecks += 1;
        if (!this.world.isAlive(target) || target === projectile.sourceId) continue;
        if (!projectile.weapon.friendlyFire && this.world.getTeam(target) === projectile.team) continue;
        const combined = projectile.radius + (this.world.radius[target] ?? 0);
        if (segmentIntersectsCircle(projectile.prevX, projectile.prevY, projectile.x, projectile.y, this.world.x[target] ?? 0, this.world.y[target] ?? 0, combined)) {
          impactTarget = target;
          break;
        }
      }

      let obstacleHit: RuntimeObstacle | null = null;
      for (const obstacle of this.obstacleList) {
        if (!obstacle.alive) continue;
        this.stepMetrics.projectileObstacleChecks += 1;
        const item = obstacle.definition;
        const hit = item.shape === 'circle'
          ? segmentIntersectsCircle(projectile.prevX, projectile.prevY, projectile.x, projectile.y, item.x, item.y, item.radius + projectile.radius)
          : segmentIntersectsBox(projectile.prevX, projectile.prevY, projectile.x, projectile.y, item.x - item.width / 2 - projectile.radius, item.y - item.height / 2 - projectile.radius, item.width + projectile.radius * 2, item.height + projectile.radius * 2);
        if (hit) { obstacleHit = obstacle; break; }
      }

      const hitLeft = projectile.x < projectile.radius;
      const hitRight = projectile.x > this.arena.width - projectile.radius;
      const hitTop = projectile.y < projectile.radius;
      const hitBottom = projectile.y > this.arena.height - projectile.radius;
      const wallHit = hitLeft || hitRight || hitTop || hitBottom;
      const fuseExpired = definition.fuseTicks > 0 && projectile.fuseRemainingTicks <= 0;
      if (impactTarget !== null && definition.explosionRadius <= 0) {
        this.dealDamage(projectile.sourceId, impactTarget, projectile.weapon.damage, this.primaryElement(projectile.sourceId), events);
        if (this.world.isAlive(impactTarget)) {
          this.applyKnockback(projectile.sourceId, impactTarget, projectile.weapon.knockback, events, 'weapon');
          for (const status of projectile.weapon.onHitStatuses ?? []) this.applyStatus(projectile.sourceId, impactTarget, status.statusId, status.durationTicks, events);
        }
        events.push({ type: 'weaponHit', tick: this.tickValue, sourceId: projectile.sourceId, targetId: impactTarget, weaponId: projectile.weapon.id, position: { x: projectile.x, y: projectile.y }, damage: projectile.weapon.damage, knockback: projectile.weapon.knockback });
      }

      if ((wallHit || obstacleHit) && definition.bounce > 0 && !fuseExpired && impactTarget === null) {
        if (obstacleHit) {
          const item = obstacleHit.definition;
          if (item.shape === 'circle') {
            const nx = projectile.prevX - item.x;
            const ny = projectile.prevY - item.y;
            const length = Math.hypot(nx, ny) || 1;
            const ux = nx / length;
            const uy = ny / length;
            const dot = projectile.vx * ux + projectile.vy * uy;
            projectile.vx = (projectile.vx - 2 * dot * ux) * definition.bounce;
            projectile.vy = (projectile.vy - 2 * dot * uy) * definition.bounce;
          } else {
            const dx = projectile.prevX - item.x;
            const dy = projectile.prevY - item.y;
            if (Math.abs(dx) / Math.max(1, item.width) > Math.abs(dy) / Math.max(1, item.height)) projectile.vx *= -definition.bounce;
            else projectile.vy *= -definition.bounce;
          }
          projectile.x = projectile.prevX;
          projectile.y = projectile.prevY;
        } else {
          if (hitLeft || hitRight) projectile.vx *= -definition.bounce;
          if (hitTop || hitBottom) projectile.vy *= -definition.bounce;
          projectile.x = Math.max(projectile.radius, Math.min(this.arena.width - projectile.radius, projectile.x));
          projectile.y = Math.max(projectile.radius, Math.min(this.arena.height - projectile.radius, projectile.y));
        }
      } else if (impactTarget !== null || wallHit || obstacleHit !== null || fuseExpired || projectile.remainingTicks <= 0) {
        this.resolveProjectileImpact(projectile, impactTarget, events);
      }
    }
    if (this.projectiles.length > 256) {
      for (let index = this.projectiles.length - 1; index >= 0 && this.projectiles.length > 192; index -= 1) {
        if (!this.projectiles[index]?.alive) this.projectiles.splice(index, 1);
      }
    }
  }

  private resolveProjectileImpact(projectile: RuntimeProjectile, target: EntityId | null, events: SimulationEvent[]): void {
    if (!projectile.alive) return;
    projectile.alive = false;
    const definition = projectile.weapon.projectile!;
    events.push({ type: 'projectileImpact', tick: this.tickValue, projectileId: projectile.id, sourceId: projectile.sourceId, weaponId: projectile.weapon.id, position: { x: projectile.x, y: projectile.y }, ...(target !== null ? { targetId: target } : {}) });
    if (definition.explosionRadius <= 0) return;

    this.projectileCandidateIds.splice(0);
    this.spatial.forEachInAabb(
      projectile.x - definition.explosionRadius,
      projectile.y - definition.explosionRadius,
      projectile.x + definition.explosionRadius,
      projectile.y + definition.explosionRadius,
      (id) => this.projectileCandidateIds.push(id)
    );
    this.projectileCandidateIds.sort((a, b) => a - b);
    for (const id of this.projectileCandidateIds) {
      this.stepMetrics.projectileEntityChecks += 1;
      if (!this.world.isAlive(id)) continue;
      if (!projectile.weapon.friendlyFire && this.world.getTeam(id) === projectile.team) continue;
      const dx = (this.world.x[id] ?? 0) - projectile.x;
      const dy = (this.world.y[id] ?? 0) - projectile.y;
      if (dx * dx + dy * dy > definition.explosionRadius * definition.explosionRadius) continue;
      const directHit = target !== null && id === target;
      const combinedDamage = definition.explosionDamage + (directHit ? projectile.weapon.damage : 0);
      this.dealDamage(projectile.sourceId, id, combinedDamage, this.primaryElement(projectile.sourceId), events);
      if (this.world.isAlive(id)) {
        const distance = Math.hypot(dx, dy);
        const distanceRatio = Math.min(1, distance / Math.max(1, definition.explosionRadius));
        const falloff = 0.58 + (1 - distanceRatio) * 0.42;
        const combinedBaseImpulse = definition.explosionImpulse + (directHit ? projectile.weapon.knockback : 0);
        const impulse = this.damageScaledImpulse(combinedBaseImpulse, combinedDamage) * falloff;
        this.applyKnockbackFromPoint(
          projectile.sourceId,
          { x: projectile.x, y: projectile.y },
          id,
          impulse,
          events,
          'explosion',
          { x: projectile.vx, y: projectile.vy },
          this.explosionImpulseOptions(combinedDamage, projectile.weapon.id)
        );
        if (directHit) {
          for (const status of projectile.weapon.onHitStatuses ?? []) this.applyStatus(projectile.sourceId, id, status.statusId, status.durationTicks, events);
        }
      }
    }
    if (target !== null) {
      events.push({
        type: 'weaponHit',
        tick: this.tickValue,
        sourceId: projectile.sourceId,
        targetId: target,
        weaponId: projectile.weapon.id,
        position: { x: projectile.x, y: projectile.y },
        damage: definition.explosionDamage + projectile.weapon.damage,
        knockback: definition.explosionImpulse + projectile.weapon.knockback
      });
    }
    events.push({ type: 'blast', tick: this.tickValue, sourceId: projectile.sourceId, abilityId: projectile.weapon.id, kind: 'explosion', position: { x: projectile.x, y: projectile.y }, radius: definition.explosionRadius, force: this.damageScaledImpulse(definition.explosionImpulse, definition.explosionDamage), damage: definition.explosionDamage, element: this.primaryElement(projectile.sourceId) });
  }

  private updateRuntimeProjectileSnapshots(): void {
    let index = 0;
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      const definition = projectile.weapon.projectile!;
      const progress = Math.max(0, Math.min(1, projectile.ageTicks / Math.max(1, projectile.totalTicks)));
      const arcHeight = projectile.weapon.behavior === 'throwable'
        ? Math.sin(Math.min(1, progress * 1.55) * Math.PI) * Math.max(18, definition.gravity * 720)
        : 0;
      const target = this.runtimeProjectileSnapshots[index] ?? {
        id: 0,
        sourceId: 0,
        team: 0,
        weaponId: '',
        category: 'melee',
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alive: true,
        fuseRemainingTicks: 0,
        arcHeight: 0,
        rotation: 0
      };
      target.id = projectile.id;
      target.sourceId = projectile.sourceId;
      target.team = projectile.team;
      target.weaponId = projectile.weapon.id;
      target.category = projectile.weapon.behavior;
      target.x = projectile.x;
      target.y = projectile.y;
      target.prevX = projectile.prevX;
      target.prevY = projectile.prevY;
      target.vx = projectile.vx;
      target.vy = projectile.vy;
      target.radius = projectile.radius;
      target.alive = true;
      target.fuseRemainingTicks = projectile.fuseRemainingTicks;
      target.arcHeight = arcHeight;
      target.rotation = Math.atan2(projectile.vy, projectile.vx) + projectile.ageTicks * (projectile.weapon.behavior === 'throwable' ? 0.18 : 0);
      if (projectile.targetId !== null) target.targetId = projectile.targetId;
      else delete target.targetId;
      if (definition.trailStyle) target.trailStyle = definition.trailStyle;
      else delete target.trailStyle;
      this.runtimeProjectileSnapshots[index] = target;
      index += 1;
    }
    this.runtimeProjectileSnapshots.length = index;
  }

  private updateRuntimeObstacleSnapshots(): void {
    let index = 0;
    for (const { definition, hp, alive } of this.obstacleList) {
      const target = this.runtimeObstacleSnapshots[index] ?? {
        id: '',
        kind: definition.kind,
        shape: definition.shape,
        x: 0,
        y: 0,
        radius: 0,
        width: 0,
        height: 0,
        hp: 0,
        maxHp: 0,
        destructible: false,
        alive: true
      };
      target.id = definition.id;
      target.kind = definition.kind;
      target.shape = definition.shape;
      target.x = definition.x;
      target.y = definition.y;
      target.radius = definition.radius;
      target.width = definition.width;
      target.height = definition.height;
      target.hp = hp;
      target.maxHp = definition.maxHp;
      target.destructible = definition.destructible;
      target.alive = alive;
      this.runtimeObstacleSnapshots[index] = target;
      index += 1;
    }
    this.runtimeObstacleSnapshots.length = index;
  }

  private updateRuntimeObjectiveSnapshot(): void {
    const target = this.runtimeObjectiveSnapshot;
    if (this.mode.victory === 'DEFEAT_BOSS') {
      const bossTeam = this.mode.bossTeam ?? 2;
      let bossMax = 0;
      let bossHp = 0;
      for (const id of this.world.activeIdsView()) {
        if (this.world.getTeam(id) !== bossTeam) continue;
        bossMax += this.world.maxHp[id] ?? 0;
        bossHp += this.world.hp[id] ?? 0;
      }
      target.kind = 'boss';
      target.label = 'Destroy the boss';
      target.progress = bossMax > 0 ? 1 - bossHp / bossMax : 1;
      target.remainingTicks = null;
      return;
    }
    if (this.mode.victory === 'SURVIVE_TICKS') {
      const duration = this.mode.durationTicks ?? 2700;
      target.kind = 'survival';
      target.label = 'Survive the foundry';
      target.progress = Math.min(1, this.tickValue / duration);
      target.remainingTicks = Math.max(0, duration - this.tickValue);
      return;
    }
    target.kind = 'elimination';
    target.label = 'Last team standing';
    target.progress = 0;
    target.remainingTicks = null;
  }

  private copyRuntimeMetrics(): void {
    const target = this.runtimeMetricsSnapshot;
    target.activeEntities = this.world.activeCount();
    target.commandsProcessed = this.stepMetrics.commandsProcessed;
    target.candidatePairs = this.stepMetrics.candidatePairs;
    target.contactsResolved = this.stepMetrics.contactsResolved;
    target.sameTeamContacts = this.stepMetrics.sameTeamContacts;
    target.occupiedBroadphaseCells = this.stepMetrics.occupiedBroadphaseCells;
    target.maxBroadphaseBucket = this.stepMetrics.maxBroadphaseBucket;
    target.projectileEntityChecks = this.stepMetrics.projectileEntityChecks;
    target.projectileObstacleChecks = this.stepMetrics.projectileObstacleChecks;
    target.invalidNumericStates = this.stepMetrics.invalidNumericStates;
  }

  private projectileSnapshots(): ProjectileSnapshot[] {
    return this.projectiles.filter((projectile) => projectile.alive).map((projectile) => {
      const definition = projectile.weapon.projectile!;
      const progress = Math.max(0, Math.min(1, projectile.ageTicks / Math.max(1, projectile.totalTicks)));
      const arcHeight = projectile.weapon.behavior === 'throwable'
        ? Math.sin(Math.min(1, progress * 1.55) * Math.PI) * Math.max(18, definition.gravity * 720)
        : 0;
      return {
        id: projectile.id,
        sourceId: projectile.sourceId,
        team: projectile.team,
        weaponId: projectile.weapon.id,
        category: projectile.weapon.behavior,
        x: projectile.x,
        y: projectile.y,
        prevX: projectile.prevX,
        prevY: projectile.prevY,
        vx: projectile.vx,
        vy: projectile.vy,
        radius: projectile.radius,
        alive: projectile.alive,
        fuseRemainingTicks: projectile.fuseRemainingTicks,
        arcHeight,
        rotation: Math.atan2(projectile.vy, projectile.vx) + projectile.ageTicks * (projectile.weapon.behavior === 'throwable' ? 0.18 : 0),
        ...(projectile.targetId !== null ? { targetId: projectile.targetId } : {}),
        ...(definition.trailStyle ? { trailStyle: definition.trailStyle } : {})
      };
    });
  }

  private steerHomingProjectile(projectile: RuntimeProjectile): void {
    const definition = projectile.weapon.projectile;
    if (!definition || (definition.homingStrength ?? 0) <= 0 || projectile.ageTicks < (definition.homingDelayTicks ?? 0)) return;
    const range = definition.homingRange ?? Number.POSITIVE_INFINITY;
    let targetId = projectile.targetId;
    if (targetId === null || !this.world.isAlive(targetId) || this.world.getTeam(targetId) === projectile.team) {
      targetId = this.nearestHostileToPoint(projectile.sourceId, projectile.x, projectile.y, range);
      projectile.targetId = targetId;
    }
    if (targetId === null) return;
    const dx = (this.world.x[targetId] ?? 0) - projectile.x;
    const dy = (this.world.y[targetId] ?? 0) - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > range) return;
    const speed = Math.hypot(projectile.vx, projectile.vy) || definition.speed;
    const currentAngle = Math.atan2(projectile.vy, projectile.vx);
    const desiredAngle = Math.atan2(dy, dx);
    const delta = shortestAngleDelta(currentAngle, desiredAngle);
    const responsiveness = Math.max(0, Math.min(1, definition.homingStrength ?? 0));
    const maxTurn = definition.homingTurnRadians ?? 0.055;
    const turn = Math.sign(delta) * Math.min(Math.abs(delta) * responsiveness, maxTurn);
    const nextAngle = currentAngle + turn;
    projectile.vx = Math.cos(nextAngle) * speed;
    projectile.vy = Math.sin(nextAngle) * speed;
  }

  private hostileTargetsByDistance(source: EntityId): EntityId[] {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const team = this.world.getTeam(source);
    return this.world.activeIds()
      .filter((id) => id !== source && this.world.getTeam(id) !== team)
      .sort((a, b) => {
        const adx = (this.world.x[a] ?? 0) - sx;
        const ady = (this.world.y[a] ?? 0) - sy;
        const bdx = (this.world.x[b] ?? 0) - sx;
        const bdy = (this.world.y[b] ?? 0) - sy;
        return adx * adx + ady * ady - (bdx * bdx + bdy * bdy) || a - b;
      });
  }

  private nearestHostileToPoint(source: EntityId, x: number, y: number, maximumRange: number): EntityId | null {
    const team = this.world.getTeam(source);
    const maximumSquared = maximumRange * maximumRange;
    let best: EntityId | null = null;
    let bestDistance = maximumSquared;
    for (const id of this.world.activeIdsView()) {
      if (id === source || this.world.getTeam(id) === team) continue;
      const dx = (this.world.x[id] ?? 0) - x;
      const dy = (this.world.y[id] ?? 0) - y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance || (distance === bestDistance && (best === null || id < best))) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }

  private damageScaledImpulse(baseImpulse: number, damage: number): number {
    if (baseImpulse <= 0) return 0;
    const safeDamage = Math.min(120, Math.max(0, damage));
    // High-damage explosions must create clearly stronger displacement, not
    // merely a slightly larger number. The curve keeps micro-missiles modest
    // while making Bomber's MEGA BOMB capable of launching targets into walls.
    const damageRatio = safeDamage / 18;
    const multiplier = Math.max(0.86, 0.7 + Math.pow(damageRatio, 1.12) * 0.72);
    return baseImpulse * multiplier;
  }


  private explosionImpulseOptions(damage: number, abilityId?: string): ExternalImpulseOptions {
    if (abilityId === 'mega-bomb') {
      return { retention: 0.997, maxSpeed: 72, minWallBounces: 3, trailStrength: 1 };
    }
    if (damage >= 24) {
      return {
        retention: Math.min(0.982, 0.95 + (damage - 24) * 0.0015),
        maxSpeed: Math.min(64, 52 + (damage - 24) * 0.5),
        trailStrength: Math.min(1, damage / 40)
      };
    }
    return { retention: 0.92, maxSpeed: 48, trailStrength: Math.min(0.7, damage / 32) };
  }

  private forEachInRadius(source: EntityId, radius: number, enemiesOnly: boolean, callback: (id: EntityId) => void): void {
    this.forEachAroundPoint(source, { x: this.world.x[source] ?? 0, y: this.world.y[source] ?? 0 }, radius, enemiesOnly, callback);
  }

  private forEachAroundPoint(source: EntityId, center: Vec2, radius: number, enemiesOnly: boolean, callback: (id: EntityId) => void): void {
    const team = this.world.getTeam(source);
    for (const id of this.world.activeIds()) {
      if (id === source) continue;
      if (enemiesOnly && this.world.getTeam(id) === team) continue;
      const dx = (this.world.x[id] ?? 0) - center.x;
      const dy = (this.world.y[id] ?? 0) - center.y;
      if (dx * dx + dy * dy <= radius * radius) callback(id);
    }
  }

  private forEachInCone(source: EntityId, range: number, arcDegrees: number, enemiesOnly: boolean, direction: Vec2, callback: (id: EntityId) => void): void {
    const sx = this.world.x[source] ?? 0;
    const sy = this.world.y[source] ?? 0;
    const team = this.world.getTeam(source);
    const directionLength = Math.hypot(direction.x, direction.y) || 1;
    const nx = direction.x / directionLength;
    const ny = direction.y / directionLength;
    const halfArc = arcDegrees * Math.PI / 360;
    for (const id of this.world.activeIds()) {
      if (id === source) continue;
      if (enemiesOnly && this.world.getTeam(id) === team) continue;
      const dx = (this.world.x[id] ?? 0) - sx;
      const dy = (this.world.y[id] ?? 0) - sy;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.0001 || distance > range + (this.world.radius[id] ?? 0)) continue;
      const dot = Math.max(-1, Math.min(1, (dx / distance) * nx + (dy / distance) * ny));
      if (Math.acos(dot) <= halfArc) callback(id);
    }
  }

  private applyKnockback(
    source: EntityId,
    target: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    impulseOptions?: ExternalImpulseOptions
  ): void {
    const direction = {
      x: (this.world.x[target] ?? 0) - (this.world.x[source] ?? 0),
      y: (this.world.y[target] ?? 0) - (this.world.y[source] ?? 0)
    };
    this.applyKnockbackVector(source, target, direction, magnitude, events, kind, undefined, impulseOptions);
  }

  private applyKnockbackFromPoint(
    source: EntityId | undefined,
    origin: Vec2,
    target: EntityId,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    fallbackDirection?: Vec2,
    impulseOptions?: ExternalImpulseOptions
  ): void {
    const direction = {
      x: (this.world.x[target] ?? 0) - origin.x,
      y: (this.world.y[target] ?? 0) - origin.y
    };
    this.applyKnockbackVector(source, target, direction, magnitude, events, kind, fallbackDirection, impulseOptions);
  }

  private applyKnockbackVector(
    source: EntityId | undefined,
    target: EntityId,
    direction: Vec2,
    magnitude: number,
    events: SimulationEvent[],
    kind: 'weapon' | 'explosion' | 'ability',
    fallbackDirection?: Vec2,
    impulseOptions?: ExternalImpulseOptions
  ): void {
    if (magnitude === 0 || !this.world.isAlive(target)) return;
    let dx = direction.x;
    let dy = direction.y;
    let length = Math.hypot(dx, dy);
    if (length < 0.001 && fallbackDirection) {
      dx = fallbackDirection.x;
      dy = fallbackDirection.y;
      length = Math.hypot(dx, dy);
    }
    if (length < 0.001) {
      const fallbackAngle = (((source ?? 0) * 37 + target * 17) % 360) * Math.PI / 180;
      dx = Math.cos(fallbackAngle);
      dy = Math.sin(fallbackAngle);
      length = 1;
    }
    const nx = dx / length;
    const ny = dy / length;
    const invMass = 1 / this.world.getEffectiveMass(target);
    const velocityDelta = magnitude * invMass;
    this.addExternalImpulse(target, nx * velocityDelta, ny * velocityDelta, impulseOptions);
    const visualForce = Math.abs(magnitude);
    // Keep the event stream bounded in mass battles. Tiny recoil still affects
    // physics, while meaningful displacement receives explicit presentation.
    if (kind === 'explosion' || visualForce >= 2.4) {
      const sign = magnitude < 0 ? -1 : 1;
      events.push({
        type: 'knockbackApplied',
        tick: this.tickValue,
        ...(source !== undefined ? { sourceId: source } : {}),
        targetId: target,
        position: { x: this.world.x[target] ?? 0, y: this.world.y[target] ?? 0 },
        direction: { x: nx * sign, y: ny * sign },
        force: visualForce,
        kind
      });
    }
  }

  private addExternalImpulse(target: EntityId, x: number, y: number, options: ExternalImpulseOptions = {}): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !this.world.isAlive(target)) return;
    const current = this.externalImpulse.get(target) ?? {
      x: 0,
      y: 0,
      retention: 0.92,
      maxSpeed: 48,
      minWallBounces: 0,
      wallBounces: 0,
      trailStrength: 0
    };
    const maxImpulseSpeed = Math.max(current.maxSpeed, options.maxSpeed ?? 48);
    let nextX = current.x + x;
    let nextY = current.y + y;
    const nextMagnitude = Math.hypot(nextX, nextY);
    if (nextMagnitude > maxImpulseSpeed) {
      const scale = maxImpulseSpeed / nextMagnitude;
      nextX *= scale;
      nextY *= scale;
    }
    const appliedX = nextX - current.x;
    const appliedY = nextY - current.y;
    this.externalImpulse.set(target, {
      x: nextX,
      y: nextY,
      retention: Math.max(current.retention, options.retention ?? 0.92),
      maxSpeed: maxImpulseSpeed,
      minWallBounces: Math.max(current.minWallBounces, options.minWallBounces ?? 0),
      wallBounces: current.wallBounces,
      trailStrength: Math.max(current.trailStrength, options.trailStrength ?? 0)
    });
    this.world.vx[target] = (this.world.vx[target] ?? 0) + appliedX;
    this.world.vy[target] = (this.world.vy[target] ?? 0) + appliedY;
  }

  private applyStatus(sourceId: EntityId, targetId: EntityId, statusId: string, durationTicks: number, events: SimulationEvent[]): void {
    if (!this.world.isAlive(targetId)) return;
    if (statusId === 'wet') this.world.removeStatus(targetId, 'burn');
    this.world.applyStatus(targetId, statusId, durationTicks, sourceId);
    events.push({ type: 'statusApplied', tick: this.tickValue, sourceId, targetId, statusId, durationTicks });
  }

  private tickStatuses(events: SimulationEvent[]): void {
    // Periodic damage can kill the entity mid-loop, so iterate a stable copy.
    for (const id of this.world.copyActiveIdsInto(this.statusIdScratch)) {
      if (!this.world.hasAnyStatus(id)) continue;
      const statuses = this.world.getStatuses(id);
      for (const [statusId, status] of [...statuses.entries()]) {
        const definition = getStatus(statusId);
        status.remainingTicks -= 1;
        if (definition.periodicDamage && definition.periodTicks) {
          status.pulseCountdown -= 1;
          if (status.pulseCountdown <= 0) {
            this.dealDamage(status.sourceId, id, definition.periodicDamage, definition.element ?? 'neutral', events);
            status.pulseCountdown = definition.periodTicks;
          }
        }
        if (status.remainingTicks <= 0) statuses.delete(statusId);
      }
    }
  }

  private dealDamage(sourceId: EntityId | null, targetId: EntityId, rawAmount: number, element: Element, events: SimulationEvent[]): void {
    if (!this.world.isAlive(targetId) || rawAmount <= 0) return;
    if (sourceId !== null && sourceId !== targetId && this.world.getTeam(sourceId) === this.world.getTeam(targetId) && !this.rules.friendlyFire) return;
    const target = getFighter(this.world.getFighterId(targetId));
    const resistance = target.resistances[element] ?? 1;
    const elementMultiplier = getElementMultiplier(element, target.classification.elements);
    const sourceDamageScale = sourceId !== null
      ? (this.world.damageScale[sourceId] ?? 1)
      : 1;
    const amount = Math.max(0, rawAmount * sourceDamageScale * resistance * elementMultiplier);
    const prevented = this.trainingRules.enabled && (!this.trainingRules.damageEnabled || this.trainingRules.invulnerableTeams.has(this.world.getTeam(targetId)));
    if (!prevented) this.world.hp[targetId] = Math.max(0, (this.world.hp[targetId] ?? 0) - amount);
    const damageEvent: DamageEvent = {
      type: 'damage', tick: this.tickValue, targetId, amount, element, hpAfter: this.world.hp[targetId] ?? 0,
      position: { x: this.world.x[targetId] ?? 0, y: this.world.y[targetId] ?? 0 },
      ...(sourceId !== null ? { sourceId } : {}),
      ...(prevented ? { prevented: true } : {})
    };
    events.push(damageEvent);
    if (!prevented && (this.world.hp[targetId] ?? 0) <= 0) {
      const position = { x: this.world.x[targetId] ?? 0, y: this.world.y[targetId] ?? 0 };
      this.world.kill(targetId);
      this.externalImpulse.delete(targetId);
      events.push({ type: 'death', tick: this.tickValue, entityId: targetId, position, ...(sourceId !== null ? { killerId: sourceId } : {}) });
    }
  }

  private primaryElement(id: EntityId): Element {
    return getFighter(this.world.getFighterId(id)).classification.elements[0] ?? 'neutral';
  }

  private resolveAbilityDirection(self: EntityId, target: EntityId | null, requested?: Vec2): Vec2 {
    if (requested && Math.hypot(requested.x, requested.y) > 0.001) return requested;
    if (target !== null) {
      const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
      const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    }
    const vx = this.world.vx[self] ?? 0;
    const vy = this.world.vy[self] ?? 0;
    const length = Math.hypot(vx, vy) || 1;
    return { x: vx / length, y: vy / length };
  }

  private zoneContains(zone: ArenaZoneDefinition, x: number, y: number): boolean {
    if (zone.shape === 'circle') {
      const dx = x - zone.x;
      const dy = y - zone.y;
      return dx * dx + dy * dy <= zone.radius * zone.radius;
    }
    return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
  }

  private obstacleSnapshots(): ArenaObstacleSnapshot[] {
    // Match the stable ID-sorted order used by the pooled runtime snapshot.
    // Keeping both snapshot paths in the same order preserves checksum parity.
    return this.obstacleList.map(({ definition, hp, alive }) => ({
      id: definition.id,
      kind: definition.kind,
      shape: definition.shape,
      x: definition.x,
      y: definition.y,
      radius: definition.radius,
      width: definition.width,
      height: definition.height,
      hp,
      maxHp: definition.maxHp,
      destructible: definition.destructible,
      alive
    }));
  }

  private objectiveSnapshot(): BattleObjectiveSnapshot {
    if (this.mode.victory === 'DEFEAT_BOSS') {
      const bossTeam = this.mode.bossTeam ?? 2;
      const bossEntities = this.world.activeIds().filter((id) => this.world.getTeam(id) === bossTeam);
      const bossMax = bossEntities.reduce((sum, id) => sum + (this.world.maxHp[id] ?? 0), 0);
      const bossHp = bossEntities.reduce((sum, id) => sum + (this.world.hp[id] ?? 0), 0);
      return { kind: 'boss', label: 'Destroy the boss', progress: bossMax > 0 ? 1 - bossHp / bossMax : 1, remainingTicks: null };
    }
    if (this.mode.victory === 'SURVIVE_TICKS') {
      const duration = this.mode.durationTicks ?? 2700;
      return { kind: 'survival', label: 'Survive the foundry', progress: Math.min(1, this.tickValue / duration), remainingTicks: Math.max(0, duration - this.tickValue) };
    }
    return { kind: 'elimination', label: 'Last team standing', progress: 0, remainingTicks: null };
  }

  private recoverInvalidNumericState(): void {
    for (const id of this.world.activeIdsView()) {
      const fighter = getFighter(this.world.getFighterId(id));
      let invalid = false;
      const previousX = this.world.prevX[id] ?? this.arena.width / 2;
      const previousY = this.world.prevY[id] ?? this.arena.height / 2;
      if (!Number.isFinite(this.world.x[id])) { this.world.x[id] = Number.isFinite(previousX) ? previousX : this.arena.width / 2; invalid = true; }
      if (!Number.isFinite(this.world.y[id])) { this.world.y[id] = Number.isFinite(previousY) ? previousY : this.arena.height / 2; invalid = true; }
      if (!Number.isFinite(this.world.prevX[id])) { this.world.prevX[id] = this.world.x[id] ?? this.arena.width / 2; invalid = true; }
      if (!Number.isFinite(this.world.prevY[id])) { this.world.prevY[id] = this.world.y[id] ?? this.arena.height / 2; invalid = true; }
      if (!Number.isFinite(this.world.vx[id])) { this.world.vx[id] = 0; invalid = true; }
      if (!Number.isFinite(this.world.vy[id])) { this.world.vy[id] = 0; invalid = true; }
      if (!Number.isFinite(this.world.rotation[id])) { this.world.rotation[id] = 0; invalid = true; }
      if (!Number.isFinite(this.world.hp[id])) { this.world.hp[id] = this.world.maxHp[id] ?? fighter.stats.maxHp; invalid = true; }
      if (!Number.isFinite(this.world.radius[id]) || (this.world.radius[id] ?? 0) <= 0) { this.world.radius[id] = fighter.physics.radius; invalid = true; }
      if (!Number.isFinite(this.world.mass[id]) || (this.world.mass[id] ?? 0) <= 0) { this.world.mass[id] = fighter.physics.mass; invalid = true; }
      if (invalid) {
        this.world.x[id] = Math.max(this.world.radius[id] ?? 1, Math.min(this.arena.width - (this.world.radius[id] ?? 1), this.world.x[id] ?? this.arena.width / 2));
        this.world.y[id] = Math.max(this.world.radius[id] ?? 1, Math.min(this.arena.height - (this.world.radius[id] ?? 1), this.world.y[id] ?? this.arena.height / 2));
        this.stepMetrics.invalidNumericStates += 1;
      }
    }

    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      if ([projectile.x, projectile.y, projectile.prevX, projectile.prevY, projectile.vx, projectile.vy].every(Number.isFinite)) continue;
      projectile.alive = false;
      this.stepMetrics.invalidNumericStates += 1;
    }
  }

  private checkVictory(events: SimulationEvent[]): void {
    if (this.trainingRules.enabled && this.trainingRules.suppressVictory) return;
    const aliveIds = this.world.activeIdsView();
    const teams = new Set<TeamId>(aliveIds.map((id) => this.world.getTeam(id)));

    if (this.mode.victory === 'DEFEAT_BOSS') {
      const bossTeam = this.mode.bossTeam ?? 2;
      const bossAlive = aliveIds.some((id) => this.world.getTeam(id) === bossTeam);
      const raiderTeams = [...teams].filter((team) => team !== bossTeam).sort((a, b) => a - b);
      if (!bossAlive) this.endBattle(raiderTeams[0] ?? null, 'boss-defeated', events);
      else if (raiderTeams.length === 0) this.endBattle(bossTeam, 'elimination', events);
      return;
    }

    if (this.mode.victory === 'SURVIVE_TICKS') {
      const survivorTeam = this.mode.survivorTeam ?? 1;
      const survivorAlive = aliveIds.some((id) => this.world.getTeam(id) === survivorTeam);
      const enemyTeams = [...teams].filter((team) => team !== survivorTeam);
      if (!survivorAlive) this.endBattle(enemyTeams.sort((a, b) => a - b)[0] ?? null, 'elimination', events);
      else if (enemyTeams.length === 0 || this.tickValue >= (this.mode.durationTicks ?? 2700)) this.endBattle(survivorTeam, 'survival-complete', events);
      return;
    }

    if (teams.size <= 1) {
      const winner = teams.size === 1 ? [...teams][0] ?? null : null;
      this.endBattle(winner, winner === null ? 'draw' : 'elimination', events);
      return;
    }
    if (this.tickValue >= this.rules.maxBattleTicks) {
      const winner = this.leadingTeamAtTimeout(aliveIds);
      this.endBattle(winner, winner === null ? 'draw' : 'timeout', events);
    }
  }

  private leadingTeamAtTimeout(aliveIds: readonly EntityId[]): TeamId | null {
    const scores = new Map<TeamId, { alive: number; hpRatio: number }>();
    for (const id of aliveIds) {
      const team = this.world.getTeam(id);
      const current = scores.get(team) ?? { alive: 0, hpRatio: 0 };
      current.alive += 1;
      current.hpRatio += (this.world.hp[id] ?? 0) / Math.max(1, this.world.maxHp[id] ?? 1);
      scores.set(team, current);
    }
    const ranked = [...scores.entries()]
      .sort((a, b) => b[1].alive - a[1].alive || b[1].hpRatio - a[1].hpRatio || a[0] - b[0]);
    const first = ranked[0];
    const second = ranked[1];
    if (!first) return null;
    if (second && first[1].alive === second[1].alive && Math.abs(first[1].hpRatio - second[1].hpRatio) < 0.000001) return null;
    return first[0];
  }

  private endBattle(winningTeam: TeamId | null, reason: BattleEndReason, events: SimulationEvent[]): void {
    if (this.battleEndedValue) return;
    this.battleEndedValue = true;
    this.winningTeamValue = winningTeam;
    const winnerEntityIds = winningTeam === null
      ? []
      : this.world.activeIds().filter((id) => this.world.getTeam(id) === winningTeam).sort((a, b) => a - b);
    this.resultValue = { reason, winningTeam, winnerEntityIds, endedAtTick: this.tickValue };
    this.activeCasts.clear();
    this.armedAbilities.clear();
    this.activeWeaponAttacks.clear();
    this.world.stabilizeActive();
    events.push({ type: 'battleEnded', tick: this.tickValue, winningTeam, reason, winnerEntityIds });
  }
}

function resolveTrainingRules(value: TrainingBattleRules | undefined): ResolvedTrainingRules {
  return {
    enabled: value?.enabled ?? false,
    damageEnabled: value?.damageEnabled ?? true,
    cooldownsEnabled: value?.cooldownsEnabled ?? true,
    invulnerableTeams: new Set(value?.invulnerableTeams ?? []),
    suppressVictory: value?.suppressVictory ?? false
  };
}

function segmentIntersectsCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.000001) return (ax - cx) ** 2 + (ay - cy) ** 2 <= radius * radius;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSq));
  const closestX = ax + dx * t;
  const closestY = ay + dy * t;
  return (closestX - cx) ** 2 + (closestY - cy) ** 2 <= radius * radius;
}

function segmentIntersectsBox(ax: number, ay: number, bx: number, by: number, x: number, y: number, width: number, height: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  const checks: Array<[number, number]> = [[-dx, ax - x], [dx, x + width - ax], [-dy, ay - y], [dy, y + height - ay]];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 0.000001) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) tMin = Math.max(tMin, r);
    else tMax = Math.min(tMax, r);
    if (tMin > tMax) return false;
  }
  return true;
}

