import type { GameModeDefinition } from '@kinetic/content';
import type { BattleEndReason, EntityId, TeamId } from '@kinetic/protocol';
import type { World } from '../world';

export interface BattleEndDecision {
  winningTeam: TeamId | null;
  reason: BattleEndReason;
}

/** Evaluates mode-specific victory without mutating the simulation runner. */
export class BattleResultSystem {
  constructor(
    private readonly world: World,
    private readonly mode: GameModeDefinition,
    private readonly maxBattleTicks: number
  ) {}

  evaluate(tick: number, suppressVictory: boolean): BattleEndDecision | null {
    if (suppressVictory) return null;

    const aliveIds = this.world.activeIdsView();
    const teams = new Set<TeamId>(aliveIds.map((id) => this.world.getTeam(id)));

    if (this.mode.victory === 'DEFEAT_BOSS') {
      const bossTeam = this.mode.bossTeam ?? 2;
      const bossAlive = aliveIds.some((id) => this.world.getTeam(id) === bossTeam);
      const raiderTeams = [...teams]
        .filter((team) => team !== bossTeam)
        .sort((a, b) => a - b);

      if (!bossAlive) {
        return { winningTeam: raiderTeams[0] ?? null, reason: 'boss-defeated' };
      }
      if (raiderTeams.length === 0) {
        return { winningTeam: bossTeam, reason: 'elimination' };
      }
      return null;
    }

    if (this.mode.victory === 'SURVIVE_TICKS') {
      const survivorTeam = this.mode.survivorTeam ?? 1;
      const survivorAlive = aliveIds.some(
        (id) => this.world.getTeam(id) === survivorTeam
      );
      const enemyTeams = [...teams].filter((team) => team !== survivorTeam);

      if (!survivorAlive) {
        return {
          winningTeam: enemyTeams.sort((a, b) => a - b)[0] ?? null,
          reason: 'elimination'
        };
      }
      if (
        enemyTeams.length === 0 ||
        tick >= (this.mode.durationTicks ?? 2700)
      ) {
        return { winningTeam: survivorTeam, reason: 'survival-complete' };
      }
      return null;
    }

    if (teams.size <= 1) {
      const winner = teams.size === 1 ? [...teams][0] ?? null : null;
      return {
        winningTeam: winner,
        reason: winner === null ? 'draw' : 'elimination'
      };
    }

    if (tick >= this.maxBattleTicks) {
      const winner = this.leadingTeamAtTimeout(aliveIds);
      return {
        winningTeam: winner,
        reason: winner === null ? 'draw' : 'timeout'
      };
    }

    return null;
  }

  private leadingTeamAtTimeout(aliveIds: readonly EntityId[]): TeamId | null {
    const scores = new Map<TeamId, { alive: number; hpRatio: number }>();

    for (const entityId of aliveIds) {
      const team = this.world.getTeam(entityId);
      const current = scores.get(team) ?? { alive: 0, hpRatio: 0 };
      current.alive += 1;
      current.hpRatio +=
        (this.world.hp[entityId] ?? 0) /
        Math.max(1, this.world.maxHp[entityId] ?? 1);
      scores.set(team, current);
    }

    const ranked = [...scores.entries()].sort(
      (a, b) =>
        b[1].alive - a[1].alive ||
        b[1].hpRatio - a[1].hpRatio ||
        a[0] - b[0]
    );
    const first = ranked[0];
    const second = ranked[1];

    if (!first) return null;
    if (
      second &&
      first[1].alive === second[1].alive &&
      Math.abs(first[1].hpRatio - second[1].hpRatio) < 0.000001
    ) {
      return null;
    }
    return first[0];
  }
}
