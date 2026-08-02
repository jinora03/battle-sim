import {
  CONTENT_VERSION,
  getArena,
  getFighter,
  getGameMode,
  getPrimaryAttack,
  type PrimaryAttackDefinition
} from '@kinetic/content';
import type {
  ActivatePrimaryAttackCommand,
  BattleDefinition,
  BattleEndReason,
  BattleResultSnapshot,
  BattleRules,
  BattleParticipant,
  Element,
  EntityId,
  SimulationCommand,
  SimulationEvent,
  SimulationMetricsSnapshot,
  TeamId,
  TrainingBattleRules,
  Vec2,
  WorldSnapshot
} from '@kinetic/protocol';
import { SeededRng } from './rng';
import { SpatialHashGrid } from './spatialHash';
import { World, type ActiveCastState, type ActiveWeaponAttackState, type ArmedAbilityState } from './world';
import { BattleResultSystem } from './systems/BattleResultSystem';
import { CommandSystem } from './systems/CommandSystem';
import { StatusSystem } from './systems/StatusSystem';
import { ArenaCollisionSystem } from './systems/ArenaCollisionSystem';
import { ArenaZoneSystem } from './systems/ArenaZoneSystem';
import type { ExternalImpulseState } from './systems/SimulationSystemTypes';
import { DamageSystem } from './systems/DamageSystem';
import { KnockbackSystem } from './systems/KnockbackSystem';
import { MovementSystem } from './systems/MovementSystem';
import { CooldownSystem } from './systems/CooldownSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { AbilitySystem } from './systems/AbilitySystem';
import { SnapshotSystem, type SnapshotContext } from './snapshots/SnapshotSystem';

export const ENGINE_VERSION = '1.2.2-stage8.2a';
export { CONTENT_VERSION };
export const SIM_TICK_RATE = 60;
export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

export interface SimulationRunner {
  readonly tick: number;
  getSnapshot(): WorldSnapshot;
  getRuntimeSnapshot(): WorldSnapshot;
  step(commands: readonly SimulationCommand[]): SimulationEvent[];
}

type ResolvedBattleRules = Required<Pick<BattleRules, 'friendlyFire' | 'teamCollision' | 'teamCollisionScale' | 'maxBattleTicks'>>;

type ResolvedTrainingRules = {
  enabled: boolean;
  damageEnabled: boolean;
  cooldownsEnabled: boolean;
  invulnerableTeams: Set<TeamId>;
  suppressVictory: boolean;
};

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
  private readonly commandSystem: CommandSystem;
  private readonly statusSystem: StatusSystem;
  private readonly battleResultSystem: BattleResultSystem;
  private readonly arenaZones: ArenaZoneSystem;
  private readonly arenaCollisions: ArenaCollisionSystem;
  private readonly movementSystem: MovementSystem;
  private readonly cooldownSystem: CooldownSystem;
  private readonly snapshotSystem: SnapshotSystem;
  private readonly projectileSystem: ProjectileSystem;
  private readonly abilitySystem: AbilitySystem;
  private readonly damageSystem: DamageSystem;
  private readonly knockbackSystem: KnockbackSystem;
  // Reusable active-id buffers for loops that can kill entities mid-iteration.
  // Each call site owns a dedicated buffer so the reuse can never alias a
  // concurrently-iterated one; none of these loops nest inside each other.
  private readonly meleeIdScratch: EntityId[] = [];
  private readonly rules: ResolvedBattleRules;
  private trainingRules: ResolvedTrainingRules;
  private stepMetrics: SimulationMetricsSnapshot = createSimulationMetrics();
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
  private passivesInitialized = false;

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
    this.knockbackSystem = new KnockbackSystem(
      this.world,
      this.externalImpulse,
      () => this.tickValue
    );
    this.damageSystem = new DamageSystem(this.world, {
      getTick: () => this.tickValue,
      friendlyFireEnabled: () => this.rules.friendlyFire,
      damageIsPrevented: (targetId) => this.trainingRules.enabled
        && (!this.trainingRules.damageEnabled
          || this.trainingRules.invulnerableTeams.has(this.world.getTeam(targetId))),
      clearExternalImpulse: (targetId) =>
        this.knockbackSystem.removeExternalImpulse(targetId)
    });
    this.commandSystem = new CommandSystem({
      isAlive: (entityId) => this.world.isAlive(entityId),
      isChanneling: (entityId) => this.abilitySystem.isSolarLaserChanneling(entityId),
      applyMove: (entityId, direction, facing) => this.movementSystem.applyMove(entityId, direction, facing),
      lockChannel: (entityId) => this.abilitySystem.lockSolarLaserCaster(entityId),
      stop: (entityId) => {
        const impulse = this.externalImpulse.get(entityId);
        this.world.vx[entityId] = impulse?.x ?? 0;
        this.world.vy[entityId] = impulse?.y ?? 0;
      },
      activatePrimaryAttack: (command, events) => this.activatePrimaryAttack(command, events),
      activateAbility: (command, events) => this.abilitySystem.activate(
        command,
        this.activeWeaponAttacks.has(command.entityId),
        events
      )
    });
    this.statusSystem = new StatusSystem(
      this.world,
      (sourceId, targetId, amount, element, events) =>
        this.damageSystem.dealDamage(sourceId, targetId, amount, element, events)
    );
    this.battleResultSystem = new BattleResultSystem(
      this.world,
      this.mode,
      this.rules.maxBattleTicks
    );
    this.arenaZones = new ArenaZoneSystem(
      this.world,
      this.arena,
      {
        getTick: () => this.tickValue,
        applyStatus: (sourceId, targetId, statusId, durationTicks, events) =>
          this.applyStatus(sourceId, targetId, statusId, durationTicks, events),
        dealDamage: (sourceId, targetId, amount, element, events) =>
          this.damageSystem.dealDamage(sourceId, targetId, amount, element, events)
      }
    );
    this.arenaCollisions = new ArenaCollisionSystem(
      this.world,
      this.arena,
      this.externalImpulse,
      {
        getTick: () => this.tickValue,
        dealDamage: (sourceId, targetId, amount, element, events) =>
          this.damageSystem.dealDamage(sourceId, targetId, amount, element, events)
      }
    );
    this.movementSystem = new MovementSystem(
      this.world,
      this.arenaZones,
      this.activeCasts,
      this.activeWeaponAttacks,
      this.externalImpulse,
      this.explicitFacingThisTick
    );
    this.cooldownSystem = new CooldownSystem(
      this.world,
      () => this.tickValue,
      () => this.trainingRules.cooldownsEnabled
    );
    this.snapshotSystem = new SnapshotSystem(
      this.world,
      this.mode,
      this.arenaCollisions
    );
    this.projectileSystem = new ProjectileSystem(
      this.world,
      this.arena,
      this.spatial,
      this.arenaCollisions,
      {
        getTick: () => this.tickValue,
        getMetrics: () => this.stepMetrics,
        getMaxEntityRadius: () => this.maxEntityRadius,
        primaryElement: (sourceId) => this.primaryElement(sourceId),
        dealDamage: (sourceId, targetId, amount, element, events) =>
          this.damageSystem.dealDamage(sourceId, targetId, amount, element, events),
        applyKnockback: (sourceId, targetId, magnitude, events, kind) =>
          this.knockbackSystem.applyKnockback(sourceId, targetId, magnitude, events, kind),
        applyKnockbackFromPoint: (
          sourceId,
          origin,
          targetId,
          magnitude,
          events,
          kind,
          fallbackDirection,
          impulseOptions
        ) => this.knockbackSystem.applyKnockbackFromPoint(
          sourceId,
          origin,
          targetId,
          magnitude,
          events,
          kind,
          fallbackDirection,
          impulseOptions
        ),
        applyStatus: (sourceId, targetId, statusId, durationTicks, events, stacks) =>
          this.applyStatus(sourceId, targetId, statusId, durationTicks, events, stacks),
        triggerPrimaryHitPassive: (
          sourceId,
          targetId,
          impact,
          normal,
          abilityId,
          events
        ) => this.abilitySystem.triggerPassives(
          sourceId,
          'ON_PRIMARY_HIT',
          { self: sourceId, target: targetId, impact, normal, abilityId },
          events
        ),
        damageScaledImpulse: (baseImpulse, damage) =>
          this.knockbackSystem.damageScaledImpulse(baseImpulse, damage),
        explosionImpulseOptions: (damage, abilityId) =>
          this.knockbackSystem.explosionImpulseOptions(damage, abilityId)
      }
    );
    this.abilitySystem = new AbilitySystem(
      this.world,
      this.arenaCollisions,
      this.cooldownSystem,
      this.projectileSystem,
      this.activeCasts,
      this.armedAbilities,
      {
        getTick: () => this.tickValue,
        dealDamage: (sourceId, targetId, amount, element, events) =>
          this.damageSystem.dealDamage(sourceId, targetId, amount, element, events),
        applyStatus: (sourceId, targetId, statusId, durationTicks, events, stacks) =>
          this.applyStatus(sourceId, targetId, statusId, durationTicks, events, stacks),
        applyKnockback: (sourceId, targetId, magnitude, events, kind, options) =>
          this.knockbackSystem.applyKnockback(sourceId, targetId, magnitude, events, kind, options),
        applyKnockbackFromPoint: (
          sourceId,
          origin,
          targetId,
          magnitude,
          events,
          kind,
          fallbackDirection,
          options
        ) => this.knockbackSystem.applyKnockbackFromPoint(
          sourceId,
          origin,
          targetId,
          magnitude,
          events,
          kind,
          fallbackDirection,
          options
        ),
        addExternalImpulse: (targetId, x, y, options) =>
          this.knockbackSystem.addExternalImpulse(targetId, x, y, options),
        removeExternalImpulse: (entityId) => this.knockbackSystem.removeExternalImpulse(entityId),
        damageScaledImpulse: (baseImpulse, damage) =>
          this.knockbackSystem.damageScaledImpulse(baseImpulse, damage),
        explosionImpulseOptions: (damage, abilityId) =>
          this.knockbackSystem.explosionImpulseOptions(damage, abilityId)
      }
    );
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
    if (!this.trainingRules.cooldownsEnabled) this.cooldownSystem.clearAll();
    this.snapshotSystem.invalidate();
  }

  /**
   * Allocation-stable snapshot for the live browser loop. The returned object
   * and all nested arrays/objects are reused and mutated on the next call.
   * Use getSnapshot() whenever immutable historical state is required.
   */
  getRuntimeSnapshot(): WorldSnapshot {
    return this.snapshotSystem.getRuntimeSnapshot(
      this.snapshotContext(),
      this.projectileSystem.states()
    );
  }

  getSnapshot(): WorldSnapshot {
    return this.snapshotSystem.getSnapshot(
      this.snapshotContext(),
      this.projectileSystem.states()
    );
  }

  private snapshotContext(): SnapshotContext {
    return {
      tick: this.tickValue,
      seed: this.battle.seed,
      arenaId: this.arena.id,
      modeId: this.mode.id,
      battleEnded: this.battleEndedValue,
      winningTeam: this.winningTeamValue,
      result: this.resultValue,
      activeCasts: this.activeCasts,
      armedAbilities: this.armedAbilities,
      activeWeaponAttacks: this.activeWeaponAttacks,
      metrics: this.stepMetrics
    };
  }

  step(commands: readonly SimulationCommand[]): SimulationEvent[] {
    if (this.battleEndedValue) return [];
    this.snapshotSystem.invalidate();
    this.tickValue += 1;
    this.stepMetrics = createSimulationMetrics(this.world.activeCount());
    const events: SimulationEvent[] = [];
    if (!this.passivesInitialized) {
      this.passivesInitialized = true;
      this.abilitySystem.triggerBattleStartPassives(events);
    }
    this.world.copyPreviousTransforms();
    this.explicitFacingThisTick.clear();

    this.statusSystem.tick(events);
    this.tickWeaponAttacks(events);
    this.abilitySystem.tickCasts(events);
    this.projectileSystem.tickPendingLaunches(events);
    this.abilitySystem.expireArmedAbilities();
    this.stepMetrics.commandsProcessed = this.commandSystem.process(commands, events);
    this.arenaZones.update(events);
    this.movementSystem.integrate();
    this.rebuildSpatialIndex();
    this.projectileSystem.update(events);
    this.arenaCollisions.resolveBounds(events);
    this.arenaCollisions.resolveObstacleCollisions(events);
    this.resolveEntityCollisions(events);
    this.abilitySystem.enforceSolarLaserLocks();
    this.recoverInvalidNumericState();
    const battleEnd = this.battleResultSystem.evaluate(
      this.tickValue,
      this.trainingRules.enabled && this.trainingRules.suppressVictory
    );
    if (battleEnd) this.endBattle(battleEnd.winningTeam, battleEnd.reason, events);
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
    const fighter = getFighter(participant.fighterId);
    const spawnRadius = fighter.physics.radius * (participant.statScale?.radius ?? 1);
    if (zone) {
      const usage = zoneUsage.get(zone.id) ?? 0;
      zoneUsage.set(zone.id, usage + 1);
      const padding = spawnRadius + 10;
      const spacing = spawnRadius * 2 + 18;
      const usableWidth = Math.max(1, zone.width - padding * 2);
      const columns = Math.max(1, Math.floor(usableWidth / spacing) + 1);
      const row = Math.floor(usage / columns);
      const column = usage % columns;
      const jitterLimit = Math.min(6, Math.max(0, (spacing - spawnRadius * 2) * 0.25));
      const jitterX = this.rng.range(-jitterLimit, jitterLimit);
      const jitterY = this.rng.range(-jitterLimit, jitterLimit);
      return {
        x: zone.x + Math.min(zone.width - padding, padding + column * spacing) + jitterX,
        y: zone.y + Math.min(zone.height - padding, padding + row * spacing) + jitterY
      };
    }

    const centerX = this.arena.width / 2;
    const centerY = this.arena.height / 2;
    const orbitRadius = Math.max(spawnRadius + 8, Math.min(this.arena.width, this.arena.height) * 0.32 - spawnRadius);
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: centerX + Math.cos(angle) * orbitRadius, y: centerY + Math.sin(angle) * orbitRadius };
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
      const position = { x: (this.world.x[a]! + this.world.x[b]!) / 2, y: (this.world.y[a]! + this.world.y[b]!) / 2 };
      if (magnitude > 0.05) events.push({ type: 'impact', tick: this.tickValue, a, b, position, magnitude, relativeSpeed });

      // Contact always transfers momentum, but it never causes health damage by itself.
      // Damage is only produced by an explicitly armed collision ability or another
      // declared gameplay source such as a projectile, blast, weapon, or hazard.
      const hostileContact = !sameTeam || this.rules.friendlyFire;
      if (hostileContact && magnitude > 0.05 && this.world.isAlive(a) && this.world.isAlive(b)) {
        this.abilitySystem.triggerCollisionAbilities({ self: a, target: b, impact: magnitude, normal: { x: nx, y: ny } }, events);
        this.abilitySystem.triggerCollisionAbilities({ self: b, target: a, impact: magnitude, normal: { x: -nx, y: -ny } }, events);
      }
    });
  }

  private activatePrimaryAttack(command: ActivatePrimaryAttackCommand, events: SimulationEvent[]): void {
    if (this.activeCasts.has(command.entityId) || this.activeWeaponAttacks.has(command.entityId)) return;
    const fighter = getFighter(this.world.getFighterId(command.entityId));
    const attack = getPrimaryAttack(fighter.primaryAttackId);
    if (!this.cooldownSystem.isPrimaryReady(command.entityId, attack.id)) return;
    const target = command.targetId !== undefined && this.world.isAlive(command.targetId) ? command.targetId : null;
    const direction = this.abilitySystem.resolveDirection(command.entityId, target, command.direction);
    if (!this.primaryAttackIsValid(command.entityId, attack, target, direction)) return;
    this.cooldownSystem.startPrimary(command.entityId, attack);
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
    // Player-controlled fighters fire their Basic on demand: a ranged Basic
    // always launches toward the aim direction and a valid enemy target is never
    // rejected for range/angle/line-of-sight. Range gating stays AI-only, so
    // AI-vs-AI simulation/replay checksums are unchanged.
    const isPlayer = this.world.getController(self) === 'player';
    const areaBehavior = ['spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior);
    if (!areaBehavior && target === null) return isPlayer;
    if (target === null) return true;
    if (!this.world.isAlive(target) || this.world.getTeam(target) === this.world.getTeam(self)) return false;
    if (isPlayer) return true;
    const dx = (this.world.x[target] ?? 0) - (this.world.x[self] ?? 0);
    const dy = (this.world.y[target] ?? 0) - (this.world.y[self] ?? 0);
    const distance = Math.hypot(dx, dy);
    const effectiveMaximum = attack.behavior === 'melee' || attack.behavior === 'spin' || attack.behavior === 'continuous' || attack.behavior === 'orbit' || attack.behavior === 'slam'
      ? (this.world.radius[self] ?? 0) + attack.range + (this.world.radius[target] ?? 0)
      : attack.range;
    if (distance < attack.minRange || distance > effectiveMaximum) return false;
    if (['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior) && !this.abilitySystem.hasLineOfSight(self, target)) return false;
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
            this.projectileSystem.spawn(source, weapon, state.direction, events, state.shotsFired, burstCount, state.targetId);
            state.shotsFired += 1;
          }
          state.executed = state.shotsFired >= burstCount;
        } else if (!state.executed || ['continuous', 'spin', 'orbit'].includes(weapon.behavior)) {
          if (weapon.behavior === 'throwable') {
            if (!state.executed) this.projectileSystem.spawn(source, weapon, state.direction, events, 0, 1, state.targetId);
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
      const loadout = this.world.getLoadout(source);
      const damage = weapon.damage * loadout.primaryDamageMultiplier;
      const knockback = weapon.knockback * loadout.primaryKnockbackMultiplier;
      this.damageSystem.dealDamage(source, target, damage, this.primaryElement(source), events);
      if (this.world.isAlive(target)) {
        this.knockbackSystem.applyKnockback(source, target, knockback, events, 'weapon');
        for (const status of weapon.onHitStatuses ?? []) this.applyStatus(source, target, status.statusId, status.durationTicks, events, status.stacks ?? 1);
      }
      events.push({ type: 'weaponHit', tick: this.tickValue, sourceId: source, targetId: target, weaponId: weapon.id, position: { x: this.world.x[target] ?? 0, y: this.world.y[target] ?? 0 }, damage, knockback });
      this.abilitySystem.triggerPassives(source, 'ON_PRIMARY_HIT', { self: source, target, impact: knockback, normal: direction, abilityId: weapon.id }, events);
      if (!['spin', 'continuous', 'orbit', 'slam'].includes(weapon.behavior)) break;
    }
  }

  private applyStatus(sourceId: EntityId, targetId: EntityId, statusId: string, durationTicks: number, events: SimulationEvent[], stacks = 1): void {
    if (!this.world.isAlive(targetId)) return;
    if (statusId === 'wet') this.world.removeStatus(targetId, 'burn');
    const durationMultiplier = this.world.isAlive(sourceId)
      ? this.world.getLoadout(sourceId).statusDurationMultiplier[statusId] ?? 1
      : 1;
    const resolvedDuration = Math.max(1, Math.round(durationTicks * durationMultiplier));
    const applied = this.world.applyStatus(targetId, statusId, resolvedDuration, sourceId, stacks);
    if (!applied) return;
    events.push({ type: 'statusApplied', tick: this.tickValue, sourceId, targetId, statusId, durationTicks: resolvedDuration, stacks: applied.stacks });
  }

  private primaryElement(id: EntityId): Element {
    return getFighter(this.world.getFighterId(id)).classification.elements[0] ?? 'neutral';
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

    this.projectileSystem.recoverInvalidNumericState();
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
