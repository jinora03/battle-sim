import {
  CONTENT_VERSION,
  getArena,
  getFighter,
  getGameMode
} from '@kinetic/content';
import type {
  BattleDefinition,
  BattleEndReason,
  BattleResultSnapshot,
  BattleRules,
  Element,
  EntityId,
  SimulationCommand,
  SimulationEvent,
  SimulationMetricsSnapshot,
  TeamId,
  TrainingBattleRules,
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
import { FighterCollisionSystem } from './systems/FighterCollisionSystem';
import { NumericStateRecoverySystem } from './systems/NumericStateRecoverySystem';
import { ParticipantSpawnSystem } from './systems/ParticipantSpawnSystem';
import { PrimaryAttackSystem } from './systems/PrimaryAttackSystem';
import { CombatResourceSystem } from './systems/CombatResourceSystem';
import { ModuleEffectSystem } from './systems/ModuleEffectSystem';

export const ENGINE_VERSION = '1.3.19-stage8.7c3';
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
  private readonly combatResourceSystem: CombatResourceSystem;
  private readonly moduleEffectSystem: ModuleEffectSystem;
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
  private readonly primaryAttackSystem: PrimaryAttackSystem;
  private readonly fighterCollisionSystem: FighterCollisionSystem;
  private readonly numericStateRecoverySystem: NumericStateRecoverySystem;
  private readonly participantSpawnSystem: ParticipantSpawnSystem;
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
    this.combatResourceSystem = new CombatResourceSystem(this.world, {
      getTick: () => this.tickValue,
      tickRate: SIM_TICK_RATE
    });
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
        this.knockbackSystem.removeExternalImpulse(targetId),
      onDamageDealt: (sourceId, amount, element) =>
        this.combatResourceSystem.recordDamageDealt(sourceId, amount, element)
    });
    this.statusSystem = new StatusSystem(
      this.world,
      (sourceId, targetId, amount, element, events) =>
        this.damageSystem.dealDamage(sourceId, targetId, amount, element, events)
    );
    this.moduleEffectSystem = new ModuleEffectSystem(this.world, {
      getTick: () => this.tickValue,
      applyStatus: (sourceId, targetId, statusId, durationTicks, events, stacks) =>
        this.applyStatus(sourceId, targetId, statusId, durationTicks, events, stacks)
    });
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
        modifyResource: (entityId, resourceId, amount) =>
          this.combatResourceSystem.modify(entityId, resourceId, amount),
        damageScaledImpulse: (baseImpulse, damage) =>
          this.knockbackSystem.damageScaledImpulse(baseImpulse, damage),
        explosionImpulseOptions: (damage, abilityId) =>
          this.knockbackSystem.explosionImpulseOptions(damage, abilityId)
      }
    );
    this.primaryAttackSystem = new PrimaryAttackSystem(
      this.world,
      this.cooldownSystem,
      this.projectileSystem,
      this.abilitySystem,
      this.damageSystem,
      this.knockbackSystem,
      this.activeCasts,
      this.activeWeaponAttacks,
      {
        getTick: () => this.tickValue,
        applyStatus: (sourceId, targetId, statusId, durationTicks, events, stacks) =>
          this.applyStatus(sourceId, targetId, statusId, durationTicks, events, stacks)
      }
    );
    this.fighterCollisionSystem = new FighterCollisionSystem(
      this.world,
      this.spatial,
      this.externalImpulse,
      {
        getTick: () => this.tickValue,
        getMetrics: () => this.stepMetrics,
        getTeamCollisionMode: () => this.rules.teamCollision,
        getTeamCollisionScale: () => this.rules.teamCollisionScale,
        friendlyFireEnabled: () => this.rules.friendlyFire,
        triggerCollisionAbility: (self, target, impact, normal, events) =>
          this.abilitySystem.triggerCollisionAbilities({ self, target, impact, normal }, events)
      }
    );
    this.numericStateRecoverySystem = new NumericStateRecoverySystem(
      this.world,
      this.arena,
      this.projectileSystem
    );
    this.participantSpawnSystem = new ParticipantSpawnSystem(
      this.world,
      this.arena,
      this.rng
    );
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
      activatePrimaryAttack: (command, events) => this.primaryAttackSystem.activate(command, events),
      activateAbility: (command, events) => this.abilitySystem.activate(
        command,
        this.activeWeaponAttacks.has(command.entityId),
        events
      )
    });
    this.maxEntityRadius = this.participantSpawnSystem.spawn(this.battle.participants);
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
    this.combatResourceSystem.tick();
    this.moduleEffectSystem.tick(events);
    this.primaryAttackSystem.tick(events);
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
    this.fighterCollisionSystem.resolve(events);
    this.abilitySystem.enforceSolarLaserLocks();
    this.numericStateRecoverySystem.recover(this.stepMetrics);
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

  private applyStatus(sourceId: EntityId, targetId: EntityId, statusId: string, durationTicks: number, events: SimulationEvent[], stacks = 1): void {
    if (!this.world.isAlive(targetId)) return;
    if (statusId === 'wet') this.world.removeStatus(targetId, 'burn');
    const sourceLoadout = this.world.isAlive(sourceId)
      ? this.world.getLoadout(sourceId)
      : null;
    const durationMultiplier = sourceLoadout?.statusDurationMultiplier[statusId] ?? 1;
    const bonusStacks = sourceId !== targetId
      ? sourceLoadout?.statusStacksAppliedBonus[statusId] ?? 0
      : 0;
    const resolvedStacks = Math.max(1, stacks + bonusStacks);
    const resolvedDuration = Math.max(1, Math.round(durationTicks * durationMultiplier));
    const previousStacks = this.world.getStatusStacks(targetId, statusId);
    const applied = this.world.applyStatus(targetId, statusId, resolvedDuration, sourceId, resolvedStacks);
    if (!applied) return;
    const addedStacks = Math.max(0, applied.stacks - previousStacks);
    if (addedStacks > 0) this.combatResourceSystem.recordStatusApplied(sourceId, targetId, statusId, addedStacks);
    events.push({ type: 'statusApplied', tick: this.tickValue, sourceId, targetId, statusId, durationTicks: resolvedDuration, stacks: applied.stacks });
  }

  private primaryElement(id: EntityId): Element {
    return getFighter(this.world.getFighterId(id)).classification.elements[0] ?? 'neutral';
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
