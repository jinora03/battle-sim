import { getAbility, getFighter, getPrimaryAttack } from '@kinetic/content';
import type { AiAbilityCandidateDebug, AiDecisionDebug } from '@kinetic/controllers';
import type { AbilitySlot, EntityId } from '@kinetic/protocol';

export type AiDecisionBlockCategory =
  | 'cooldown-or-busy'
  | 'opening-lockout'
  | 'range'
  | 'targeting'
  | 'health-gate'
  | 'status-gate'
  | 'resource-gate'
  | 'prediction'
  | 'line-of-sight'
  | 'target-count'
  | 'other';

export interface AiDecisionAnalyticsEntity {
  id: EntityId;
  fighterId: string;
}

export interface AiDecisionBlockSummary {
  category: AiDecisionBlockCategory;
  count: number;
  rate: number;
}

export interface AiActionDecisionAnalytics {
  fighterId: string;
  actionId: string;
  name: string;
  slot: AbilitySlot;
  source: 'primaryAttack' | 'ability';
  evaluations: number;
  validOpportunities: number;
  validOpportunityRate: number;
  selections: number;
  selectionRateWhenValid: number;
  readyButSkipped: number;
  readyButSkippedRate: number;
  blockedEvaluations: number;
  blockedRate: number;
  averageValidScore: number;
  blockReasons: AiDecisionBlockSummary[];
}

export interface FighterAiDecisionAnalytics {
  fighterId: string;
  battleSamples: number;
  decisionEvaluations: number;
  decisionsPerBattle: number;
  primarySelections: number;
  abilitySelections: number;
  repositionDecisions: number;
  idleDecisions: number;
  primarySelectionRate: number;
  abilitySelectionRate: number;
  repositionRate: number;
  actions: AiActionDecisionAnalytics[];
}

export interface RosterAiDecisionAnalytics {
  fighters: FighterAiDecisionAnalytics[];
}

interface MutableFighterDecisionUsage {
  fighterId: string;
  battleSamples: number;
  decisionEvaluations: number;
  primarySelections: number;
  abilitySelections: number;
  repositionDecisions: number;
  idleDecisions: number;
  actionIds: string[];
}

interface MutableActionDecisionUsage {
  fighterId: string;
  actionId: string;
  name: string;
  slot: AbilitySlot;
  source: 'primaryAttack' | 'ability';
  evaluations: number;
  validOpportunities: number;
  selections: number;
  validScoreTotal: number;
  blockReasons: Map<AiDecisionBlockCategory, number>;
}

interface CurrentBattleState {
  entityToFighter: Map<EntityId, string>;
}

const ABILITY_SLOT_ORDER: AbilitySlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];

/**
 * Aggregates the AI action-selection debug record without altering the command
 * stream. Stage 9A.4 uses the same headless battles as the matchup matrix, so
 * this collector adds observation only and never makes a gameplay decision.
 */
export class AiDecisionAnalyticsCollector {
  private readonly fighters = new Map<string, MutableFighterDecisionUsage>();
  private readonly actions = new Map<string, MutableActionDecisionUsage>();
  private current: CurrentBattleState | null = null;

  beginBattle(entities: readonly AiDecisionAnalyticsEntity[]): void {
    const entityToFighter = new Map<EntityId, string>();
    const seenFighters = new Set<string>();

    for (const entity of entities) {
      entityToFighter.set(entity.id, entity.fighterId);
      if (seenFighters.has(entity.fighterId)) continue;
      seenFighters.add(entity.fighterId);
      this.ensureFighter(entity.fighterId).battleSamples += 1;
    }

    this.current = { entityToFighter };
  }

  observeDecision(decision: AiDecisionDebug, _tick: number): void {
    const battle = this.current;
    if (!battle) return;
    const fighterId = battle.entityToFighter.get(decision.entityId);
    if (!fighterId) return;
    const fighter = this.ensureFighter(fighterId);
    fighter.decisionEvaluations += 1;

    if (decision.kind === 'primaryAttack') fighter.primarySelections += 1;
    else if (decision.kind === 'ability') fighter.abilitySelections += 1;
    else if (decision.kind === 'move') fighter.repositionDecisions += 1;
    else fighter.idleDecisions += 1;

    for (const candidate of decision.candidates) {
      const action = this.ensureCandidate(fighterId, candidate);
      action.evaluations += 1;
      const selected = isSelectedCandidate(decision, candidate);
      if (candidate.valid) {
        action.validOpportunities += 1;
        action.validScoreTotal += candidate.score;
        if (selected) action.selections += 1;
      } else {
        const category = categorizeBlockReason(candidate.reason);
        action.blockReasons.set(category, (action.blockReasons.get(category) ?? 0) + 1);
      }
    }
  }

  endBattle(): void {
    this.current = null;
  }

  summarize(): RosterAiDecisionAnalytics {
    return {
      fighters: [...this.fighters.values()]
        .map((fighter) => summarizeFighter(fighter, this.actions))
        .sort((a, b) => a.fighterId.localeCompare(b.fighterId))
    };
  }

  private ensureFighter(fighterId: string): MutableFighterDecisionUsage {
    const existing = this.fighters.get(fighterId);
    if (existing) return existing;

    const fighter = getFighter(fighterId);
    const actionIds = [fighter.primaryAttackId];
    this.ensureAction({
      fighterId,
      actionId: fighter.primaryAttackId,
      name: getPrimaryAttack(fighter.primaryAttackId).name,
      slot: 'basic',
      source: 'primaryAttack'
    });
    for (const slot of ABILITY_SLOT_ORDER) {
      const abilityId = fighter.abilitySlots[slot];
      if (!abilityId) continue;
      actionIds.push(abilityId);
      this.ensureAction({
        fighterId,
        actionId: abilityId,
        name: getAbility(abilityId).name,
        slot,
        source: 'ability'
      });
    }

    const mutable: MutableFighterDecisionUsage = {
      fighterId,
      battleSamples: 0,
      decisionEvaluations: 0,
      primarySelections: 0,
      abilitySelections: 0,
      repositionDecisions: 0,
      idleDecisions: 0,
      actionIds
    };
    this.fighters.set(fighterId, mutable);
    return mutable;
  }

  private ensureCandidate(fighterId: string, candidate: AiAbilityCandidateDebug): MutableActionDecisionUsage {
    const key = actionKey(fighterId, candidate.abilityId);
    return this.actions.get(key) ?? this.ensureAction({
      fighterId,
      actionId: candidate.abilityId,
      name: candidate.abilityName,
      slot: candidate.slot,
      source: candidate.source
    });
  }

  private ensureAction(definition: Pick<MutableActionDecisionUsage, 'fighterId' | 'actionId' | 'name' | 'slot' | 'source'>): MutableActionDecisionUsage {
    const key = actionKey(definition.fighterId, definition.actionId);
    const existing = this.actions.get(key);
    if (existing) return existing;
    const mutable: MutableActionDecisionUsage = {
      ...definition,
      evaluations: 0,
      validOpportunities: 0,
      selections: 0,
      validScoreTotal: 0,
      blockReasons: new Map()
    };
    this.actions.set(key, mutable);
    return mutable;
  }
}

export function getFighterAiDecisionAnalytics(
  analytics: RosterAiDecisionAnalytics,
  fighterId: string
): FighterAiDecisionAnalytics | null {
  return analytics.fighters.find((fighter) => fighter.fighterId === fighterId) ?? null;
}

export function categorizeAiDecisionBlockReason(reason: string): AiDecisionBlockCategory {
  return categorizeBlockReason(reason);
}

function summarizeFighter(
  fighter: MutableFighterDecisionUsage,
  actions: ReadonlyMap<string, MutableActionDecisionUsage>
): FighterAiDecisionAnalytics {
  const decisionEvaluations = fighter.decisionEvaluations;
  return {
    fighterId: fighter.fighterId,
    battleSamples: fighter.battleSamples,
    decisionEvaluations,
    decisionsPerBattle: safeDivide(decisionEvaluations, fighter.battleSamples),
    primarySelections: fighter.primarySelections,
    abilitySelections: fighter.abilitySelections,
    repositionDecisions: fighter.repositionDecisions,
    idleDecisions: fighter.idleDecisions,
    primarySelectionRate: safeDivide(fighter.primarySelections, decisionEvaluations),
    abilitySelectionRate: safeDivide(fighter.abilitySelections, decisionEvaluations),
    repositionRate: safeDivide(fighter.repositionDecisions, decisionEvaluations),
    actions: fighter.actionIds
      .map((actionId) => actions.get(actionKey(fighter.fighterId, actionId)))
      .filter((action): action is MutableActionDecisionUsage => Boolean(action))
      .map(summarizeAction)
  };
}

function summarizeAction(action: MutableActionDecisionUsage): AiActionDecisionAnalytics {
  const blockedEvaluations = Math.max(0, action.evaluations - action.validOpportunities);
  const readyButSkipped = Math.max(0, action.validOpportunities - action.selections);
  const blockReasons = [...action.blockReasons.entries()]
    .map(([category, count]) => ({
      category,
      count,
      rate: safeDivide(count, blockedEvaluations)
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return {
    fighterId: action.fighterId,
    actionId: action.actionId,
    name: action.name,
    slot: action.slot,
    source: action.source,
    evaluations: action.evaluations,
    validOpportunities: action.validOpportunities,
    validOpportunityRate: safeDivide(action.validOpportunities, action.evaluations),
    selections: action.selections,
    selectionRateWhenValid: safeDivide(action.selections, action.validOpportunities),
    readyButSkipped,
    readyButSkippedRate: safeDivide(readyButSkipped, action.validOpportunities),
    blockedEvaluations,
    blockedRate: safeDivide(blockedEvaluations, action.evaluations),
    averageValidScore: safeDivide(action.validScoreTotal, action.validOpportunities),
    blockReasons
  };
}

function isSelectedCandidate(decision: AiDecisionDebug, candidate: AiAbilityCandidateDebug): boolean {
  if (decision.abilityId !== candidate.abilityId) return false;
  if (candidate.source === 'primaryAttack') return decision.kind === 'primaryAttack';
  return decision.kind === 'ability';
}

function categorizeBlockReason(reason: string): AiDecisionBlockCategory {
  const normalized = reason.toLowerCase();
  if (normalized.includes('cooldown') || normalized.includes('winding up') || normalized.includes('already casting') || normalized.includes('already armed')) return 'cooldown-or-busy';
  if (normalized.includes('opening lockout')) return 'opening-lockout';
  if (normalized.includes('out of range') || normalized.includes('too close') || normalized.includes('moving into primary range')) return 'range';
  if (normalized.includes('no valid target')) return 'targeting';
  if (normalized.includes('health above') || normalized.includes('defensive action not yet needed')) return 'health-gate';
  if (normalized.includes('stack')) return 'status-gate';
  if (normalized.includes('useful target')) return 'target-count';
  if (normalized.startsWith('needs ') || normalized.includes(' already at ')) return 'resource-gate';
  if (normalized.includes('predicted to leave')) return 'prediction';
  if (normalized.includes('line of sight')) return 'line-of-sight';
  return 'other';
}

function actionKey(fighterId: string, actionId: string): string {
  return `${fighterId}::${actionId}`;
}

function safeDivide(value: number, denominator: number): number {
  return denominator > 0 ? value / denominator : 0;
}
