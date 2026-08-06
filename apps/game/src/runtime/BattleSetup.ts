import type { DifficultyId } from '@kinetic/meta';
import type { ControllerKind, TeamCollisionMode } from '@kinetic/protocol';

export interface BattleSetup {
  fighterAId: string;
  fighterBId: string;
  moduleIdsA: string[];
  moduleIdsB: string[];
  controllerA: ControllerKind;
  controllerB: ControllerKind;
  arenaId: string;
  modeId: string;
  teamSizeA: number;
  teamSizeB: number;
  friendlyFire: boolean;
  teamCollision: TeamCollisionMode;
  difficulty: DifficultyId;
}

export const DEFAULT_BATTLE_SETUP = {
  fighterAId: 'gunner',
  fighterBId: 'bomber',
  moduleIdsA: ['shoulder-missile-pod', 'deflector-plate', 'recoil-thrusters', 'targeting-drone'],
  moduleIdsB: [],
  controllerA: 'player',
  controllerB: 'ai',
  arenaId: 'iron-pit',
  modeId: 'duel',
  teamSizeA: 1,
  teamSizeB: 1,
  friendlyFire: false,
  teamCollision: 'full',
  difficulty: 'standard'
} satisfies BattleSetup;

export function createDefaultBattleSetup(): BattleSetup {
  return {
    ...DEFAULT_BATTLE_SETUP,
    moduleIdsA: [...DEFAULT_BATTLE_SETUP.moduleIdsA],
    moduleIdsB: [...DEFAULT_BATTLE_SETUP.moduleIdsB]
  };
}
