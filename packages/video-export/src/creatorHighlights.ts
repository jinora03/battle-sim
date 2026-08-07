import { getAbility, getFighter } from '@kinetic/content';
import type {
  BattleDefinition,
  EntityId,
  SimulationEvent,
  WorldSnapshot
} from '@kinetic/protocol';
import type {
  CreatorBattleHighlight,
  CreatorBattleSummary
} from './types';

const ABILITY_ATTRIBUTION_TICKS = 180;
const ULTIMATE_SCORE = 760;
const KNOCKOUT_SCORE = 1_600;

interface RecentAbility {
  abilityId: string;
  tick: number;
}

interface LargestHit {
  amount: number;
  tick: number;
  sourceName: string;
  targetName: string;
  abilityName: string | null;
}

interface AbilityDamageTotal {
  abilityId: string;
  sourceName: string;
  totalDamage: number;
}

/**
 * Replay-only creator analysis. It observes deterministic snapshots/events and
 * never feeds information back into the simulation.
 */
export class CreatorReplayAnalyzer {
  private readonly entityNames = new Map<EntityId, string>();
  private readonly recentAbilityByEntity = new Map<EntityId, RecentAbility>();
  private readonly damageByAbility = new Map<string, AbilityDamageTotal>();
  private largestHit: LargestHit | null = null;
  private highlight: CreatorBattleHighlight | null = null;
  private highlightScore = -1;
  private highlightRevision = 0;

  constructor(private readonly battle: BattleDefinition) {}

  update(snapshot: WorldSnapshot, events: readonly SimulationEvent[]): boolean {
    this.refreshEntities(snapshot);
    const previousRevision = this.highlightRevision;

    for (const event of events) {
      if (event.type === 'abilityActivated' || event.type === 'abilityResolved') {
        this.recentAbilityByEntity.set(event.entityId, {
          abilityId: event.abilityId,
          tick: event.tick
        });
        if (event.type === 'abilityActivated' && event.slot === 'ultimate') {
          const actor = this.entityNames.get(event.entityId) ?? 'Fighter';
          this.considerHighlight(
            ULTIMATE_SCORE + Math.max(0, event.castTicks),
            {
              tick: event.tick,
              kind: 'ultimate',
              title: resolveAbilityName(event.abilityId),
              detail: `${actor} committed an ultimate`
            }
          );
        }
      } else if (event.type === 'damage' && !event.prevented && event.amount > 0) {
        const sourceName = event.sourceId === undefined
          ? 'Arena'
          : this.entityNames.get(event.sourceId) ?? 'Fighter';
        const targetName = this.entityNames.get(event.targetId) ?? 'Opponent';
        const recentAbility = event.sourceId === undefined
          ? null
          : this.recentAbilityByEntity.get(event.sourceId) ?? null;
        const attributedAbility = recentAbility && event.tick - recentAbility.tick <= ABILITY_ATTRIBUTION_TICKS
          ? recentAbility.abilityId
          : null;
        const abilityName = attributedAbility ? resolveAbilityName(attributedAbility) : null;

        if (!this.largestHit || event.amount > this.largestHit.amount) {
          this.largestHit = {
            amount: event.amount,
            tick: event.tick,
            sourceName,
            targetName,
            abilityName
          };
        }

        if (attributedAbility) {
          const key = `${event.sourceId ?? 0}:${attributedAbility}`;
          const current = this.damageByAbility.get(key);
          this.damageByAbility.set(key, {
            abilityId: attributedAbility,
            sourceName,
            totalDamage: (current?.totalDamage ?? 0) + event.amount
          });
        }

        this.considerHighlight(
          420 + event.amount * 2.2 + (event.hpAfter <= 0 ? 650 : 0),
          {
            tick: event.tick,
            kind: event.hpAfter <= 0 ? 'knockout' : 'heavy-hit',
            title: `${Math.round(event.amount).toLocaleString()} damage`,
            detail: abilityName ? `${sourceName} · ${abilityName}` : `${sourceName} hit ${targetName}`
          }
        );
      } else if (event.type === 'death') {
        const defeated = this.entityNames.get(event.entityId) ?? 'Fighter';
        const killer = event.killerId === undefined ? null : this.entityNames.get(event.killerId) ?? 'Opponent';
        this.considerHighlight(
          KNOCKOUT_SCORE,
          {
            tick: event.tick,
            kind: 'knockout',
            title: `${defeated} knocked out`,
            detail: killer ? `Defeated by ${killer}` : null
          }
        );
      }
    }

    return this.highlightRevision !== previousRevision;
  }

  finalize(snapshot: WorldSnapshot): CreatorBattleSummary {
    this.refreshEntities(snapshot);
    const winningTeam = snapshot.winningTeam ?? null;
    const winners = winningTeam === null
      ? []
      : snapshot.entities.filter((entity) => entity.team === winningTeam);
    const remainingHp = winners.reduce((sum, entity) => sum + Math.max(0, entity.hp), 0);
    const remainingMaxHp = winners.reduce((sum, entity) => sum + Math.max(0, entity.maxHp), 0);
    const winnerName = winningTeam === null
      ? 'Draw'
      : resolveTeamName(snapshot, this.battle, winningTeam);
    const topAbility = [...this.damageByAbility.values()]
      .sort((a, b) => b.totalDamage - a.totalDamage || compareIds(a.abilityId, b.abilityId))[0] ?? null;

    return {
      winnerName,
      winningTeam,
      durationSeconds: snapshot.tick / 60,
      remainingHp,
      remainingHpRatio: remainingMaxHp > 0 ? clamp01(remainingHp / remainingMaxHp) : 0,
      largestHit: this.largestHit ? { ...this.largestHit } : null,
      topAbility: topAbility
        ? {
            ...topAbility,
            abilityName: resolveAbilityName(topAbility.abilityId)
          }
        : null,
      highlight: this.highlight ? { ...this.highlight } : null
    };
  }

  private refreshEntities(snapshot: WorldSnapshot): void {
    for (const entity of snapshot.entities) {
      this.entityNames.set(entity.id, resolveFighterName(entity.fighterId));
    }
  }

  private considerHighlight(score: number, highlight: CreatorBattleHighlight): void {
    if (score < this.highlightScore) return;
    if (score === this.highlightScore && this.highlight && highlight.tick <= this.highlight.tick) return;
    this.highlightScore = score;
    this.highlight = highlight;
    this.highlightRevision += 1;
  }
}

function resolveTeamName(snapshot: WorldSnapshot, battle: BattleDefinition, team: number): string {
  const members = snapshot.entities.filter((entity) => entity.team === team);
  const participants = battle.participants.filter((participant) => participant.team === team);
  if (Math.max(members.length, participants.length) > 1) return `Team ${team}`;
  const fighterId = members[0]?.fighterId ?? participants[0]?.fighterId;
  return fighterId ? resolveFighterName(fighterId) : `Team ${team}`;
}

function resolveFighterName(id: string): string {
  try {
    return getFighter(id).name;
  } catch {
    return titleize(id);
  }
}

function resolveAbilityName(id: string): string {
  try {
    return getAbility(id).name;
  } catch {
    return titleize(id);
  }
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
