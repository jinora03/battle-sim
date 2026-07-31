import type { AbilitySlot } from '@kinetic/protocol';

export type ProgressNoticeKind = 'achievement' | 'fighter' | 'challenge' | 'level' | 'battle';

export interface TimedNoticeInput {
  kind: ProgressNoticeKind;
  title: string;
  description: string;
}

export interface TimedNotice extends TimedNoticeInput {
  id: number;
  createdAt: number;
  expiresAt: number;
}

export function noticeDurationMs(kind: ProgressNoticeKind): number {
  switch (kind) {
    case 'fighter':
    case 'level':
      return 8_000;
    case 'achievement':
    case 'challenge':
      return 6_500;
    case 'battle':
    default:
      return 3_800;
  }
}

export function isLowPriorityNotice(kind: ProgressNoticeKind): boolean {
  return kind === 'battle';
}

export function shouldSuppressNoticeOnCompactViewport(kind: ProgressNoticeKind, viewportWidth: number): boolean {
  return viewportWidth <= 640 && isLowPriorityNotice(kind);
}

export function shouldPauseBattle(pausedByUser: boolean, pausedBySystem: boolean): boolean {
  return pausedByUser || pausedBySystem;
}

export interface ModeCapacityLike {
  id: string;
  minUnits: number;
  maxUnits: number;
  formatLabel?: string;
}

export function formatModeCapacity(mode: ModeCapacityLike | null | undefined): string {
  if (!mode) return 'Unavailable';
  if (mode.formatLabel?.trim()) return mode.formatLabel;
  if (mode.id === 'duel' && mode.minUnits === 2 && mode.maxUnits === 2) return '1v1 only';
  return mode.minUnits === mode.maxUnits
    ? `${mode.minUnits} fighters`
    : `${mode.minUnits}–${mode.maxUnits} fighters`;
}

export interface ActiveCastLike {
  entityId: number;
  fighterName: string;
  abilityId: string;
  abilityName: string;
  icon: string;
  color: number;
  importance: 'basic' | 'skill' | 'ultimate';
  slot: AbilitySlot;
  progress: number;
}

export interface SkillActivitySummary extends ActiveCastLike {
  count: number;
  fighterNames: string[];
}

export interface SkillActivityAggregation {
  visible: SkillActivitySummary[];
  hiddenCount: number;
  totalCasts: number;
}

export function aggregateActiveCasts(casts: readonly ActiveCastLike[], maxVisible = 3): SkillActivityAggregation {
  const grouped = new Map<string, SkillActivitySummary>();
  for (const cast of casts) {
    const key = `${cast.abilityId}:${cast.importance}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...cast, count: 1, fighterNames: [cast.fighterName] });
      continue;
    }
    existing.count += 1;
    existing.progress = Math.max(existing.progress, cast.progress);
    if (!existing.fighterNames.includes(cast.fighterName) && existing.fighterNames.length < 3) {
      existing.fighterNames.push(cast.fighterName);
    }
  }
  const importanceRank: Record<ActiveCastLike['importance'], number> = { ultimate: 0, skill: 1, basic: 2 };
  const all = [...grouped.values()].sort((a, b) => {
    if (a.importance !== b.importance) return importanceRank[a.importance] - importanceRank[b.importance];
    if (a.count !== b.count) return b.count - a.count;
    return a.abilityName.localeCompare(b.abilityName);
  });
  return {
    visible: all.slice(0, Math.max(1, maxVisible)),
    hiddenCount: Math.max(0, all.length - Math.max(1, maxVisible)),
    totalCasts: casts.length
  };
}

export interface TeamProgressLike {
  team: number;
  alive: number;
  total: number;
  hp: number;
  maxHp: number;
}

export interface TeamBattleProgress extends TeamProgressLike {
  hpRatio: number;
  aliveRatio: number;
}

export interface EliminationProgress {
  teams: TeamBattleProgress[];
  alive: number;
  total: number;
  eliminated: number;
  completionRatio: number;
}

/** Creates stable, display-ready progress without mutating runtime diagnostics. */
export function resolveEliminationProgress(teams: readonly TeamProgressLike[]): EliminationProgress {
  const normalized = teams
    .map((team) => {
      const total = Math.max(0, Math.trunc(team.total));
      const alive = Math.max(0, Math.min(total, Math.trunc(team.alive)));
      const maxHp = Math.max(0, team.maxHp);
      const hp = Math.max(0, Math.min(maxHp, team.hp));
      return {
        team: team.team,
        alive,
        total,
        hp,
        maxHp,
        hpRatio: maxHp > 0 ? hp / maxHp : 0,
        aliveRatio: total > 0 ? alive / total : 0
      };
    })
    .sort((a, b) => a.team - b.team);
  const total = normalized.reduce((sum, team) => sum + team.total, 0);
  const alive = normalized.reduce((sum, team) => sum + team.alive, 0);
  const eliminated = Math.max(0, total - alive);
  return {
    teams: normalized,
    alive,
    total,
    eliminated,
    completionRatio: total > 0 ? eliminated / total : 0
  };
}
