import type { ControllerKind } from '@kinetic/protocol';
import { DEFAULT_BATTLE_SETUP } from '../../runtime/BattleSetup';

type QuickBattleController = Extract<ControllerKind, 'player' | 'ai'>;

export interface QuickBattle {
  id: string;
  title: string;
  description: string;
  fighterAId: string;
  fighterBId: string;
  arenaId: string;
  modeId: string;
  teamSizeA: number;
  teamSizeB: number;
  controllerA: QuickBattleController;
  controllerB: QuickBattleController;
  accent: string;
  moduleIdsA?: readonly string[];
  moduleIdsB?: readonly string[];
}

export const QUICK_BATTLES = [
  {
    id: 'first-volley',
    title: 'First Volley',
    description: 'Start with the recommended Gunner loadout against Bomber in the compact Iron Pit.',
    fighterAId: DEFAULT_BATTLE_SETUP.fighterAId,
    fighterBId: DEFAULT_BATTLE_SETUP.fighterBId,
    arenaId: DEFAULT_BATTLE_SETUP.arenaId,
    modeId: DEFAULT_BATTLE_SETUP.modeId,
    teamSizeA: DEFAULT_BATTLE_SETUP.teamSizeA,
    teamSizeB: DEFAULT_BATTLE_SETUP.teamSizeB,
    controllerA: DEFAULT_BATTLE_SETUP.controllerA,
    controllerB: DEFAULT_BATTLE_SETUP.controllerB,
    moduleIdsA: [...DEFAULT_BATTLE_SETUP.moduleIdsA],
    moduleIdsB: [...DEFAULT_BATTLE_SETUP.moduleIdsB],
    accent: '#64dcff'
  },
  {
    id: 'frozen-flame',
    title: 'Frozen Flame',
    description: 'A compact elemental duel built around burn, freeze and momentum.',
    fighterAId: 'pyro-brawler',
    fighterBId: 'frost-warden',
    arenaId: 'cryo-ring',
    modeId: 'duel',
    teamSizeA: 1,
    teamSizeB: 1,
    controllerA: 'player',
    controllerB: 'ai',
    accent: '#ff7a45'
  },
  {
    id: 'arc-breaker',
    title: 'Arc Breaker',
    description: 'Fast electric offense against a massive mechanical defender.',
    fighterAId: 'volt-striker',
    fighterBId: 'mech-bruiser',
    arenaId: 'arc-crucible',
    modeId: 'duel',
    teamSizeA: 1,
    teamSizeB: 1,
    controllerA: 'player',
    controllerB: 'ai',
    accent: '#fff05b'
  },
  {
    id: 'raid-the-void',
    title: 'Raid the Void',
    description: 'Three Thorn Colossi challenge a scaled Void Reaper boss.',
    fighterAId: 'thorn-colossus',
    fighterBId: 'void-reaper',
    arenaId: 'pillar-court',
    modeId: 'boss-raid',
    teamSizeA: 3,
    teamSizeB: 1,
    controllerA: 'player',
    controllerB: 'ai',
    accent: '#8ee06c'
  }
] satisfies readonly QuickBattle[];
