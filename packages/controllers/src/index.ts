import { getAbility, getAiProfile, getArena, getFighter, getPrimaryAttack } from '@kinetic/content';
import { ActionSelectionSpatialContext, selectAbilityAction, type AiDecisionDebug } from './actionSelection';

export * from './actionSelection';
import type { AbilitySlot, EntityId, EntitySnapshot, MoveCommand, ReplayData, ReplayMovementRun, SimulationCommand, Vec2, WorldSnapshot } from '@kinetic/protocol';

export interface ControllerSource {
  commandsForTick(snapshot: WorldSnapshot): SimulationCommand[];
  reset?(): void;
}

interface AiMemory {
  targetId: EntityId | null;
  direction: Vec2;
  facing: Vec2;
  nextReactionTick: number;
  nextAimTick: number;
  lastX: number;
  lastY: number;
  stuckReactions: number;
  escapeUntilTick: number;
  escapeDirection: Vec2;
  nextAttackDecisionTick: number;
}

const ZERO: Vec2 = { x: 0, y: 0 };
const EMPTY_DENSITY: ReadonlyMap<EntityId, number> = new Map();

export interface AiWorkloadPolicy {
  reactionIntervalFloor: number;
  attackDecisionInterval: number;
  aimRefreshInterval: number;
  clusterRefreshInterval: number;
}

export interface AiWorkloadStats extends AiWorkloadPolicy {
  aiEntities: number;
  reactionRefreshes: number;
  attackEvaluations: number;
  aimRefreshes: number;
  clusterRefreshes: number;
  hostileQueries: number;
  areaCandidateChecks: number;
}

export function aiWorkloadPolicyForEntityCount(entityCount: number): AiWorkloadPolicy {
  if (entityCount <= 24) {
    return { reactionIntervalFloor: 1, attackDecisionInterval: 1, aimRefreshInterval: 1, clusterRefreshInterval: 1 };
  }
  if (entityCount <= 48) {
    return { reactionIntervalFloor: 5, attackDecisionInterval: 2, aimRefreshInterval: 1, clusterRefreshInterval: 6 };
  }
  if (entityCount <= 100) {
    return { reactionIntervalFloor: 8, attackDecisionInterval: 5, aimRefreshInterval: 2, clusterRefreshInterval: 20 };
  }
  return { reactionIntervalFloor: 12, attackDecisionInterval: 8, aimRefreshInterval: 3, clusterRefreshInterval: 30 };
}

export class AiController implements ControllerSource {
  private readonly commandScratch: SimulationCommand[] = [];
  private readonly memory = new Map<EntityId, AiMemory>();
  private readonly decisions = new Map<EntityId, AiDecisionDebug>();
  private readonly entityById = new Map<EntityId, EntitySnapshot>();
  private readonly teamMembers = new Map<number, EntitySnapshot[]>();
  private readonly aiEntities: EntitySnapshot[] = [];
  private readonly targetLoad = new Map<EntityId, number>();
  private readonly clusterDensity = new Map<EntityId, number>();
  private readonly actionSelectionSpatial = new ActionSelectionSpatialContext();
  private clusterDensityTick = Number.NEGATIVE_INFINITY;
  private detailedDebugEnabled: boolean;
  private workloadStats: AiWorkloadStats = {
    ...aiWorkloadPolicyForEntityCount(0),
    aiEntities: 0,
    reactionRefreshes: 0,
    attackEvaluations: 0,
    aimRefreshes: 0,
    clusterRefreshes: 0,
    hostileQueries: 0,
    areaCandidateChecks: 0
  };

  constructor(detailedDebugEnabled = true) {
    this.detailedDebugEnabled = detailedDebugEnabled;
  }

  setDetailedDebugEnabled(enabled: boolean): void {
    if (this.detailedDebugEnabled === enabled) return;
    this.detailedDebugEnabled = enabled;
    if (!enabled) this.decisions.clear();
  }

  commandsForTick(snapshot: WorldSnapshot): SimulationCommand[] {
    const commands = this.commandScratch;
    commands.length = 0;
    if (snapshot.battleEnded) return commands;
    const arena = getArena(snapshot.arenaId);
    const entities = snapshot.entities;
    const policy = aiWorkloadPolicyForEntityCount(entities.length);
    this.workloadStats = {
      ...policy,
      aiEntities: 0,
      reactionRefreshes: 0,
      attackEvaluations: 0,
      aimRefreshes: 0,
      clusterRefreshes: 0,
      hostileQueries: 0,
      areaCandidateChecks: 0
    };
    this.entityById.clear();
    this.targetLoad.clear();
    this.aiEntities.length = 0;
    for (const members of this.teamMembers.values()) members.length = 0;

    for (const entity of entities) {
      this.entityById.set(entity.id, entity);
      const team = this.teamMembers.get(entity.team);
      if (team) team.push(entity);
      else this.teamMembers.set(entity.team, [entity]);
      if (entity.controller === 'ai') this.aiEntities.push(entity);
    }
    this.actionSelectionSpatial.rebuild(entities, this.teamMembers);
    this.aiEntities.sort((a, b) => a.id - b.id);
    this.workloadStats.aiEntities = this.aiEntities.length;

    for (const entity of this.aiEntities) {
      const fighter = getFighter(entity.fighterId);
      if (!fighter.aiProfileId) continue;
      const profile = getAiProfile(fighter.aiProfileId);
      const reactionInterval = Math.max(profile.reactionTicks, policy.reactionIntervalFloor);
      const attackPhase = policy.attackDecisionInterval > 1 ? entity.id % policy.attackDecisionInterval : 0;
      const memory = this.memory.get(entity.id) ?? {
        targetId: null,
        direction: ZERO,
        facing: { x: Math.cos(entity.rotation), y: Math.sin(entity.rotation) },
        nextReactionTick: 0,
        nextAimTick: 0,
        lastX: entity.x,
        lastY: entity.y,
        stuckReactions: 0,
        escapeUntilTick: 0,
        escapeDirection: ZERO,
        nextAttackDecisionTick: snapshot.tick + attackPhase
      };
      const currentTarget = memory.targetId === null ? undefined : this.entityById.get(memory.targetId);

      if (snapshot.tick >= memory.nextReactionTick || !currentTarget) {
        let density: ReadonlyMap<EntityId, number> = EMPTY_DENSITY;
        if (profile.targeting === 'clustered') {
          if (snapshot.tick - this.clusterDensityTick >= policy.clusterRefreshInterval) {
            this.computeClusterDensity(entities, this.clusterDensity);
            this.clusterDensityTick = snapshot.tick;
            this.workloadStats.clusterRefreshes += 1;
          }
          density = this.clusterDensity;
        }
        const target = this.selectTarget(this.actionSelectionSpatial.candidatesForTeam(entity.team), entity, profile, this.targetLoad, memory.targetId, density);
        memory.targetId = target?.id ?? null;
        this.updateStuckState(memory, entity, snapshot.tick, reactionInterval);
        const allies = this.teamMembers.get(entity.team) ?? [];
        memory.direction = target
          ? this.computeSteering(entity, target, fighter.primaryAttackId, profile, arena.width, arena.height, snapshot, allies, entities, this.targetLoad.get(target.id) ?? 0, memory)
          : ZERO;
        const reactionPhase = reactionInterval > 1 ? entity.id % Math.min(4, reactionInterval) : 0;
        memory.nextReactionTick = snapshot.tick + reactionInterval + reactionPhase;
        memory.nextAimTick = snapshot.tick;
        memory.lastX = entity.x;
        memory.lastY = entity.y;
        this.memory.set(entity.id, memory);
        this.workloadStats.reactionRefreshes += 1;
      }

      if (memory.targetId !== null) this.targetLoad.set(memory.targetId, (this.targetLoad.get(memory.targetId) ?? 0) + 1);
      const target = memory.targetId === null ? undefined : this.entityById.get(memory.targetId);
      if (target && snapshot.tick >= memory.nextAimTick) {
        memory.facing = this.aimDirection(entity, target, fighter.primaryAttackId);
        memory.nextAimTick = snapshot.tick + policy.aimRefreshInterval;
        this.workloadStats.aimRefreshes += 1;
      } else if (!target) {
        memory.facing = memory.direction;
      }
      const facing = memory.facing;
      // Facing is independent from movement, allowing orbiting/kiting fighters
      // to keep their weapon in front and look directly at their target.
      commands.push({ type: 'move', entityId: entity.id, direction: memory.direction, facing });

      if (!target) continue;
      const busy = entity.weaponAttack !== null || entity.abilities.some((ability) => ability.phase === 'casting' || ability.phase === 'armed');
      if (!busy && snapshot.tick >= memory.nextAttackDecisionTick) {
        const action = selectAbilityAction(snapshot, entity, target, profile, this.detailedDebugEnabled, this.actionSelectionSpatial);
        if (action.debug) this.decisions.set(entity.id, action.debug);
        memory.nextAttackDecisionTick = snapshot.tick + policy.attackDecisionInterval;
        this.workloadStats.attackEvaluations += 1;
        if (action.selected) {
          const selectedTarget = action.selected.targetId === null ? undefined : this.entityById.get(action.selected.targetId);
          const actionDirection = selectedTarget
            ? action.selected.kind === 'primaryAttack'
              ? this.aimDirection(entity, selectedTarget, fighter.primaryAttackId)
              : this.aimAbilityDirection(entity, selectedTarget, action.selected.abilityId)
            : facing;
          if (action.selected.kind === 'primaryAttack') {
            commands.push({
              type: 'activatePrimaryAttack',
              entityId: entity.id,
              ...(action.selected.targetId !== null ? { targetId: action.selected.targetId } : {}),
              direction: actionDirection
            });
          } else {
            commands.push({
              type: 'activateAbility',
              entityId: entity.id,
              slot: action.selected.slot,
              ...(action.selected.targetId !== null ? { targetId: action.selected.targetId } : {}),
              direction: actionDirection
            });
          }
        }
      }
    }
    const spatialDiagnostics = this.actionSelectionSpatial.getDiagnostics();
    this.workloadStats.hostileQueries = spatialDiagnostics.hostileQueries;
    this.workloadStats.areaCandidateChecks = spatialDiagnostics.areaCandidateChecks;
    return commands;
  }

  getDecisionDebug(): AiDecisionDebug[] {
    return [...this.decisions.values()].sort((a, b) => a.entityId - b.entityId);
  }

  getWorkloadStats(): AiWorkloadStats {
    return { ...this.workloadStats };
  }

  reset(): void {
    this.memory.clear();
    this.decisions.clear();
    this.entityById.clear();
    this.teamMembers.clear();
    this.aiEntities.length = 0;
    this.targetLoad.clear();
    this.clusterDensity.clear();
    this.clusterDensityTick = Number.NEGATIVE_INFINITY;
    this.actionSelectionSpatial.reset();
  }

  private computeClusterDensity(entities: readonly EntitySnapshot[], result: Map<EntityId, number>): void {
    result.clear();
    for (const first of entities) {
      result.set(first.id, this.actionSelectionSpatial.countHostilesInRadius(first.team, first.id, first.x, first.y, 230, 0, false));
    }
  }

  private updateStuckState(memory: AiMemory, entity: EntitySnapshot, tick: number, reactionTicks: number): void {
    const displacement = Math.hypot(entity.x - memory.lastX, entity.y - memory.lastY);
    const wantedMovement = Math.hypot(memory.direction.x, memory.direction.y) > 0.15;
    memory.stuckReactions = wantedMovement && displacement < 3.5 ? memory.stuckReactions + 1 : 0;
    if (memory.stuckReactions >= 3) {
      const sign = ((entity.id + Math.floor(tick / Math.max(1, reactionTicks))) & 1) === 0 ? 1 : -1;
      const angle = entity.rotation + sign * Math.PI * 0.62;
      memory.escapeDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      memory.escapeUntilTick = tick + Math.max(18, reactionTicks * 4);
      memory.stuckReactions = 0;
    }
  }

  private computeSteering(
    entity: EntitySnapshot,
    target: EntitySnapshot,
    weaponId: string | null | undefined,
    profile: ReturnType<typeof getAiProfile>,
    arenaWidth: number,
    arenaHeight: number,
    snapshot: WorldSnapshot,
    allies: readonly EntitySnapshot[],
    entities: readonly EntitySnapshot[],
    targetEngagements: number,
    memory: AiMemory
  ): Vec2 {
    if (snapshot.tick < memory.escapeUntilTick) return memory.escapeDirection;
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const distance = Math.hypot(dx, dy) || 1;
    const toward = { x: dx / distance, y: dy / distance };
    const perpendicular = entity.id % 2 === 0
      ? { x: -toward.y, y: toward.x }
      : { x: toward.y, y: -toward.x };
    const hpRatio = entity.hp / Math.max(1, entity.maxHp);
    const retreat = hpRatio <= profile.retreatHealthRatio;
    const preferredDistance = this.preferredCombatDistance(profile.preferredDistance, weaponId);
    const attack = weaponId ? getPrimaryAttack(weaponId) : null;
    const ranged = attack ? ['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior) : profile.movementStyle === 'kite';
    const pressure = this.enemyPressure(entity, entities, Math.max(230, preferredDistance * 0.9));
    let x = 0;
    let y = 0;

    if (retreat) {
      x = -toward.x;
      y = -toward.y;
    } else if (profile.movementStyle === 'orbit' || profile.movementStyle === 'kite') {
      const deadZone = Math.max(28, preferredDistance * 0.14);
      const error = distance - preferredDistance;
      const radial = Math.abs(error) <= deadZone ? 0 : Math.max(-1, Math.min(1, error / Math.max(70, preferredDistance * 0.5)));
      x = toward.x * radial + perpendicular.x * Math.max(0.16, profile.orbitStrength);
      y = toward.y * radial + perpendicular.y * Math.max(0.16, profile.orbitStrength);
      if (ranged && pressure.strength > 0) {
        const danger = Math.max(0, 1 - pressure.nearestDistance / Math.max(100, preferredDistance * 0.82));
        x += pressure.away.x * danger * 1.35;
        y += pressure.away.y * danger * 1.35;
      }
    } else if (profile.movementStyle === 'charger') {
      const radial = distance > preferredDistance ? 1 : distance < preferredDistance * 0.65 ? -0.25 : 0.12;
      x = toward.x * radial * (0.9 + profile.aggression * 0.35) + perpendicular.x * Math.max(0.08, profile.orbitStrength);
      y = toward.y * radial * (0.9 + profile.aggression * 0.35) + perpendicular.y * Math.max(0.08, profile.orbitStrength);
    } else {
      const error = distance - preferredDistance;
      const radial = Math.abs(error) < 28 ? 0 : Math.max(-0.6, Math.min(1, error / Math.max(60, preferredDistance)));
      x = toward.x * radial + perpendicular.x * Math.max(0.08, profile.orbitStrength);
      y = toward.y * radial + perpendicular.y * Math.max(0.08, profile.orbitStrength);
    }

    // Committed ranged attacks need a readable firing lane. Stream attacks hold
    // their cone on target, while burst attacks brace and strafe through the full
    // cadence instead of surging forward between rounds.
    const committedPrimary = entity.weaponAttack !== null
      && (entity.weaponAttack.phase === 'windup' || entity.weaponAttack.phase === 'active');
    const streamCommitted = attack?.style === 'stream' && committedPrimary;
    const burstCommitted = attack?.style === 'burst' && ranged && committedPrimary;
    if (!retreat && (streamCommitted || burstCommitted)) {
      const closeThreshold = burstCommitted ? 0.88 : 0.82;
      const farThreshold = burstCommitted ? 1.12 : 1.18;
      const radial = distance < preferredDistance * closeThreshold
        ? burstCommitted ? -0.9 : -0.72
        : distance > preferredDistance * farThreshold
          ? burstCommitted ? 0.2 : 0.34
          : 0;
      const strafe = Math.max(burstCommitted ? 0.42 : 0.3, profile.orbitStrength);
      x = toward.x * radial + perpendicular.x * strafe;
      y = toward.y * radial + perpendicular.y * strafe;
    }

    if (!ranged && distance < preferredDistance * 1.75) {
      const slotAngle = (entity.id * 2.399963229728653 + target.id * 0.73) % (Math.PI * 2);
      const slotRadius = Math.max(55, preferredDistance * (0.86 + Math.min(4, targetEngagements) * 0.035));
      const slotX = target.x + Math.cos(slotAngle) * slotRadius;
      const slotY = target.y + Math.sin(slotAngle) * slotRadius;
      const slotDirection = normalize({ x: slotX - entity.x, y: slotY - entity.y });
      const slotBlend = distance < preferredDistance * 1.25 ? 0.62 : 0.28;
      x = x * (1 - slotBlend) + slotDirection.x * slotBlend;
      y = y * (1 - slotBlend) + slotDirection.y * slotBlend;
      if (targetEngagements >= 3) {
        x += perpendicular.x * Math.min(0.55, targetEngagements * 0.09);
        y += perpendicular.y * Math.min(0.55, targetEngagements * 0.09);
      }
    }

    const margin = Math.min(150, Math.min(arenaWidth, arenaHeight) * 0.18);
    const wall = profile.wallAvoidance;
    if (entity.x < margin) x += ((margin - entity.x) / margin) * wall;
    if (entity.x > arenaWidth - margin) x -= ((entity.x - (arenaWidth - margin)) / margin) * wall;
    if (entity.y < margin) y += ((margin - entity.y) / margin) * wall;
    if (entity.y > arenaHeight - margin) y -= ((entity.y - (arenaHeight - margin)) / margin) * wall;

    for (const obstacle of snapshot.obstacles) {
      if (!obstacle.alive) continue;
      const halfW = obstacle.shape === 'box' ? obstacle.width / 2 : obstacle.radius;
      const halfH = obstacle.shape === 'box' ? obstacle.height / 2 : obstacle.radius;
      const closestX = Math.max(obstacle.x - halfW, Math.min(obstacle.x + halfW, entity.x));
      const closestY = Math.max(obstacle.y - halfH, Math.min(obstacle.y + halfH, entity.y));
      const awayX = entity.x - closestX;
      const awayY = entity.y - closestY;
      const obstacleDistance = Math.hypot(awayX, awayY);
      const influence = entity.radius + Math.max(halfW, halfH) * 0.4 + 82;
      if (obstacleDistance > 0.001 && obstacleDistance < influence) {
        const strength = (1 - obstacleDistance / influence) * (0.8 + profile.wallAvoidance * 0.75);
        x += (awayX / obstacleDistance) * strength;
        y += (awayY / obstacleDistance) * strength;
      }
    }

    for (const ally of allies) {
      if (ally.id === entity.id) continue;
      const awayX = entity.x - ally.x;
      const awayY = entity.y - ally.y;
      const allyDistance = Math.hypot(awayX, awayY);
      const influence = entity.radius + ally.radius + (snapshot.entities.length > 48 ? 42 : 72);
      if (allyDistance > 0.001 && allyDistance < influence) {
        const strength = (1 - allyDistance / influence) * profile.allySeparation;
        x += (awayX / allyDistance) * strength;
        y += (awayY / allyDistance) * strength;
      }
    }

    const length = Math.hypot(x, y);
    if (length <= 0.0001) return { x: perpendicular.x * 0.22, y: perpendicular.y * 0.22 };
    return { x: (x / length) * profile.steeringStrength, y: (y / length) * profile.steeringStrength };
  }

  private enemyPressure(entity: EntitySnapshot, entities: readonly EntitySnapshot[], radius: number): { away: Vec2; strength: number; nearestDistance: number } {
    let x = 0;
    let y = 0;
    let weightTotal = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of entities) {
      if (enemy.id === entity.id || enemy.team === entity.team) continue;
      const dx = entity.x - enemy.x;
      const dy = entity.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      nearestDistance = Math.min(nearestDistance, distance);
      if (distance > radius) continue;
      const weight = 1 - distance / radius;
      x += dx / distance * weight;
      y += dy / distance * weight;
      weightTotal += weight;
    }
    return {
      away: weightTotal > 0 ? normalize({ x, y }) : ZERO,
      strength: Math.min(1, weightTotal / 2.5),
      nearestDistance
    };
  }

  private aimDirection(entity: EntitySnapshot, target: EntitySnapshot, primaryAttackId: string | null): Vec2 {
    if (!primaryAttackId) return normalize({ x: target.x - entity.x, y: target.y - entity.y });
    const attack = getPrimaryAttack(primaryAttackId);
    const speed = attack.projectile?.speed ?? 0;
    if (speed <= 0) return normalize({ x: target.x - entity.x, y: target.y - entity.y });
    const distance = Math.hypot(target.x - entity.x, target.y - entity.y);
    const leadTicks = Math.min(28, distance / Math.max(1, speed));
    return normalize({
      x: target.x + target.vx * leadTicks - entity.x,
      y: target.y + target.vy * leadTicks - entity.y
    });
  }

  private aimAbilityDirection(entity: EntitySnapshot, target: EntitySnapshot, abilityId: string): Vec2 {
    const ability = getAbility(abilityId);
    const leadTicks = Math.min(36, Math.max(0, ability.castTicks));
    return normalize({
      x: target.x + target.vx * leadTicks - entity.x,
      y: target.y + target.vy * leadTicks - entity.y
    });
  }

  private preferredCombatDistance(profileDistance: number, weaponId: string | null | undefined): number {
    if (!weaponId) return profileDistance;
    const attack = getPrimaryAttack(weaponId);
    if (['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior)) {
      return Math.max(attack.minRange + 45, Math.min(attack.range * 0.62, profileDistance > 180 ? profileDistance : attack.range * 0.55));
    }
    return Math.max(58, Math.min(profileDistance, attack.range * 0.82));
  }

  private selectTarget(
    entities: readonly EntitySnapshot[],
    self: EntitySnapshot,
    profile: ReturnType<typeof getAiProfile>,
    targetLoad: ReadonlyMap<EntityId, number>,
    previousTargetId: EntityId | null,
    clusterDensity: ReadonlyMap<EntityId, number>
  ): EntitySnapshot | undefined {
    let best: EntitySnapshot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of entities) {
      if (candidate.id === self.id || candidate.team === self.team) continue;
      const dx = candidate.x - self.x;
      const dy = candidate.y - self.y;
      const distance = Math.hypot(dx, dy);
      const healthRatio = candidate.hp / Math.max(1, candidate.maxHp);
      let score = distance;
      if (profile.targeting === 'lowest-health') score = distance * 0.34 + healthRatio * 520;
      else if (profile.targeting === 'largest') score = distance * 0.42 - candidate.mass * 34 - candidate.radius * 2;
      else if (profile.targeting === 'clustered') score = distance * 0.48 - (clusterDensity.get(candidate.id) ?? 0) * 145;
      score += (targetLoad.get(candidate.id) ?? 0) * profile.targetSpread * 135;
      if (candidate.id === previousTargetId) score *= profile.targetStickiness;

      if (score < bestScore || (score === bestScore && candidate.id < (best?.id ?? Number.MAX_SAFE_INTEGER))) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }
}

/** Stateful local-input controller with pointer-directed aiming. */
export class PlayerController implements ControllerSource {
  private readonly controlled = new Set<EntityId>();
  private readonly queued: SimulationCommand[] = [];
  private movement: Vec2 = { x: 0, y: 0 };
  private aim: Vec2 = { x: 1, y: 0 };
  private aimPoint: Vec2 | null = null;
  private aimAssist = 0;
  private readonly queuedSlots: AbilitySlot[] = [];

  /** 0 disables aim assist; higher values widen the acquisition cone and pull
   *  the aim toward the best on-screen enemy. Player-only, so it never affects
   *  AI-vs-AI determinism. */
  setAimAssist(strength: number): void {
    this.aimAssist = Math.max(0, Math.min(1, strength));
  }

  setControlledEntities(ids: readonly EntityId[]): void {
    this.controlled.clear();
    for (const id of ids) this.controlled.add(id);
  }

  setMovement(direction: Vec2): void {
    const length = Math.hypot(direction.x, direction.y);
    this.movement = length > 1 ? { x: direction.x / length, y: direction.y / length } : { ...direction };
  }

  setAim(direction: Vec2): void {
    const length = Math.hypot(direction.x, direction.y);
    if (length <= 0.001) return;
    this.aim = { x: direction.x / length, y: direction.y / length };
  }

  setAimAt(point: Vec2, direction?: Vec2): void {
    this.aimPoint = { ...point };
    if (direction) this.setAim(direction);
  }

  /** Drop any cursor aim point so aiming follows the movement/stick direction. */
  clearAimPoint(): void {
    this.aimPoint = null;
  }

  activate(slot: AbilitySlot): void {
    this.queuedSlots.push(slot);
  }

  queue(command: SimulationCommand): void {
    this.queued.push(command);
  }

  commandsForTick(snapshot: WorldSnapshot): SimulationCommand[] {
    if (snapshot.battleEnded) return [];
    const commands = this.queued.splice(0, this.queued.length);
    const slots = this.queuedSlots.splice(0, this.queuedSlots.length);
    // No controlled entities (e.g. AI-vs-AI battles): skip the per-tick entity
    // map build and only forward any directly-queued commands.
    if (this.controlled.size === 0) return commands;
    const entityById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));

    for (const entityId of [...this.controlled].sort((a, b) => a - b)) {
      const self = entityById.get(entityId);
      if (!self || self.controller !== 'player') continue;
      const rawAim = this.aimPoint ? normalize({ x: this.aimPoint.x - self.x, y: this.aimPoint.y - self.y }) : this.aim;
      this.aim = rawAim;
      const aim = this.aimAssist > 0 ? this.applyAimAssist(snapshot, self, rawAim) : rawAim;
      // Emit even while stationary so the fighter and weapon continue facing
      // the aim direction independently from WASD movement.
      commands.push({ type: 'move', entityId, direction: this.movement, facing: aim });
      const target = this.findAimedEnemy(snapshot, self, aim);
      for (const slot of slots) {
        if (slot === 'basic') {
          commands.push({
            type: 'activatePrimaryAttack',
            entityId,
            ...(target ? { targetId: target.id } : {}),
            direction: aim
          });
        } else {
          commands.push({
            type: 'activateAbility',
            entityId,
            slot,
            ...(target ? { targetId: target.id } : {}),
            direction: aim
          });
        }
      }
    }
    return commands;
  }

  reset(): void {
    this.controlled.clear();
    this.queued.length = 0;
    this.queuedSlots.length = 0;
    this.movement = { x: 0, y: 0 };
    this.aim = { x: 1, y: 0 };
    this.aimPoint = null;
  }

  private applyAimAssist(snapshot: WorldSnapshot, self: EntitySnapshot, aim: Vec2): Vec2 {
    // Acquire the best enemy inside an aim cone that widens with strength, then
    // bias the aim toward it. Deterministic id tie-break keeps replays stable.
    const halfAngle = (12 + this.aimAssist * 33) * Math.PI / 180;
    const coneCos = Math.cos(halfAngle);
    const maxRange = 560;
    let best: EntitySnapshot | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of snapshot.entities) {
      if (candidate.id === self.id || candidate.team === self.team) continue;
      const dx = candidate.x - self.x;
      const dy = candidate.y - self.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > maxRange) continue;
      const alignment = (dx / distance) * aim.x + (dy / distance) * aim.y;
      if (alignment < coneCos) continue;
      const score = alignment - (distance / maxRange) * 0.15;
      if (score > bestScore || (score === bestScore && candidate.id < (best?.id ?? Number.MAX_SAFE_INTEGER))) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) return aim;
    const dx = best.x - self.x;
    const dy = best.y - self.y;
    const length = Math.hypot(dx, dy) || 1;
    const pull = Math.max(0, Math.min(0.92, this.aimAssist));
    return normalize({ x: aim.x * (1 - pull) + (dx / length) * pull, y: aim.y * (1 - pull) + (dy / length) * pull });
  }

  private findAimedEnemy(snapshot: WorldSnapshot, self: EntitySnapshot, aim: Vec2): EntitySnapshot | undefined {
    let result: EntitySnapshot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of snapshot.entities) {
      if (candidate.id === self.id || candidate.team === self.team) continue;
      const dx = candidate.x - self.x;
      const dy = candidate.y - self.y;
      const distance = Math.hypot(dx, dy) || 1;
      const alignment = Math.max(-1, Math.min(1, (dx / distance) * aim.x + (dy / distance) * aim.y));
      const anglePenalty = (1 - alignment) * 900;
      const cursorDistance = this.aimPoint
        ? Math.hypot(candidate.x - this.aimPoint.x, candidate.y - this.aimPoint.y)
        : distance;
      const score = cursorDistance * 1.8 + distance * 0.12 + anglePenalty;
      if (score < bestScore || (score === bestScore && candidate.id < (result?.id ?? Number.MAX_SAFE_INTEGER))) {
        bestScore = score;
        result = candidate;
      }
    }
    return result;
  }
}

export class ReplayController implements ControllerSource {
  private readonly byTick = new Map<number, SimulationCommand[]>();
  private readonly movementStarts = new Map<number, ReplayMovementRun[]>();
  private readonly movementEnds = new Map<number, EntityId[]>();
  private readonly activeMovement = new Map<EntityId, MoveCommand>();
  private lastTick = -1;

  constructor(replay: ReplayData) {
    for (const frame of replay.frames) this.byTick.set(frame.tick, frame.commands);
    if (replay.schemaVersion === 2) {
      for (const run of replay.movementRuns) {
        const starts = this.movementStarts.get(run.startTick);
        if (starts) starts.push(run);
        else this.movementStarts.set(run.startTick, [run]);
        const endTick = run.endTick + 1;
        const ends = this.movementEnds.get(endTick);
        if (ends) ends.push(run.command.entityId);
        else this.movementEnds.set(endTick, [run.command.entityId]);
      }
      for (const runs of this.movementStarts.values()) runs.sort((a, b) => a.command.entityId - b.command.entityId);
      for (const ids of this.movementEnds.values()) ids.sort((a, b) => a - b);
    }
  }

  commandsForTick(snapshot: WorldSnapshot): SimulationCommand[] {
    const tick = snapshot.tick;
    if (tick <= this.lastTick) this.reset();
    for (let cursor = this.lastTick + 1; cursor <= tick; cursor += 1) {
      for (const entityId of this.movementEnds.get(cursor) ?? []) this.activeMovement.delete(entityId);
      for (const run of this.movementStarts.get(cursor) ?? []) this.activeMovement.set(run.command.entityId, run.command);
    }
    this.lastTick = tick;

    const actions = this.byTick.get(tick) ?? [];
    if (this.activeMovement.size === 0) return [...actions];
    return [...this.activeMovement.values(), ...actions];
  }

  reset(): void {
    this.activeMovement.clear();
    this.lastTick = -1;
  }
}

export class NetworkController implements ControllerSource {
  constructor(private readonly readCommands: (tick: number) => SimulationCommand[]) {}

  commandsForTick(snapshot: WorldSnapshot): SimulationCommand[] {
    return this.readCommands(snapshot.tick);
  }
}

function normalize(value: Vec2): Vec2 {
  const length = Math.hypot(value.x, value.y);
  return length > 0.0001 ? { x: value.x / length, y: value.y / length } : { x: 1, y: 0 };
}
