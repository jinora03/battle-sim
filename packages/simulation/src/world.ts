import { getAbility, getFighter, getPrimaryAttack, getStatus } from '@kinetic/content';
import type { AbilitySlot, AbilityStateSnapshot, ArenaObstacleSnapshot, BattleObjectiveSnapshot, BattleParticipant, BattleResultSnapshot, ControllerKind, Element, EntityId, EntitySnapshot, ProjectileSnapshot, SimulationMetricsSnapshot, StatusStateSnapshot, TeamId, Vec2, WeaponAttackPhase, WeaponAttackStateSnapshot, WeaponCategory, WorldSnapshot } from '@kinetic/protocol';
import type { SeededRng } from './rng';

const SNAPSHOT_SKILL_SLOTS: readonly AbilitySlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];


export interface ActiveCastState {
  abilityId: string;
  slot: AbilitySlot;
  targetId: EntityId | null;
  direction: Vec2;
  remainingTicks: number;
  totalTicks: number;
  anchorX: number;
  anchorY: number;
}

export interface ArmedAbilityState {
  abilityId: string;
  expiresTick: number;
  totalTicks: number;
}


export interface ActiveWeaponAttackState {
  weaponId: string;
  category: WeaponCategory;
  style: string;
  phase: WeaponAttackPhase;
  targetId: EntityId | null;
  direction: Vec2;
  remainingTicks: number;
  totalTicks: number;
  executed: boolean;
  shotsFired: number;
  hitTargetIds: Set<EntityId>;
}

export interface ActiveStatus {
  id: string;
  remainingTicks: number;
  sourceId: EntityId | null;
  pulseCountdown: number;
}


interface ReusableEntitySnapshotSlot {
  entity: EntitySnapshot;
  castDirections: Vec2[];
  weaponAttack: WeaponAttackStateSnapshot;
}

export class World {
  readonly maxEntities: number;
  private nextEntityId = 0;
  private readonly activeIdList: EntityId[] = [];

  readonly alive: Uint8Array;
  readonly team: Int16Array;
  private readonly controller: Array<ControllerKind>;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly rotation: Float64Array;
  readonly radius: Float64Array;
  readonly mass: Float64Array;
  readonly restitution: Float64Array;
  readonly damping: Float64Array;
  readonly maxSpeed: Float64Array;
  readonly moveAcceleration: Float64Array;
  readonly damageScale: Float64Array;
  readonly hp: Float64Array;
  readonly maxHp: Float64Array;

  private readonly fighterId: Array<string | null>;
  private readonly statuses = new Map<EntityId, Map<string, ActiveStatus>>();
  private readonly cooldownReadyTick = new Map<EntityId, Map<string, number>>();
  private readonly activeZoneIds = new Map<EntityId, Set<string>>();

  /**
   * Internal browser-runtime snapshot storage. These objects are mutated in place
   * and must never escape as the public immutable snapshot API.
   */
  private readonly reusableEntitySlots: ReusableEntitySnapshotSlot[] = [];
  private readonly reusableRuntimeSnapshot: WorldSnapshot = {
    tick: 0,
    seed: 0,
    arenaId: '',
    modeId: '',
    entities: [],
    obstacles: [],
    projectiles: [],
    objective: { kind: 'elimination', label: 'Eliminate opponents', progress: 0, remainingTicks: null },
    battleEnded: false,
    winningTeam: null,
    result: null,
    metrics: {
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
    }
  };

  constructor(maxEntities = 2048) {
    this.maxEntities = maxEntities;
    this.alive = new Uint8Array(maxEntities);
    this.team = new Int16Array(maxEntities);
    this.controller = Array.from({ length: maxEntities }, () => 'ai' as ControllerKind);
    this.x = new Float64Array(maxEntities);
    this.y = new Float64Array(maxEntities);
    this.prevX = new Float64Array(maxEntities);
    this.prevY = new Float64Array(maxEntities);
    this.vx = new Float64Array(maxEntities);
    this.vy = new Float64Array(maxEntities);
    this.rotation = new Float64Array(maxEntities);
    this.radius = new Float64Array(maxEntities);
    this.mass = new Float64Array(maxEntities);
    this.restitution = new Float64Array(maxEntities);
    this.damping = new Float64Array(maxEntities);
    this.maxSpeed = new Float64Array(maxEntities);
    this.moveAcceleration = new Float64Array(maxEntities);
    this.damageScale = new Float64Array(maxEntities);
    this.hp = new Float64Array(maxEntities);
    this.maxHp = new Float64Array(maxEntities);
    this.fighterId = Array.from({ length: maxEntities }, () => null);
  }

  spawn(participant: BattleParticipant, x: number, y: number, rng: SeededRng): EntityId {
    if (this.nextEntityId >= this.maxEntities) throw new Error(`Entity capacity ${this.maxEntities} exceeded`);
    const id = this.nextEntityId++;
    const fighter = getFighter(participant.fighterId);

    const controller = participant.controller ?? 'ai';
    this.alive[id] = 1;
    this.team[id] = participant.team;
    this.controller[id] = controller;
    this.x[id] = this.prevX[id] = x;
    this.y[id] = this.prevY[id] = y;
    const angle = rng.range(0, Math.PI * 2);
    const initialSpeed = rng.range(1.2, 2.8);
    const startsMoving = controller === 'ai';
    this.vx[id] = startsMoving ? Math.cos(angle) * initialSpeed : 0;
    this.vy[id] = startsMoving ? Math.sin(angle) * initialSpeed : 0;
    this.rotation[id] = angle;
    const scale = participant.statScale ?? {};
    this.radius[id] = fighter.physics.radius * (scale.radius ?? 1);
    this.mass[id] = fighter.physics.mass * (scale.mass ?? 1);
    this.restitution[id] = fighter.physics.restitution;
    this.damping[id] = fighter.physics.linearDamping;
    this.maxSpeed[id] = fighter.physics.maxSpeed * (scale.speed ?? 1);
    this.moveAcceleration[id] = fighter.stats.moveAcceleration * (scale.speed ?? 1);
    this.damageScale[id] = scale.damage ?? 1;
    this.hp[id] = fighter.stats.maxHp * (scale.hp ?? 1);
    this.maxHp[id] = fighter.stats.maxHp * (scale.hp ?? 1);
    this.fighterId[id] = fighter.id;
    this.statuses.set(id, new Map());
    this.cooldownReadyTick.set(id, new Map());
    this.activeZoneIds.set(id, new Set());
    this.activeIdList.push(id);
    return id;
  }

  copyPreviousTransforms(): void {
    for (const id of this.activeIdList) {
      this.prevX[id] = this.x[id] ?? 0;
      this.prevY[id] = this.y[id] ?? 0;
    }
  }

  isAlive(id: EntityId): boolean {
    return id >= 0 && id < this.nextEntityId && this.alive[id] === 1;
  }

  kill(id: EntityId): void {
    if (!this.isAlive(id)) return;
    this.alive[id] = 0;
    this.hp[id] = 0;
    this.vx[id] = 0;
    this.vy[id] = 0;
    this.prevX[id] = this.x[id] ?? 0;
    this.prevY[id] = this.y[id] ?? 0;
    const activeIndex = this.activeIdList.indexOf(id);
    if (activeIndex >= 0) this.activeIdList.splice(activeIndex, 1);
  }



  stabilizeActive(): void {
    for (const id of this.activeIdList) {
      this.vx[id] = 0;
      this.vy[id] = 0;
      this.prevX[id] = this.x[id] ?? 0;
      this.prevY[id] = this.y[id] ?? 0;
    }
  }

  getFighterId(id: EntityId): string {
    const value = this.fighterId[id];
    if (!value) throw new Error(`Entity ${id} has no fighter definition`);
    return value;
  }

  getTeam(id: EntityId): TeamId {
    return this.team[id] ?? 0;
  }

  getController(id: EntityId): ControllerKind {
    return this.controller[id] ?? 'ai';
  }

  activeIds(): EntityId[] {
    return [...this.activeIdList];
  }

  activeIdsView(): readonly EntityId[] {
    return this.activeIdList;
  }

  /**
   * Refills `out` with the current active ids in stable ascending order and
   * returns it. Callers that mutate the active set while iterating (e.g. periodic
   * damage that can kill mid-loop) reuse a dedicated buffer instead of allocating
   * a fresh `[...activeIdList]` copy every tick. The copy is required for
   * iteration safety; `activeIdsView()` is for read-only, non-mutating loops.
   */
  copyActiveIdsInto(out: EntityId[]): EntityId[] {
    out.length = 0;
    for (const id of this.activeIdList) out.push(id);
    return out;
  }

  activeCount(): number {
    return this.activeIdList.length;
  }

  hasStatus(id: EntityId, statusId: string): boolean {
    return this.statuses.get(id)?.has(statusId) ?? false;
  }

  hasAnyStatus(id: EntityId): boolean {
    const map = this.statuses.get(id);
    return map !== undefined && map.size > 0;
  }

  applyStatus(id: EntityId, statusId: string, durationTicks: number, sourceId: EntityId | null): void {
    if (!this.isAlive(id)) return;
    const def = getStatus(statusId);
    const map = this.statuses.get(id) ?? new Map<string, ActiveStatus>();
    const previous = map.get(statusId);
    map.set(statusId, {
      id: statusId,
      remainingTicks: Math.max(previous?.remainingTicks ?? 0, durationTicks),
      sourceId,
      pulseCountdown: def.periodTicks ?? 0
    });
    this.statuses.set(id, map);
  }

  removeStatus(id: EntityId, statusId: string): void {
    this.statuses.get(id)?.delete(statusId);
  }

  getStatuses(id: EntityId): Map<string, ActiveStatus> {
    return this.statuses.get(id) ?? new Map();
  }

  getSpeedMultiplier(id: EntityId): number {
    const statuses = this.statuses.get(id);
    if (!statuses || statuses.size === 0) return 1;
    let multiplier = 1;
    for (const status of statuses.values()) multiplier *= getStatus(status.id).speedMultiplier ?? 1;
    return multiplier;
  }

  getMassMultiplier(id: EntityId): number {
    const statuses = this.statuses.get(id);
    if (!statuses || statuses.size === 0) return 1;
    let multiplier = 1;
    for (const status of statuses.values()) multiplier *= getStatus(status.id).massMultiplier ?? 1;
    return multiplier;
  }

  getEffectiveMass(id: EntityId): number {
    return (this.mass[id] ?? 1) * this.getMassMultiplier(id);
  }


  setActiveZones(id: EntityId, zoneIds: ReadonlySet<string>): void {
    this.activeZoneIds.set(id, new Set(zoneIds));
  }

  getActiveZoneIds(id: EntityId): ReadonlySet<string> {
    return this.activeZoneIds.get(id) ?? new Set<string>();
  }

  getCooldownReadyTick(id: EntityId, key: string): number {
    return this.cooldownReadyTick.get(id)?.get(key) ?? 0;
  }

  isCooldownReady(id: EntityId, key: string, tick: number): boolean {
    return this.getCooldownReadyTick(id, key) <= tick;
  }

  setCooldown(id: EntityId, key: string, readyTick: number): void {
    const map = this.cooldownReadyTick.get(id) ?? new Map<string, number>();
    map.set(key, readyTick);
    this.cooldownReadyTick.set(id, map);
  }

  isAbilityReady(id: EntityId, abilityId: string, tick: number): boolean {
    return this.isCooldownReady(id, `activate:${abilityId}`, tick);
  }

  setAbilityCooldown(id: EntityId, abilityId: string, readyTick: number): void {
    this.setCooldown(id, `activate:${abilityId}`, readyTick);
  }

  clearAbilityCooldowns(entityId?: EntityId): void {
    if (entityId !== undefined) {
      this.cooldownReadyTick.set(entityId, new Map());
      return;
    }
    for (const id of this.activeIdList) this.cooldownReadyTick.set(id, new Map());
  }

  getAbilityReadyTick(id: EntityId, abilityId: string): number {
    return this.cooldownReadyTick.get(id)?.get(`activate:${abilityId}`) ?? 0;
  }

  isPrimaryAttackReady(id: EntityId, primaryAttackId: string, tick: number): boolean {
    return this.isCooldownReady(id, `primary:${primaryAttackId}`, tick);
  }

  setPrimaryAttackCooldown(id: EntityId, primaryAttackId: string, readyTick: number): void {
    this.setCooldown(id, `primary:${primaryAttackId}`, readyTick);
  }

  getPrimaryAttackReadyTick(id: EntityId, primaryAttackId: string): number {
    return this.getCooldownReadyTick(id, `primary:${primaryAttackId}`);
  }

  /**
   * Updates a pooled snapshot used only by the live browser runtime.
   *
   * Unlike snapshot(), this method reuses the WorldSnapshot, entity, ability,
   * status and direction objects between ticks. Consumers must read it
   * synchronously and must not retain it as historical state.
   */
  runtimeSnapshot(
    tick: number,
    seed: number,
    arenaId: string,
    modeId: string,
    battleEnded: boolean,
    winningTeam: TeamId | null,
    result: BattleResultSnapshot | null,
    activeCasts: ReadonlyMap<EntityId, ActiveCastState>,
    armedAbilities: ReadonlyMap<EntityId, ReadonlyMap<string, ArmedAbilityState>>,
    weaponAttacks: ReadonlyMap<EntityId, ActiveWeaponAttackState>,
    obstacles: ArenaObstacleSnapshot[],
    projectiles: ProjectileSnapshot[],
    objective: BattleObjectiveSnapshot,
    metrics: SimulationMetricsSnapshot
  ): WorldSnapshot {
    const snapshot = this.reusableRuntimeSnapshot;
    const entities = snapshot.entities;
    let entityIndex = 0;

    for (const id of this.activeIdList) {
      const fighter = getFighter(this.getFighterId(id));
      const activeCast = activeCasts.get(id);
      const armed = armedAbilities.get(id);
      const weaponAttackState = weaponAttacks.get(id);
      const primaryAttack = getPrimaryAttack(fighter.primaryAttackId);
      const abilityCount = 1 + (fighter.abilitySlots.skill1 ? 1 : 0) + (fighter.abilitySlots.skill2 ? 1 : 0)
        + (fighter.abilitySlots.skill3 ? 1 : 0) + (fighter.abilitySlots.ultimate ? 1 : 0);
      const slot = this.ensureReusableEntitySlot(entityIndex, abilityCount);
      const entity = slot.entity;

      const fighterChanged = entity.fighterId !== fighter.id;
      entity.id = id;
      entity.fighterId = fighter.id;
      entity.team = this.getTeam(id);
      entity.controller = this.controller[id] ?? 'ai';
      entity.x = this.x[id] ?? 0;
      entity.y = this.y[id] ?? 0;
      entity.prevX = this.prevX[id] ?? 0;
      entity.prevY = this.prevY[id] ?? 0;
      entity.vx = this.vx[id] ?? 0;
      entity.vy = this.vy[id] ?? 0;
      entity.rotation = this.rotation[id] ?? 0;
      entity.radius = this.radius[id] ?? fighter.physics.radius;
      entity.mass = this.getEffectiveMass(id);
      entity.hp = this.hp[id] ?? 0;
      entity.maxHp = this.maxHp[id] ?? fighter.stats.maxHp;
      entity.alive = true;
      entity.primaryAttackId = fighter.primaryAttackId;
      entity.weaponId = fighter.primaryAttackId;

      if (fighterChanged) {
        entity.elements.length = 0;
        entity.elements.push(...fighter.classification.elements);
        entity.traits.length = 0;
        entity.traits.push(...fighter.classification.traits);
      }

      const activeZoneIds = entity.activeZoneIds;
      activeZoneIds.length = 0;
      for (const zoneId of this.getActiveZoneIds(id)) activeZoneIds.push(zoneId);
      activeZoneIds.sort();

      const statuses = entity.statuses;
      let statusIndex = 0;
      for (const status of this.getStatuses(id).values()) {
        const target = statuses[statusIndex] ?? ({ statusId: '', remainingTicks: 0 } satisfies StatusStateSnapshot);
        target.statusId = status.id;
        target.remainingTicks = status.remainingTicks;
        statuses[statusIndex] = target;
        statusIndex += 1;
      }
      statuses.length = statusIndex;
      statuses.sort((a, b) => a.statusId.localeCompare(b.statusId));

      const primaryReadyTick = this.getPrimaryAttackReadyTick(id, primaryAttack.id);
      const primaryCooldownRemaining = Math.max(0, primaryReadyTick - tick);
      const primaryState = weaponAttackState?.weaponId === primaryAttack.id ? weaponAttackState : null;
      const primaryAbility = entity.abilities[0]!;
      const primaryDirection = slot.castDirections[0]!;
      primaryAbility.slot = 'basic';
      primaryAbility.source = 'primaryAttack';
      primaryAbility.abilityId = primaryAttack.id;
      primaryAbility.phase = primaryState?.phase === 'windup' ? 'casting' : primaryCooldownRemaining > 0 ? 'cooldown' : 'ready';
      primaryAbility.cooldownRemainingTicks = primaryCooldownRemaining;
      primaryAbility.cooldownTotalTicks = primaryAttack.cooldownTicks;
      primaryAbility.castRemainingTicks = primaryState?.phase === 'windup' ? primaryState.remainingTicks : 0;
      primaryAbility.castTotalTicks = primaryAttack.windupTicks;
      if (primaryState) {
        primaryDirection.x = primaryState.direction.x;
        primaryDirection.y = primaryState.direction.y;
        primaryAbility.castDirection = primaryDirection;
      } else {
        primaryAbility.castDirection = null;
      }
      primaryAbility.armedRemainingTicks = 0;
      primaryAbility.armedTotalTicks = 0;

      let abilityIndex = 1;
      for (const abilitySlot of SNAPSHOT_SKILL_SLOTS) {
        const abilityId = fighter.abilitySlots[abilitySlot];
        if (!abilityId) continue;
        const ability = getAbility(abilityId);
        const readyTick = this.getAbilityReadyTick(id, abilityId);
        const cooldownRemainingTicks = Math.max(0, readyTick - tick);
        const casting = activeCast?.abilityId === abilityId;
        const armedState = armed?.get(abilityId);
        const armedRemainingTicks = armedState ? Math.max(0, armedState.expiresTick - tick) : 0;
        const abilityState = entity.abilities[abilityIndex]!;
        const castDirection = slot.castDirections[abilityIndex]!;
        abilityState.slot = abilitySlot;
        abilityState.source = 'ability';
        abilityState.abilityId = abilityId;
        abilityState.phase = casting ? 'casting' : armedRemainingTicks > 0 ? 'armed' : cooldownRemainingTicks > 0 ? 'cooldown' : 'ready';
        abilityState.cooldownRemainingTicks = cooldownRemainingTicks;
        abilityState.cooldownTotalTicks = ability.cooldownTicks;
        abilityState.castRemainingTicks = casting ? activeCast!.remainingTicks : 0;
        abilityState.castTotalTicks = casting ? activeCast!.totalTicks : ability.castTicks;
        if (casting) {
          castDirection.x = activeCast!.direction.x;
          castDirection.y = activeCast!.direction.y;
          abilityState.castDirection = castDirection;
        } else {
          abilityState.castDirection = null;
        }
        abilityState.armedRemainingTicks = armedRemainingTicks;
        abilityState.armedTotalTicks = armedState?.totalTicks ?? 0;
        abilityIndex += 1;
      }
      entity.abilities.length = abilityIndex;

      if (weaponAttackState) {
        const weaponAttack = slot.weaponAttack;
        weaponAttack.weaponId = weaponAttackState.weaponId;
        weaponAttack.category = weaponAttackState.category;
        weaponAttack.style = weaponAttackState.style;
        weaponAttack.phase = weaponAttackState.phase;
        weaponAttack.direction.x = weaponAttackState.direction.x;
        weaponAttack.direction.y = weaponAttackState.direction.y;
        weaponAttack.remainingTicks = weaponAttackState.remainingTicks;
        weaponAttack.totalTicks = weaponAttackState.totalTicks;
        entity.weaponAttack = weaponAttack;
      } else {
        entity.weaponAttack = null;
      }

      entities[entityIndex] = entity;
      entityIndex += 1;
    }
    entities.length = entityIndex;

    snapshot.tick = tick;
    snapshot.seed = seed;
    snapshot.arenaId = arenaId;
    snapshot.modeId = modeId;
    snapshot.obstacles = obstacles;
    snapshot.projectiles = projectiles;
    snapshot.objective = objective;
    snapshot.battleEnded = battleEnded;
    snapshot.winningTeam = winningTeam;
    snapshot.result = result;
    snapshot.metrics = metrics;
    snapshot.metrics.activeEntities = entityIndex;
    return snapshot;
  }

  private ensureReusableEntitySlot(index: number, abilityCount: number): ReusableEntitySnapshotSlot {
    let slot = this.reusableEntitySlots[index];
    if (!slot) {
      const abilities: AbilityStateSnapshot[] = [];
      const castDirections: Vec2[] = [];
      slot = {
        entity: {
          id: 0,
          fighterId: '',
          team: 0,
          controller: 'ai',
          x: 0,
          y: 0,
          prevX: 0,
          prevY: 0,
          vx: 0,
          vy: 0,
          rotation: 0,
          radius: 1,
          mass: 1,
          hp: 0,
          maxHp: 1,
          alive: true,
          elements: [],
          traits: [],
          abilities,
          activeZoneIds: [],
          statuses: [],
          primaryAttackId: '',
          weaponId: null,
          weaponAttack: null
        },
        castDirections,
        weaponAttack: {
          weaponId: '',
          category: 'melee',
          style: '',
          phase: 'windup',
          direction: { x: 1, y: 0 },
          remainingTicks: 0,
          totalTicks: 0
        }
      };
      this.reusableEntitySlots[index] = slot;
    }
    while (slot.entity.abilities.length < abilityCount) {
      slot.entity.abilities.push({
        slot: 'basic',
        source: 'ability',
        abilityId: '',
        phase: 'ready',
        cooldownRemainingTicks: 0,
        cooldownTotalTicks: 0,
        castRemainingTicks: 0,
        castTotalTicks: 0,
        castDirection: null,
        armedRemainingTicks: 0,
        armedTotalTicks: 0
      });
    }
    while (slot.castDirections.length < abilityCount) slot.castDirections.push({ x: 1, y: 0 });
    return slot;
  }

  snapshot(
    tick: number,
    seed: number,
    arenaId: string,
    modeId: string,
    battleEnded: boolean,
    winningTeam: TeamId | null,
    result: BattleResultSnapshot | null,
    activeCasts: ReadonlyMap<EntityId, ActiveCastState> = new Map(),
    armedAbilities: ReadonlyMap<EntityId, ReadonlyMap<string, ArmedAbilityState>> = new Map(),
    weaponAttacks: ReadonlyMap<EntityId, ActiveWeaponAttackState> = new Map(),
    obstacles: ArenaObstacleSnapshot[] = [],
    projectiles: ProjectileSnapshot[] = [],
    objective: BattleObjectiveSnapshot = { kind: 'elimination', label: 'Eliminate opponents', progress: 0, remainingTicks: null },
    metrics: SimulationMetricsSnapshot = {
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
    }
  ): WorldSnapshot {
    const entities: EntitySnapshot[] = [];
    for (const id of this.activeIdList) {
      const fighter = getFighter(this.getFighterId(id));
      const activeCast = activeCasts.get(id);
      const armed = armedAbilities.get(id);
      const weaponAttack = weaponAttacks.get(id);
      const primaryAttack = getPrimaryAttack(fighter.primaryAttackId);
      const primaryReadyTick = this.getPrimaryAttackReadyTick(id, primaryAttack.id);
      const primaryCooldownRemaining = Math.max(0, primaryReadyTick - tick);
      const primaryState = weaponAttack?.weaponId === primaryAttack.id ? weaponAttack : null;
      const abilities: EntitySnapshot['abilities'] = [{
        slot: 'basic' as const,
        source: 'primaryAttack' as const,
        abilityId: primaryAttack.id,
        phase: primaryState?.phase === 'windup' ? 'casting' as const : primaryCooldownRemaining > 0 ? 'cooldown' as const : 'ready' as const,
        cooldownRemainingTicks: primaryCooldownRemaining,
        cooldownTotalTicks: primaryAttack.cooldownTicks,
        castRemainingTicks: primaryState?.phase === 'windup' ? primaryState.remainingTicks : 0,
        castTotalTicks: primaryAttack.windupTicks,
        castDirection: primaryState ? { ...primaryState.direction } : null,
        armedRemainingTicks: 0,
        armedTotalTicks: 0
      }];
      for (const slot of SNAPSHOT_SKILL_SLOTS) {
        const abilityId = fighter.abilitySlots[slot];
        if (!abilityId) continue;
        const ability = getAbility(abilityId);
        const readyTick = this.getAbilityReadyTick(id, abilityId);
        const cooldownRemainingTicks = Math.max(0, readyTick - tick);
        const casting = activeCast?.abilityId === abilityId;
        const armedState = armed?.get(abilityId);
        const armedRemainingTicks = armedState ? Math.max(0, armedState.expiresTick - tick) : 0;
        abilities.push({
          slot,
          source: 'ability' as const,
          abilityId,
          phase: casting ? 'casting' as const : armedRemainingTicks > 0 ? 'armed' as const : cooldownRemainingTicks > 0 ? 'cooldown' as const : 'ready' as const,
          cooldownRemainingTicks,
          cooldownTotalTicks: ability.cooldownTicks,
          castRemainingTicks: casting ? activeCast!.remainingTicks : 0,
          castTotalTicks: casting ? activeCast!.totalTicks : ability.castTicks,
          castDirection: casting ? { ...activeCast!.direction } : null,
          armedRemainingTicks,
          armedTotalTicks: armedState?.totalTicks ?? 0
        });
      }
      entities.push({
        id,
        fighterId: fighter.id,
        team: this.getTeam(id),
        controller: this.controller[id] ?? 'ai',
        x: this.x[id] ?? 0,
        y: this.y[id] ?? 0,
        prevX: this.prevX[id] ?? 0,
        prevY: this.prevY[id] ?? 0,
        vx: this.vx[id] ?? 0,
        vy: this.vy[id] ?? 0,
        rotation: this.rotation[id] ?? 0,
        radius: this.radius[id] ?? fighter.physics.radius,
        mass: this.getEffectiveMass(id),
        hp: this.hp[id] ?? 0,
        maxHp: this.maxHp[id] ?? fighter.stats.maxHp,
        alive: true,
        elements: [...fighter.classification.elements],
        traits: [...fighter.classification.traits],
        abilities,
        activeZoneIds: [...this.getActiveZoneIds(id)].sort(),
        statuses: [...this.getStatuses(id).values()]
          .map((status) => ({ statusId: status.id, remainingTicks: status.remainingTicks }))
          .sort((a, b) => a.statusId.localeCompare(b.statusId)),
        primaryAttackId: fighter.primaryAttackId,
        weaponId: fighter.primaryAttackId,
        weaponAttack: weaponAttack ? {
          weaponId: weaponAttack.weaponId,
          category: weaponAttack.category,
          style: weaponAttack.style,
          phase: weaponAttack.phase,
          direction: { ...weaponAttack.direction },
          remainingTicks: weaponAttack.remainingTicks,
          totalTicks: weaponAttack.totalTicks
        } : null
      });
    }
    return { tick, seed, arenaId, modeId, entities, obstacles, projectiles, objective, battleEnded, winningTeam, result, metrics: { ...metrics, activeEntities: entities.length } };
  }
}
