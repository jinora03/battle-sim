import { getGameMode } from '@kinetic/content';
import { getDifficultyPreset } from '@kinetic/meta';
import type { BattleDefinition, BattleParticipant, ControllerKind } from '@kinetic/protocol';
import type { BattleSetup } from './BattleSetup';

/**
 * Build the deterministic simulation definition used by both the live runtime
 * and seed-driven replay generation. Keep setup-to-battle rules here so the
 * two execution paths cannot silently drift apart.
 */
export function createBattleDefinition(setup: BattleSetup, seed: number): BattleDefinition {
  const mode = getGameMode(setup.modeId);
  const participants: BattleParticipant[] = [];
  const addTeam = (
    fighterId: string,
    moduleIds: readonly string[],
    team: number,
    count: number,
    firstController: ControllerKind,
    statScale?: BattleParticipant['statScale']
  ) => {
    for (let index = 0; index < count; index += 1) {
      participants.push({
        fighterId,
        team,
        controller: index === 0 ? firstController : 'ai',
        loadout: { moduleIds: [...moduleIds] },
        ...(statScale ? { statScale } : {})
      });
    }
  };

  if (mode.id === 'duel') {
    addTeam(setup.fighterAId, setup.moduleIdsA, 1, 1, setup.controllerA);
    addTeam(setup.fighterBId, setup.moduleIdsB, 2, 1, setup.controllerB);
  } else if (mode.id === 'team-battle' || mode.id === 'mass-skirmish') {
    const minTeamSize = mode.id === 'mass-skirmish' ? 5 : 2;
    const maxPerTeam = Math.floor(mode.maxUnits / 2);
    addTeam(setup.fighterAId, setup.moduleIdsA, 1, Math.max(minTeamSize, Math.min(maxPerTeam, setup.teamSizeA)), setup.controllerA);
    addTeam(setup.fighterBId, setup.moduleIdsB, 2, Math.max(minTeamSize, Math.min(maxPerTeam, setup.teamSizeB)), setup.controllerB);
  } else if (mode.id === 'battle-royale') {
    const total = Math.max(3, Math.min(mode.maxUnits, setup.teamSizeA + setup.teamSizeB));
    for (let index = 0; index < total; index += 1) {
      participants.push({
        fighterId: index % 2 === 0 ? setup.fighterAId : setup.fighterBId,
        team: index + 1,
        controller: index === 0 ? setup.controllerA : 'ai',
        loadout: { moduleIds: [...(index % 2 === 0 ? setup.moduleIdsA : setup.moduleIdsB)] }
      });
    }
  } else if (mode.id === 'boss-raid') {
    addTeam(setup.fighterAId, setup.moduleIdsA, 1, Math.max(1, Math.min(6, setup.teamSizeA)), setup.controllerA);
    addTeam(setup.fighterBId, setup.moduleIdsB, mode.bossTeam ?? 2, 1, setup.controllerB, {
      hp: 4.5,
      radius: 1.65,
      mass: 3.2,
      damage: 1.65,
      speed: 0.86
    });
  } else {
    addTeam(setup.fighterAId, setup.moduleIdsA, mode.survivorTeam ?? 1, 1, setup.controllerA, { hp: 1.35 });
    addTeam(setup.fighterBId, setup.moduleIdsB, 2, Math.max(2, Math.min(12, setup.teamSizeB)), setup.controllerB);
  }

  const playerTeam = participants.find((participant) => participant.controller === 'player')?.team ?? null;
  const scaledEnemyTeam = playerTeam ?? (participants.some((participant) => participant.team === 2) ? 2 : null);
  if (scaledEnemyTeam !== null) {
    const difficulty = getDifficultyPreset(setup.difficulty);
    for (const participant of participants) {
      if (participant.team !== scaledEnemyTeam) continue;
      const current = participant.statScale ?? {};
      participant.statScale = {
        hp: (current.hp ?? 1) * difficulty.enemyHpScale,
        radius: current.radius ?? 1,
        mass: current.mass ?? 1,
        damage: (current.damage ?? 1) * difficulty.enemyDamageScale,
        speed: (current.speed ?? 1) * difficulty.enemySpeedScale
      };
    }
  }

  return {
    seed: seed >>> 0,
    arenaId: setup.arenaId,
    modeId: setup.modeId,
    participants,
    rules: {
      friendlyFire: setup.friendlyFire,
      teamCollision: setup.teamCollision,
      teamCollisionScale: setup.teamCollision === 'soft' ? 0.24 : 1,
      maxBattleTicks: mode.id === 'mass-skirmish' ? 5400 : 9000
    }
  };
}

export function normalizeBattleSeed(seed: number): number {
  return (Number.isFinite(seed) ? seed : 1) >>> 0 || 1;
}
