import type {
  GameModeDefinition,
  ProjectileSourceDefinition
} from '@kinetic/content';
import type {
  ArenaObstacleSnapshot,
  BattleObjectiveSnapshot,
  BattleResultSnapshot,
  EntityId,
  ProjectileSnapshot,
  SimulationMetricsSnapshot,
  TeamId,
  WorldSnapshot
} from '@kinetic/protocol';
import type {
  ActiveCastState,
  ActiveWeaponAttackState,
  ArmedAbilityState,
  World
} from '../world';
import type { ArenaCollisionSystem } from '../systems/ArenaCollisionSystem';

export interface SnapshotProjectileState {
  id: number;
  sourceId: EntityId;
  team: TeamId;
  weapon: ProjectileSourceDefinition;
  targetId: EntityId | null;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  fuseRemainingTicks: number;
  totalTicks: number;
  ageTicks: number;
}

export interface SnapshotContext {
  tick: number;
  seed: number;
  arenaId: string;
  modeId: string;
  battleEnded: boolean;
  winningTeam: TeamId | null;
  result: BattleResultSnapshot | null;
  activeCasts: ReadonlyMap<EntityId, ActiveCastState>;
  armedAbilities: ReadonlyMap<EntityId, ReadonlyMap<string, ArmedAbilityState>>;
  activeWeaponAttacks: ReadonlyMap<EntityId, ActiveWeaponAttackState>;
  metrics: SimulationMetricsSnapshot;
}

/**
 * Builds immutable and allocation-stable runtime snapshots from authoritative
 * simulation state. The live snapshot reuses nested arrays and objects, while
 * getSnapshot keeps its historical immutable cache behavior.
 */
export class SnapshotSystem {
  private snapshotCache: WorldSnapshot | null = null;
  private readonly runtimeObstacleSnapshots: ArenaObstacleSnapshot[] = [];
  private readonly runtimeProjectileSnapshots: ProjectileSnapshot[] = [];
  private readonly runtimeObjectiveSnapshot: BattleObjectiveSnapshot = {
    kind: 'elimination',
    label: 'Last team standing',
    progress: 0,
    remainingTicks: null
  };
  private readonly runtimeMetricsSnapshot: SimulationMetricsSnapshot = {
    activeEntities: 0,
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

  constructor(
    private readonly world: World,
    private readonly mode: GameModeDefinition,
    private readonly arenaCollisions: ArenaCollisionSystem
  ) {}

  invalidate(): void {
    this.snapshotCache = null;
  }

  getRuntimeSnapshot(
    context: SnapshotContext,
    projectiles: readonly SnapshotProjectileState[]
  ): WorldSnapshot {
    this.arenaCollisions.updateRuntimeSnapshots(this.runtimeObstacleSnapshots);
    this.updateRuntimeProjectileSnapshots(projectiles);
    this.updateRuntimeObjectiveSnapshot(context.tick);
    this.copyRuntimeMetrics(context.metrics);

    return this.world.runtimeSnapshot(
      context.tick,
      context.seed,
      context.arenaId,
      context.modeId,
      context.battleEnded,
      context.winningTeam,
      context.result,
      context.activeCasts,
      context.armedAbilities,
      context.activeWeaponAttacks,
      this.runtimeObstacleSnapshots,
      this.runtimeProjectileSnapshots,
      this.runtimeObjectiveSnapshot,
      this.runtimeMetricsSnapshot
    );
  }

  getSnapshot(
    context: SnapshotContext,
    projectiles: readonly SnapshotProjectileState[]
  ): WorldSnapshot {
    if (this.snapshotCache) return this.snapshotCache;

    this.snapshotCache = this.world.snapshot(
      context.tick,
      context.seed,
      context.arenaId,
      context.modeId,
      context.battleEnded,
      context.winningTeam,
      context.result,
      context.activeCasts,
      context.armedAbilities,
      context.activeWeaponAttacks,
      this.arenaCollisions.snapshots(),
      this.projectileSnapshots(projectiles),
      this.objectiveSnapshot(context.tick),
      context.metrics
    );
    return this.snapshotCache;
  }

  private updateRuntimeProjectileSnapshots(
    projectiles: readonly SnapshotProjectileState[]
  ): void {
    let index = 0;
    for (const projectile of projectiles) {
      if (!projectile.alive) continue;
      const definition = projectile.weapon.projectile!;
      const progress = Math.max(
        0,
        Math.min(1, projectile.ageTicks / Math.max(1, projectile.totalTicks))
      );
      const arcHeight = projectile.weapon.behavior === 'throwable'
        ? Math.sin(Math.min(1, progress * 1.55) * Math.PI)
          * Math.max(18, definition.gravity * 720)
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
      target.rotation = Math.atan2(projectile.vy, projectile.vx)
        + projectile.ageTicks
          * (projectile.weapon.behavior === 'throwable' ? 0.18 : 0);

      if (projectile.targetId !== null) target.targetId = projectile.targetId;
      else delete target.targetId;
      if (definition.trailStyle) target.trailStyle = definition.trailStyle;
      else delete target.trailStyle;

      this.runtimeProjectileSnapshots[index] = target;
      index += 1;
    }
    this.runtimeProjectileSnapshots.length = index;
  }

  private updateRuntimeObjectiveSnapshot(tick: number): void {
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
      target.progress = Math.min(1, tick / duration);
      target.remainingTicks = Math.max(0, duration - tick);
      return;
    }

    target.kind = 'elimination';
    target.label = 'Last team standing';
    target.progress = 0;
    target.remainingTicks = null;
  }

  private copyRuntimeMetrics(source: SimulationMetricsSnapshot): void {
    const target = this.runtimeMetricsSnapshot;
    target.activeEntities = this.world.activeCount();
    target.commandsProcessed = source.commandsProcessed;
    target.candidatePairs = source.candidatePairs;
    target.contactsResolved = source.contactsResolved;
    target.sameTeamContacts = source.sameTeamContacts;
    target.occupiedBroadphaseCells = source.occupiedBroadphaseCells;
    target.maxBroadphaseBucket = source.maxBroadphaseBucket;
    target.projectileEntityChecks = source.projectileEntityChecks;
    target.projectileObstacleChecks = source.projectileObstacleChecks;
    target.invalidNumericStates = source.invalidNumericStates;
  }

  private projectileSnapshots(
    projectiles: readonly SnapshotProjectileState[]
  ): ProjectileSnapshot[] {
    return projectiles
      .filter((projectile) => projectile.alive)
      .map((projectile) => {
        const definition = projectile.weapon.projectile!;
        const progress = Math.max(
          0,
          Math.min(1, projectile.ageTicks / Math.max(1, projectile.totalTicks))
        );
        const arcHeight = projectile.weapon.behavior === 'throwable'
          ? Math.sin(Math.min(1, progress * 1.55) * Math.PI)
            * Math.max(18, definition.gravity * 720)
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
          rotation: Math.atan2(projectile.vy, projectile.vx)
            + projectile.ageTicks
              * (projectile.weapon.behavior === 'throwable' ? 0.18 : 0),
          ...(projectile.targetId !== null
            ? { targetId: projectile.targetId }
            : {}),
          ...(definition.trailStyle
            ? { trailStyle: definition.trailStyle }
            : {})
        };
      });
  }

  private objectiveSnapshot(tick: number): BattleObjectiveSnapshot {
    if (this.mode.victory === 'DEFEAT_BOSS') {
      const bossTeam = this.mode.bossTeam ?? 2;
      const bossEntities = this.world
        .activeIds()
        .filter((id) => this.world.getTeam(id) === bossTeam);
      const bossMax = bossEntities.reduce(
        (sum, id) => sum + (this.world.maxHp[id] ?? 0),
        0
      );
      const bossHp = bossEntities.reduce(
        (sum, id) => sum + (this.world.hp[id] ?? 0),
        0
      );
      return {
        kind: 'boss',
        label: 'Destroy the boss',
        progress: bossMax > 0 ? 1 - bossHp / bossMax : 1,
        remainingTicks: null
      };
    }

    if (this.mode.victory === 'SURVIVE_TICKS') {
      const duration = this.mode.durationTicks ?? 2700;
      return {
        kind: 'survival',
        label: 'Survive the foundry',
        progress: Math.min(1, tick / duration),
        remainingTicks: Math.max(0, duration - tick)
      };
    }

    return {
      kind: 'elimination',
      label: 'Last team standing',
      progress: 0,
      remainingTicks: null
    };
  }
}
