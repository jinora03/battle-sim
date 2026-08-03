import {
  getAbility,
  getAbilityActivationProfile,
  getFighter,
  getPrimaryAttack,
  getPrimaryAttackActivationProfile,
  type AiAbilityUseRule,
  type AiProfile
} from '@kinetic/content';
import type { AbilitySlot, EntityId, EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';

export type AiDecisionKind = 'primaryAttack' | 'ability' | 'move' | 'idle';

export interface AiAbilityCandidateDebug {
  slot: AbilitySlot;
  abilityId: string;
  abilityName: string;
  valid: boolean;
  score: number;
  reason: string;
  distance: number;
  targetCount: number;
  source: 'primaryAttack' | 'ability';
  targetId: EntityId | null;
}

export interface AiDecisionDebug {
  entityId: EntityId;
  targetId: EntityId | null;
  kind: AiDecisionKind;
  slot: AbilitySlot | null;
  abilityId: string | null;
  score: number;
  distance: number;
  reason: string;
  candidates: AiAbilityCandidateDebug[];
}

export interface SelectedAbilityAction {
  kind: 'primaryAttack' | 'ability';
  slot: AbilitySlot;
  abilityId: string;
  targetId: EntityId | null;
  score: number;
  reason: string;
}

export interface AbilitySelectionResult {
  selected: SelectedAbilityAction | null;
  debug: AiDecisionDebug | null;
}

const SKILL_ORDER: AbilitySlot[] = ['ultimate', 'skill3', 'skill2', 'skill1'];
const SLOT_RANK: Record<AbilitySlot, number> = { ultimate: 0, skill3: 1, skill2: 2, skill1: 3, basic: 4 };
const ABILITY_EFFECT_RADIUS_CACHE = new Map<string, number>();
const DEFAULT_RULE: Record<AbilitySlot, AiAbilityUseRule> = {
  basic: { slot: 'basic', everyTicks: 1, phaseTicks: 0, minDistance: 0, maxDistance: 99999, priority: 0 },
  skill1: { slot: 'skill1', everyTicks: 1, phaseTicks: 0, minDistance: 0, maxDistance: 99999, priority: 4 },
  skill2: { slot: 'skill2', everyTicks: 1, phaseTicks: 0, minDistance: 0, maxDistance: 99999, priority: 7 },
  skill3: { slot: 'skill3', everyTicks: 1, phaseTicks: 0, minDistance: 0, maxDistance: 99999, priority: 10 },
  ultimate: { slot: 'ultimate', everyTicks: 1, phaseTicks: 0, minDistance: 0, maxDistance: 99999, priority: 14 }
};

export interface ActionSelectionSpatialDiagnostics {
  hostileQueries: number;
  areaCandidateChecks: number;
}

/**
 * Reusable exact hostile-query context for AI action selection.
 *
 * In ordinary two-team battles, the old area-targeting path scanned both teams
 * for every possible target. This context reuses the controller's already
 * grouped team arrays, so a 50v50 radius query examines only the 50 hostiles.
 * The final predicted-position and radius checks are unchanged, preserving the
 * deterministic command stream without Map-heavy per-target spatial lookups.
 */
export class ActionSelectionSpatialContext {
  private entities: readonly EntitySnapshot[] = [];
  private readonly ownedTeamMembers = new Map<number, EntitySnapshot[]>();
  private teamMembers: ReadonlyMap<number, readonly EntitySnapshot[]> = this.ownedTeamMembers;
  private hostileQueries = 0;
  private areaCandidateChecks = 0;
  private activeTeamCount = 0;

  constructor(_cellSize = 180) {
    // Kept for source compatibility with earlier callers.
  }

  rebuild(
    entities: readonly EntitySnapshot[],
    existingTeamMembers?: ReadonlyMap<number, readonly EntitySnapshot[]>
  ): void {
    this.entities = entities;
    this.hostileQueries = 0;
    this.areaCandidateChecks = 0;
    this.activeTeamCount = 0;

    if (existingTeamMembers) {
      this.teamMembers = existingTeamMembers;
      for (const members of existingTeamMembers.values()) {
        if (members.length > 0) this.activeTeamCount += 1;
      }
      return;
    }

    this.teamMembers = this.ownedTeamMembers;
    for (const members of this.ownedTeamMembers.values()) members.length = 0;
    for (const entity of entities) {
      const members = this.ownedTeamMembers.get(entity.team);
      if (members) {
        if (members.length === 0) this.activeTeamCount += 1;
        members.push(entity);
      } else {
        this.ownedTeamMembers.set(entity.team, [entity]);
        this.activeTeamCount += 1;
      }
    }
  }

  reset(): void {
    this.entities = [];
    this.ownedTeamMembers.clear();
    this.teamMembers = this.ownedTeamMembers;
    this.hostileQueries = 0;
    this.areaCandidateChecks = 0;
    this.activeTeamCount = 0;
  }

  /** Preserves snapshot order and skips allies in ordinary two-team battles. */
  candidatesForTeam(team: number): readonly EntitySnapshot[] {
    if (this.activeTeamCount !== 2) return this.entities;
    for (const [candidateTeam, members] of this.teamMembers) {
      if (candidateTeam !== team && members.length > 0) return members;
    }
    return this.entities;
  }

  countHostilesInRadius(
    team: number,
    selfId: EntityId,
    x: number,
    y: number,
    radius: number,
    leadTicks: number,
    inclusive = true
  ): number {
    const safeRadius = Math.max(0, radius);
    const radiusSquared = safeRadius * safeRadius;
    const normalizedLead = Math.max(0, Math.min(48, Math.trunc(leadTicks)));
    const candidates = this.candidatesForTeam(team);
    let count = 0;
    this.hostileQueries += 1;

    for (const other of candidates) {
      this.areaCandidateChecks += 1;
      if (other.id === selfId || other.team === team) continue;
      const otherX = other.x + other.vx * normalizedLead;
      const otherY = other.y + other.vy * normalizedLead;
      const dx = otherX - x;
      const dy = otherY - y;
      const distanceSquared = dx * dx + dy * dy;
      if (inclusive ? distanceSquared <= radiusSquared : distanceSquared < radiusSquared) count += 1;
    }
    return count;
  }

  getDiagnostics(): ActionSelectionSpatialDiagnostics {
    return { hostileQueries: this.hostileQueries, areaCandidateChecks: this.areaCandidateChecks };
  }
}

/**
 * Evaluates every ready skill first. The fighter's authoritative primary attack
 * is then the guaranteed Basic fallback whenever no higher-priority skill is
 * useful and the target is inside its real effective range.
 */
export function selectAbilityAction(
  snapshot: WorldSnapshot,
  entity: EntitySnapshot,
  target: EntitySnapshot | undefined,
  profile: AiProfile
): { selected: SelectedAbilityAction | null; debug: AiDecisionDebug };
export function selectAbilityAction(
  snapshot: WorldSnapshot,
  entity: EntitySnapshot,
  target: EntitySnapshot | undefined,
  profile: AiProfile,
  collectDebug: false,
  spatialContext?: ActionSelectionSpatialContext
): { selected: SelectedAbilityAction | null; debug: null };
export function selectAbilityAction(
  snapshot: WorldSnapshot,
  entity: EntitySnapshot,
  target: EntitySnapshot | undefined,
  profile: AiProfile,
  collectDebug?: boolean,
  spatialContext?: ActionSelectionSpatialContext
): AbilitySelectionResult;
export function selectAbilityAction(
  snapshot: WorldSnapshot,
  entity: EntitySnapshot,
  target: EntitySnapshot | undefined,
  profile: AiProfile,
  collectDebug = true,
  spatialContext?: ActionSelectionSpatialContext
): AbilitySelectionResult {
  const fighter = getFighter(entity.fighterId);
  const fallbackDistance = target ? Math.hypot(target.x - entity.x, target.y - entity.y) : Number.POSITIVE_INFINITY;
  const hpRatio = entity.hp / Math.max(1, entity.maxHp);
  const candidates: AiAbilityCandidateDebug[] = [];
  const configuredRules = new Map(profile.abilityUsage.map((rule) => [rule.slot, rule]));
  let selectedKind: SelectedAbilityAction['kind'] | null = null;
  let selectedSlot: AbilitySlot | null = null;
  let selectedAbilityId: string | null = null;
  let selectedTargetId: EntityId | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;
  let selectedReason = '';

  const consider = (
    kind: SelectedAbilityAction['kind'],
    slot: AbilitySlot,
    abilityId: string,
    targetId: EntityId | null,
    score: number,
    reason: string
  ) => {
    const better = selectedSlot === null
      || score > selectedScore
      || (score === selectedScore && SLOT_RANK[slot] < SLOT_RANK[selectedSlot])
      || (score === selectedScore && slot === selectedSlot && abilityId < (selectedAbilityId ?? ''));
    if (!better) return;
    selectedKind = kind;
    selectedSlot = slot;
    selectedAbilityId = abilityId;
    selectedTargetId = targetId;
    selectedScore = score;
    selectedReason = collectDebug ? reason : '';
  };

  for (const slot of SKILL_ORDER) {
    const abilityId = fighter.abilitySlots[slot];
    if (!abilityId) continue;
    const state = entity.abilities.find((item) => item.slot === slot && item.source === 'ability');
    const rule = configuredRules.get(slot) ?? DEFAULT_RULE[slot];
    const ability = getAbility(abilityId);
    const activation = getAbilityActivationProfile(ability, fighter);
    const minRange = Math.max(activation.minRange, rule.minDistance);
    const maxRange = Math.min(activation.maxRange, rule.maxDistance);
    const resolvedTarget = chooseAbilityTarget(snapshot, entity, target, ability, activation.targeting, minRange, maxRange, spatialContext);
    const abilityTarget = resolvedTarget.target;
    const distance = abilityTarget ? Math.hypot(abilityTarget.x - entity.x, abilityTarget.y - entity.y) : fallbackDistance;
    const targetCount = resolvedTarget.targetCount;
    const targetStatusStacks = rule.targetStatusId && abilityTarget
      ? abilityTarget.statuses.find((status) => status.statusId === rule.targetStatusId)?.stacks ?? 0
      : 0;
    const selfResource = rule.selfResourceId
      ? entity.resources?.find((resource) => resource.resourceId === rule.selfResourceId)?.value ?? 0
      : 0;
    let valid = true;
    let reason = 'skill ready';

    if (!state || state.phase !== 'ready') {
      valid = false;
      reason = state?.phase === 'armed' ? 'already armed' : state?.phase === 'casting' ? 'already casting' : 'cooldown';
    } else if (rule.healthBelow !== undefined && hpRatio > rule.healthBelow) {
      valid = false;
      reason = `health above ${Math.round(rule.healthBelow * 100)}% threshold`;
    } else if ((activation.intent === 'defensive' || activation.intent === 'support') && rule.healthBelow === undefined && hpRatio > 0.78) {
      valid = false;
      reason = 'defensive action not yet needed';
    } else if (activation.targeting !== 'self' && activation.targeting !== 'direction' && !abilityTarget) {
      valid = false;
      reason = 'no valid target in predicted range';
    } else if (abilityTarget && activation.targeting !== 'self' && (distance < minRange || distance > maxRange)) {
      valid = false;
      reason = distance < minRange
        ? `target too close (${Math.round(distance)} < ${Math.round(minRange)})`
        : `target out of range (${Math.round(distance)} > ${Math.round(maxRange)})`;
    } else if (rule.targetStatusId && targetStatusStacks < (rule.minimumTargetStatusStacks ?? 0)) {
      valid = false;
      reason = `needs ${rule.minimumTargetStatusStacks ?? 0} ${rule.targetStatusId} stack${(rule.minimumTargetStatusStacks ?? 0) === 1 ? '' : 's'}`;
    } else if (rule.targetStatusId && targetStatusStacks > (rule.maximumTargetStatusStacks ?? Number.POSITIVE_INFINITY)) {
      valid = false;
      reason = `${rule.targetStatusId} already at ${targetStatusStacks} stacks`;
    } else if (rule.selfResourceId && selfResource < (rule.minimumSelfResource ?? 0)) {
      valid = false;
      reason = `needs ${rule.minimumSelfResource ?? 0} ${rule.selfResourceId}`;
    } else if (rule.selfResourceId && selfResource > (rule.maximumSelfResource ?? Number.POSITIVE_INFINITY)) {
      valid = false;
      reason = `${rule.selfResourceId} already at ${Math.round(selfResource)}`;
    } else if (abilityTarget && !resolvedTarget.predictedInRange) {
      valid = false;
      reason = 'target predicted to leave valid range during cast';
    } else if (abilityTarget && activation.requiresLineOfSight && !hasLineOfSight(snapshot, entity, abilityTarget)) {
      valid = false;
      reason = 'line of sight blocked';
    } else if (activation.targeting === 'area') {
      const requiredTargets = Math.max(activation.minimumTargets, rule.minimumTargets ?? 1);
      if (targetCount < requiredTargets) {
        valid = false;
        reason = `needs ${requiredTargets} useful target${requiredTargets === 1 ? '' : 's'}`;
      }
    }

    const missingHealth = 1 - hpRatio;
    const midpoint = (minRange + maxRange) / 2;
    const rangeUtility = Number.isFinite(distance) && maxRange > minRange
      ? Math.max(0, 1 - Math.abs(distance - midpoint) / Math.max(1, maxRange - minRange))
      : 0;
    const cadence = Math.max(1, rule.everyTicks);
    const cadencePhase = ((snapshot.tick - rule.phaseTicks) % cadence + cadence) % cadence;
    const cadenceReady = cadencePhase <= Math.max(1, profile.reactionTicks);
    const cadenceUtility = cadenceReady ? 4 : Math.max(0, 2 - cadencePhase / cadence * 2);
    const score = activation.priority
      + (rule.priority ?? 0)
      + 14
      + (activation.intent === 'defensive' ? missingHealth * 55 : 0)
      + (activation.targeting === 'area' ? Math.min(7, targetCount) * 7 : 0)
      + rangeUtility * 8
      + cadenceUtility
      + targetStatusStacks * (rule.priorityPerTargetStatusStack ?? 0)
      + selfResource * (rule.priorityPerSelfResource ?? 0);

    if (collectDebug) {
      candidates.push({
        slot,
        abilityId,
        abilityName: ability.name,
        valid,
        score,
        reason,
        distance: Number.isFinite(distance) ? distance : -1,
        targetCount,
        source: 'ability',
        targetId: abilityTarget?.id ?? null
      });
    }
    if (valid) consider('ability', slot, abilityId, abilityTarget?.id ?? null, score, `${ability.name}: ${reason}`);
  }

  const primaryAttack = getPrimaryAttack(fighter.primaryAttackId);
  const primaryActivation = getPrimaryAttackActivationProfile(primaryAttack);
  const primaryState = entity.abilities.find((item) => item.slot === 'basic' && item.source === 'primaryAttack');
  const effectiveMax = ['melee', 'spin', 'continuous', 'orbit', 'slam'].includes(primaryAttack.behavior) && target
    ? primaryAttack.range + entity.radius + target.radius
    : primaryAttack.range;
  const areaBehavior = ['spin', 'continuous', 'orbit', 'slam'].includes(primaryAttack.behavior);
  let primaryValid = true;
  let primaryReason = 'primary attack ready';
  if (!primaryState || primaryState.phase !== 'ready') {
    primaryValid = false;
    primaryReason = primaryState?.phase === 'casting' ? 'primary attack winding up' : 'primary attack cooldown';
  } else if (!target && !areaBehavior) {
    primaryValid = false;
    primaryReason = 'no valid target';
  } else if (target && (fallbackDistance < primaryActivation.minRange || fallbackDistance > effectiveMax)) {
    primaryValid = false;
    primaryReason = fallbackDistance < primaryActivation.minRange ? 'target too close' : 'moving into primary range';
  } else if (target && primaryActivation.requiresLineOfSight && !hasLineOfSight(snapshot, entity, target)) {
    primaryValid = false;
    primaryReason = 'line of sight blocked';
  }
  if (collectDebug) {
    candidates.push({
      slot: 'basic',
      abilityId: primaryAttack.id,
      abilityName: primaryAttack.name,
      valid: primaryValid,
      score: 30,
      reason: primaryReason,
      distance: Number.isFinite(fallbackDistance) ? fallbackDistance : -1,
      targetCount: target ? 1 : 0,
      source: 'primaryAttack',
      targetId: target?.id ?? null
    });
  }
  if (selectedSlot === null && primaryValid) {
    consider('primaryAttack', 'basic', primaryAttack.id, target?.id ?? null, 30, `${primaryAttack.name}: ${primaryReason}`);
  }

  const selected: SelectedAbilityAction | null = selectedKind && selectedSlot && selectedAbilityId
    ? {
      kind: selectedKind,
      slot: selectedSlot,
      abilityId: selectedAbilityId,
      targetId: selectedTargetId,
      score: selectedScore,
      reason: selectedReason
    }
    : null;

  return {
    selected,
    debug: collectDebug ? {
      entityId: entity.id,
      targetId: selected?.targetId ?? target?.id ?? null,
      kind: selected?.kind ?? (target ? 'move' : 'idle'),
      slot: selected?.slot ?? null,
      abilityId: selected?.abilityId ?? null,
      score: selected?.score ?? 0,
      distance: Number.isFinite(fallbackDistance) ? fallbackDistance : -1,
      reason: selected?.reason ?? (target ? 'No valid attack; repositioning into range.' : 'No target available.'),
      candidates
    } : null
  };
}

interface ResolvedAbilityTarget {
  target: EntitySnapshot | undefined;
  targetCount: number;
  predictedInRange: boolean;
}

function chooseAbilityTarget(
  snapshot: WorldSnapshot,
  self: EntitySnapshot,
  fallback: EntitySnapshot | undefined,
  ability: ReturnType<typeof getAbility>,
  targeting: ReturnType<typeof getAbilityActivationProfile>['targeting'],
  minRange: number,
  maxRange: number,
  spatialContext?: ActionSelectionSpatialContext
): ResolvedAbilityTarget {
  if (targeting === 'self' || targeting === 'direction') {
    return { target: fallback, targetCount: fallback ? 1 : 0, predictedInRange: true };
  }
  const castLeadTicks = Math.min(48, Math.max(0, ability.castTicks));
  const effectRadius = abilityEffectRadius(ability);
  let best: EntitySnapshot | undefined;
  let bestCount = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestPredictedInRange = false;

  const candidates = spatialContext?.candidatesForTeam(self.team) ?? snapshot.entities;
  for (const candidate of candidates) {
    if (candidate.id === self.id || candidate.team === self.team) continue;
    const dx = candidate.x - self.x;
    const dy = candidate.y - self.y;
    const distance = Math.hypot(dx, dy);
    if (distance < minRange || distance > maxRange) continue;
    const predicted = {
      x: candidate.x + candidate.vx * castLeadTicks,
      y: candidate.y + candidate.vy * castLeadTicks
    };
    const predictedDistance = Math.hypot(predicted.x - self.x, predicted.y - self.y);
    const predictedInRange = predictedDistance >= Math.max(0, minRange * 0.82) && predictedDistance <= maxRange * 1.04;
    let count = 1;
    if (targeting === 'area') {
      count = spatialContext
        ? spatialContext.countHostilesInRadius(self.team, self.id, predicted.x, predicted.y, effectRadius, castLeadTicks)
        : countHostilesBruteForce(snapshot.entities, self, predicted.x, predicted.y, effectRadius, castLeadTicks);
    }
    const score = count * 120 - distance * 0.12 - predictedDistance * 0.04 + (candidate.id === fallback?.id ? 18 : 0);
    if (score > bestScore || (score === bestScore && candidate.id < (best?.id ?? Number.MAX_SAFE_INTEGER))) {
      best = candidate;
      bestCount = count;
      bestScore = score;
      bestPredictedInRange = predictedInRange;
    }
  }
  return { target: best, targetCount: bestCount, predictedInRange: bestPredictedInRange };
}

function abilityEffectRadius(ability: ReturnType<typeof getAbility>): number {
  const cached = ABILITY_EFFECT_RADIUS_CACHE.get(ability.id);
  if (cached !== undefined) return cached;
  let radius = 95;
  for (const trigger of ability.triggers) {
    for (const action of trigger.actions) {
      if ('radius' in action && typeof action.radius === 'number') radius = Math.max(radius, action.radius);
      else if (action.type === 'DIRECTIONAL_DAMAGE') radius = Math.max(radius, action.range * 0.55);
      else if (action.type === 'LAUNCH_PROJECTILES') radius = Math.max(radius, action.pattern === 'radial' ? 230 : 150);
    }
  }
  ABILITY_EFFECT_RADIUS_CACHE.set(ability.id, radius);
  return radius;
}

function countHostilesBruteForce(
  entities: readonly EntitySnapshot[],
  self: EntitySnapshot,
  x: number,
  y: number,
  radius: number,
  leadTicks: number
): number {
  const radiusSquared = radius * radius;
  let count = 0;
  for (const other of entities) {
    if (other.id === self.id || other.team === self.team) continue;
    const otherX = other.x + other.vx * leadTicks;
    const otherY = other.y + other.vy * leadTicks;
    const dx = otherX - x;
    const dy = otherY - y;
    if (dx * dx + dy * dy <= radiusSquared) count += 1;
  }
  return count;
}

function hasLineOfSight(snapshot: WorldSnapshot, self: EntitySnapshot, target: EntitySnapshot): boolean {
  for (const obstacle of snapshot.obstacles) {
    if (!obstacle.alive) continue;
    if (obstacle.shape === 'circle') {
      if (segmentIntersectsCircle(self.x, self.y, target.x, target.y, obstacle.x, obstacle.y, obstacle.radius)) return false;
    } else if (segmentIntersectsBox(self.x, self.y, target.x, target.y, obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height)) {
      return false;
    }
  }
  return true;
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
