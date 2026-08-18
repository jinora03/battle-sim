import { getAbility, getFighter, getPrimaryAttack } from '@kinetic/content';
import type { AbilitySlot, EntityId, SimulationEvent } from '@kinetic/protocol';
import { SIM_TICK_RATE } from '@kinetic/simulation';

export type AbilityAnalyticsKind = 'primary' | 'ability';

export interface AbilityAnalyticsEntity {
  id: EntityId;
  fighterId: string;
  primaryAttackId: string;
}

export interface AbilityUsageSummary {
  fighterId: string;
  actionId: string;
  name: string;
  kind: AbilityAnalyticsKind;
  slot: AbilitySlot;
  battleSamples: number;
  battlesUsed: number;
  uses: number;
  usesPerBattle: number;
  usageRate: number;
  neverUsedRate: number;
  resolutions: number;
  completionRate: number;
  damageHits: number;
  hitsPerUse: number;
  damage: number;
  damagePerBattle: number;
  damageContribution: number;
  effectEvents: number;
  kills: number;
  averageFirstUseSeconds: number | null;
}

export interface FighterAbilityAnalytics {
  fighterId: string;
  battleSamples: number;
  totalDamage: number;
  attributedDamage: number;
  unattributedDamage: number;
  attributedDamageRate: number;
  primaryAttack: AbilityUsageSummary;
  abilities: AbilityUsageSummary[];
}

export interface RosterAbilityAnalytics {
  fighters: FighterAbilityAnalytics[];
}

interface MutableActionUsage {
  fighterId: string;
  actionId: string;
  name: string;
  kind: AbilityAnalyticsKind;
  slot: AbilitySlot;
  battleSamples: number;
  battlesUsed: number;
  uses: number;
  resolutions: number;
  damageHits: number;
  damage: number;
  effectEvents: number;
  kills: number;
  firstUseTickTotal: number;
  firstUseSamples: number;
}

interface MutableFighterUsage {
  fighterId: string;
  battleSamples: number;
  totalDamage: number;
  attributedDamage: number;
  primaryAttackId: string;
  actionIds: string[];
}

interface ActiveAbility {
  abilityId: string;
  expiresTick: number;
}

interface DamageAttribution {
  fighterId: string;
  actionId: string | null;
}

interface CurrentBattleState {
  entityToFighter: Map<EntityId, string>;
  primaryAttackByEntity: Map<EntityId, string>;
  activeAbilityByEntity: Map<EntityId, ActiveAbility>;
  usedActions: Set<string>;
  firstUseActions: Set<string>;
  lastDamageByTarget: Map<EntityId, DamageAttribution>;
}

const ABILITY_SLOT_ORDER: AbilitySlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];
const ABILITY_ATTACK_SOURCE_CACHE = new Map<string, Set<string>>();

/**
 * Observes the normal simulation event stream. It never sends commands or
 * mutates simulation state, so enabling Stage 9A.3 telemetry cannot change a
 * battle outcome or checksum.
 */
export class AbilityAnalyticsCollector {
  private readonly fighters = new Map<string, MutableFighterUsage>();
  private readonly actions = new Map<string, MutableActionUsage>();
  private current: CurrentBattleState | null = null;

  beginBattle(entities: readonly AbilityAnalyticsEntity[]): void {
    const entityToFighter = new Map<EntityId, string>();
    const primaryAttackByEntity = new Map<EntityId, string>();
    const seenFighters = new Set<string>();

    for (const entity of entities) {
      entityToFighter.set(entity.id, entity.fighterId);
      primaryAttackByEntity.set(entity.id, entity.primaryAttackId);
      if (seenFighters.has(entity.fighterId)) continue;
      seenFighters.add(entity.fighterId);
      const fighter = this.ensureFighter(entity.fighterId, entity.primaryAttackId);
      fighter.battleSamples += 1;
      for (const actionId of fighter.actionIds) {
        this.actions.get(actionKey(entity.fighterId, actionId))!.battleSamples += 1;
      }
    }

    this.current = {
      entityToFighter,
      primaryAttackByEntity,
      activeAbilityByEntity: new Map(),
      usedActions: new Set(),
      firstUseActions: new Set(),
      lastDamageByTarget: new Map()
    };
  }

  observeEvents(events: readonly SimulationEvent[]): void {
    const battle = this.current;
    if (!battle || events.length === 0) return;

    const resolvedThisBatch = new Map<string, string>();
    const activatedThisBatch = new Map<string, string>();
    const weaponHitBySourceTargetTick = new Map<string, string>();

    for (const event of events) {
      if (event.type === 'abilityResolved') {
        resolvedThisBatch.set(eventEntityTickKey(event.entityId, event.tick), event.abilityId);
      } else if (event.type === 'abilityActivated') {
        activatedThisBatch.set(eventEntityTickKey(event.entityId, event.tick), event.abilityId);
      } else if (event.type === 'weaponHit') {
        weaponHitBySourceTargetTick.set(
          weaponHitKey(event.sourceId, event.targetId, event.tick),
          event.weaponId
        );
      }
    }

    for (const event of events) {
      if (event.type === 'abilityActivated') {
        const fighterId = battle.entityToFighter.get(event.entityId);
        if (!fighterId) continue;
        const action = this.actions.get(actionKey(fighterId, event.abilityId));
        if (!action) continue;
        action.uses += 1;
        markBattleUse(action, battle, event.tick);
        battle.activeAbilityByEntity.set(event.entityId, {
          abilityId: event.abilityId,
          expiresTick: event.tick + Math.max(0, event.castTicks)
        });
        continue;
      }

      if (event.type === 'abilityResolved') {
        const fighterId = battle.entityToFighter.get(event.entityId);
        if (!fighterId) continue;
        const action = this.actions.get(actionKey(fighterId, event.abilityId));
        if (action) {
          action.resolutions += 1;
          action.effectEvents += 1;
        }
        const active = battle.activeAbilityByEntity.get(event.entityId);
        if (active?.abilityId === event.abilityId) battle.activeAbilityByEntity.delete(event.entityId);
        continue;
      }

      if (event.type === 'weaponAttackStarted') {
        const fighterId = battle.entityToFighter.get(event.entityId);
        if (!fighterId) continue;
        const primaryAttackId = battle.primaryAttackByEntity.get(event.entityId);
        if (!primaryAttackId || event.weaponId !== primaryAttackId) continue;
        const explicitAbility = abilityForEntityTick(
          event.entityId,
          event.tick,
          battle,
          resolvedThisBatch,
          activatedThisBatch
        );
        if (explicitAbility && abilityUsesAttackSource(explicitAbility, event.weaponId)) continue;
        const action = this.actions.get(actionKey(fighterId, primaryAttackId));
        if (!action) continue;
        action.uses += 1;
        markBattleUse(action, battle, event.tick);
        continue;
      }

      if (event.type === 'damage' && !event.prevented && event.amount > 0 && event.sourceId !== undefined) {
        const fighterId = battle.entityToFighter.get(event.sourceId);
        if (!fighterId) continue;
        const fighter = this.fighters.get(fighterId);
        if (!fighter) continue;
        fighter.totalDamage += event.amount;

        const weaponId = weaponHitBySourceTargetTick.get(
          weaponHitKey(event.sourceId, event.targetId, event.tick)
        );
        const actionId = resolveDamageActionId(
          event.sourceId,
          event.tick,
          weaponId,
          battle,
          resolvedThisBatch,
          activatedThisBatch
        );
        if (actionId) {
          const action = this.actions.get(actionKey(fighterId, actionId));
          if (action) {
            action.damage += event.amount;
            action.damageHits += 1;
            action.effectEvents += 1;
            fighter.attributedDamage += event.amount;
          }
        }
        battle.lastDamageByTarget.set(event.targetId, { fighterId, actionId });
        continue;
      }

      if (event.type === 'statusApplied' && event.sourceId !== undefined) {
        incrementEffectForSource(
          event.sourceId,
          event.tick,
          battle,
          this.actions,
          resolvedThisBatch,
          activatedThisBatch
        );
        continue;
      }

      if (event.type === 'knockbackApplied' && event.kind === 'ability' && event.sourceId !== undefined) {
        incrementEffectForSource(
          event.sourceId,
          event.tick,
          battle,
          this.actions,
          resolvedThisBatch,
          activatedThisBatch
        );
        continue;
      }

      if (event.type === 'blast' && event.abilityId) {
        const fighterId = battle.entityToFighter.get(event.sourceId);
        const action = fighterId ? this.actions.get(actionKey(fighterId, event.abilityId)) : null;
        if (action) action.effectEvents += 1;
        continue;
      }

      if (event.type === 'death' && event.killerId !== undefined) {
        const attribution = battle.lastDamageByTarget.get(event.entityId);
        if (!attribution || attribution.fighterId !== battle.entityToFighter.get(event.killerId) || !attribution.actionId) continue;
        const action = this.actions.get(actionKey(attribution.fighterId, attribution.actionId));
        if (action) action.kills += 1;
      }
    }
  }

  endBattle(): void {
    this.current = null;
  }

  summarize(): RosterAbilityAnalytics {
    return {
      fighters: [...this.fighters.values()]
        .map((fighter) => summarizeFighter(fighter, this.actions))
        .sort((a, b) => a.fighterId.localeCompare(b.fighterId))
    };
  }

  private ensureFighter(fighterId: string, primaryAttackId: string): MutableFighterUsage {
    const existing = this.fighters.get(fighterId);
    if (existing) return existing;

    const fighter = getFighter(fighterId);
    const resolvedPrimaryAttackId = primaryAttackId || fighter.primaryAttackId;
    const actionIds: string[] = [resolvedPrimaryAttackId];
    this.ensureAction({
      fighterId,
      actionId: resolvedPrimaryAttackId,
      name: getPrimaryAttack(resolvedPrimaryAttackId).name,
      kind: 'primary',
      slot: 'basic'
    });

    for (const slot of ABILITY_SLOT_ORDER) {
      const abilityId = fighter.abilitySlots[slot];
      if (!abilityId) continue;
      const ability = getAbility(abilityId);
      actionIds.push(ability.id);
      this.ensureAction({
        fighterId,
        actionId: ability.id,
        name: ability.name,
        kind: 'ability',
        slot
      });
    }

    const mutable: MutableFighterUsage = {
      fighterId,
      battleSamples: 0,
      totalDamage: 0,
      attributedDamage: 0,
      primaryAttackId: resolvedPrimaryAttackId,
      actionIds
    };
    this.fighters.set(fighterId, mutable);
    return mutable;
  }

  private ensureAction(definition: Pick<MutableActionUsage, 'fighterId' | 'actionId' | 'name' | 'kind' | 'slot'>): MutableActionUsage {
    const key = actionKey(definition.fighterId, definition.actionId);
    const existing = this.actions.get(key);
    if (existing) return existing;
    const mutable: MutableActionUsage = {
      ...definition,
      battleSamples: 0,
      battlesUsed: 0,
      uses: 0,
      resolutions: 0,
      damageHits: 0,
      damage: 0,
      effectEvents: 0,
      kills: 0,
      firstUseTickTotal: 0,
      firstUseSamples: 0
    };
    this.actions.set(key, mutable);
    return mutable;
  }
}

export function getFighterAbilityAnalytics(
  analytics: RosterAbilityAnalytics,
  fighterId: string
): FighterAbilityAnalytics | null {
  return analytics.fighters.find((fighter) => fighter.fighterId === fighterId) ?? null;
}

function summarizeFighter(
  fighter: MutableFighterUsage,
  actions: Map<string, MutableActionUsage>
): FighterAbilityAnalytics {
  const summaries = fighter.actionIds
    .map((actionId) => actions.get(actionKey(fighter.fighterId, actionId)))
    .filter((action): action is MutableActionUsage => Boolean(action))
    .map((action) => summarizeAction(action, fighter.totalDamage));
  const primaryAttack = summaries.find((action) => action.kind === 'primary');
  if (!primaryAttack) throw new Error(`Missing primary attack analytics for ${fighter.fighterId}`);
  return {
    fighterId: fighter.fighterId,
    battleSamples: fighter.battleSamples,
    totalDamage: fighter.totalDamage,
    attributedDamage: fighter.attributedDamage,
    unattributedDamage: Math.max(0, fighter.totalDamage - fighter.attributedDamage),
    attributedDamageRate: fighter.totalDamage > 0 ? clamp01(fighter.attributedDamage / fighter.totalDamage) : 0,
    primaryAttack,
    abilities: summaries.filter((action) => action.kind === 'ability')
  };
}

function summarizeAction(action: MutableActionUsage, fighterTotalDamage: number): AbilityUsageSummary {
  return {
    fighterId: action.fighterId,
    actionId: action.actionId,
    name: action.name,
    kind: action.kind,
    slot: action.slot,
    battleSamples: action.battleSamples,
    battlesUsed: action.battlesUsed,
    uses: action.uses,
    usesPerBattle: action.battleSamples > 0 ? action.uses / action.battleSamples : 0,
    usageRate: action.battleSamples > 0 ? action.battlesUsed / action.battleSamples : 0,
    neverUsedRate: action.battleSamples > 0 ? 1 - action.battlesUsed / action.battleSamples : 0,
    resolutions: action.resolutions,
    completionRate: action.kind === 'primary'
      ? 1
      : action.uses > 0 ? clamp01(action.resolutions / action.uses) : 0,
    damageHits: action.damageHits,
    hitsPerUse: action.uses > 0 ? action.damageHits / action.uses : 0,
    damage: action.damage,
    damagePerBattle: action.battleSamples > 0 ? action.damage / action.battleSamples : 0,
    damageContribution: fighterTotalDamage > 0 ? clamp01(action.damage / fighterTotalDamage) : 0,
    effectEvents: action.effectEvents,
    kills: action.kills,
    averageFirstUseSeconds: action.firstUseSamples > 0
      ? action.firstUseTickTotal / action.firstUseSamples / SIM_TICK_RATE
      : null
  };
}

function markBattleUse(action: MutableActionUsage, battle: CurrentBattleState, tick: number): void {
  const key = actionKey(action.fighterId, action.actionId);
  if (!battle.usedActions.has(key)) {
    battle.usedActions.add(key);
    action.battlesUsed += 1;
  }
  if (!battle.firstUseActions.has(key)) {
    battle.firstUseActions.add(key);
    action.firstUseTickTotal += tick;
    action.firstUseSamples += 1;
  }
}

function incrementEffectForSource(
  sourceId: EntityId,
  tick: number,
  battle: CurrentBattleState,
  actions: Map<string, MutableActionUsage>,
  resolvedThisBatch: Map<string, string>,
  activatedThisBatch: Map<string, string>
): void {
  const fighterId = battle.entityToFighter.get(sourceId);
  if (!fighterId) return;
  const abilityId = abilityForEntityTick(sourceId, tick, battle, resolvedThisBatch, activatedThisBatch);
  if (!abilityId) return;
  const action = actions.get(actionKey(fighterId, abilityId));
  if (action) action.effectEvents += 1;
}

function resolveDamageActionId(
  sourceId: EntityId,
  tick: number,
  weaponId: string | undefined,
  battle: CurrentBattleState,
  resolvedThisBatch: Map<string, string>,
  activatedThisBatch: Map<string, string>
): string | null {
  const fighterId = battle.entityToFighter.get(sourceId);
  if (!fighterId) return null;
  const explicitAbility = abilityForEntityTick(sourceId, tick, battle, resolvedThisBatch, activatedThisBatch);

  if (weaponId) {
    if (explicitAbility && abilityUsesAttackSource(explicitAbility, weaponId)) return explicitAbility;
    const fighter = getFighter(fighterId);
    for (const slot of ABILITY_SLOT_ORDER) {
      const abilityId = fighter.abilitySlots[slot];
      if (abilityId && abilityUsesAttackSource(abilityId, weaponId)) return abilityId;
    }
    if (weaponId === battle.primaryAttackByEntity.get(sourceId)) return weaponId;
  }

  return explicitAbility;
}

function abilityForEntityTick(
  entityId: EntityId,
  tick: number,
  battle: CurrentBattleState,
  resolvedThisBatch: Map<string, string>,
  activatedThisBatch: Map<string, string>
): string | null {
  const eventKey = eventEntityTickKey(entityId, tick);
  const resolved = resolvedThisBatch.get(eventKey);
  if (resolved) return resolved;
  const activated = activatedThisBatch.get(eventKey);
  if (activated) return activated;
  const active = battle.activeAbilityByEntity.get(entityId);
  if (!active || tick > active.expiresTick) return null;
  return active.abilityId;
}

function abilityUsesAttackSource(abilityId: string, attackSourceId: string): boolean {
  let sources = ABILITY_ATTACK_SOURCE_CACHE.get(abilityId);
  if (!sources) {
    sources = new Set<string>();
    const ability = getAbility(abilityId);
    for (const trigger of ability.triggers) {
      for (const action of trigger.actions) {
        if (action.type === 'LAUNCH_PROJECTILES') sources.add(action.projectileId);
        else if (action.type === 'USE_WEAPON' && action.weaponId) sources.add(action.weaponId);
      }
    }
    ABILITY_ATTACK_SOURCE_CACHE.set(abilityId, sources);
  }
  return sources.has(attackSourceId);
}

function actionKey(fighterId: string, actionId: string): string {
  return `${fighterId}\u0000${actionId}`;
}

function eventEntityTickKey(entityId: EntityId, tick: number): string {
  return `${entityId}:${tick}`;
}

function weaponHitKey(sourceId: EntityId, targetId: EntityId, tick: number): string {
  return `${sourceId}:${targetId}:${tick}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
