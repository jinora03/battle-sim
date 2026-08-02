export type BattleLaunchPhase = 'ready' | 'intro' | 'running';

export const FULL_BATTLE_INTRO_DURATION_MS = 2_200;
export const REDUCED_MOTION_BATTLE_INTRO_DURATION_MS = 850;

export function initialLaunchPhase(showBattleIntros: boolean): BattleLaunchPhase {
  return showBattleIntros ? 'intro' : 'running';
}

export function battleLaunchPausesSimulation(phase: BattleLaunchPhase): boolean {
  return phase !== 'running';
}

export function battleIntroDurationMs(reducedMotion: boolean): number {
  return reducedMotion
    ? REDUCED_MOTION_BATTLE_INTRO_DURATION_MS
    : FULL_BATTLE_INTRO_DURATION_MS;
}
