import { getFighter, type GameModeDefinition } from '@kinetic/content';
import type { DeviceCapabilities, ViewportMetrics } from '@kinetic/platform';
import type { RuntimeDiagnostics } from '../../runtime/BattleRuntime';
import type { BattleSetup } from '../../runtime/BattleSetup';

export function sameBattleSetup(a: BattleSetup, b: BattleSetup): boolean {
  return a.fighterAId === b.fighterAId
    && a.fighterBId === b.fighterBId
    && sameStringList(a.moduleIdsA, b.moduleIdsA)
    && sameStringList(a.moduleIdsB, b.moduleIdsB)
    && a.controllerA === b.controllerA
    && a.controllerB === b.controllerB
    && a.arenaId === b.arenaId
    && a.modeId === b.modeId
    && a.teamSizeA === b.teamSizeA
    && a.teamSizeB === b.teamSizeB
    && a.friendlyFire === b.friendlyFire
    && a.teamCollision === b.teamCollision
    && a.difficulty === b.difficulty;
}

export function describeBattleResult(
  diagnostics: RuntimeDiagnostics,
  mode: GameModeDefinition | undefined
): { title: string; description: string; compact: string } {
  const result = diagnostics.result;
  if (!result) return { title: 'Battle in progress', description: '', compact: `${diagnostics.entities.length} active` };
  if (result.reason === 'draw' || result.winningTeam === null) {
    return { title: 'Draw', description: `No side secured the objective after ${Math.max(1, Math.round(result.endedAtTick / 60))} seconds.`, compact: 'Draw' };
  }
  if (result.reason === 'boss-defeated') {
    return { title: 'Boss Defeated', description: `Team ${result.winningTeam} destroyed the boss and completed the raid.`, compact: 'Boss defeated' };
  }
  if (result.reason === 'survival-complete') {
    return { title: 'Survival Complete', description: `Team ${result.winningTeam} survived the full trial.`, compact: `Team ${result.winningTeam} survived` };
  }
  if (mode?.id === 'duel' && result.winnerEntityIds.length === 1) {
    const winner = diagnostics.entities.find((entity) => entity.id === result.winnerEntityIds[0]);
    const name = winner ? getFighter(winner.fighterId).name : `Team ${result.winningTeam}`;
    return { title: `${name} Wins`, description: `Victory was declared at ${Math.max(1, Math.round(result.endedAtTick / 60))} seconds.`, compact: `${name} won` };
  }
  return {
    title: `Team ${result.winningTeam} Wins`,
    description: result.reason === 'timeout' ? 'Time expired; the team with the stronger surviving force wins.' : 'The opposing force has been eliminated.',
    compact: `Team ${result.winningTeam} won`
  };
}

export function sameDeviceCapabilities(a: DeviceCapabilities, b: DeviceCapabilities): boolean {
  return a.mobile === b.mobile
    && a.coarsePointer === b.coarsePointer
    && a.anyCoarsePointer === b.anyCoarsePointer
    && a.hoverCapable === b.hoverCapable
    && a.touchPoints === b.touchPoints
    && a.touchFirst === b.touchFirst
    && a.reducedMotion === b.reducedMotion
    && a.hardwareConcurrency === b.hardwareConcurrency
    && a.deviceMemoryGb === b.deviceMemoryGb
    && a.saveData === b.saveData
    && Math.abs(a.devicePixelRatio - b.devicePixelRatio) < 0.01;
}

export function sameViewportMetrics(a: ViewportMetrics, b: ViewportMetrics): boolean {
  return a.width === b.width
    && a.height === b.height
    && a.layoutWidth === b.layoutWidth
    && a.layoutHeight === b.layoutHeight
    && a.orientation === b.orientation
    && a.viewportClass === b.viewportClass
    && a.displayShape === b.displayShape
    && a.compact === b.compact
    && a.shortLandscape === b.shortLandscape
    && a.standalone === b.standalone
    && a.fullscreen === b.fullscreen;
}

let seedNonce = 0;

export function resolveFreshRematchSeed(currentSeed: number, candidateSeed: number): number {
  const current = (Math.trunc(currentSeed) >>> 0) || 1;
  const candidate = (Math.trunc(candidateSeed) >>> 0) || 1;
  if (candidate !== current) return candidate;
  return ((candidate + 1) >>> 0) || 1;
}

export function generateRandomSeed(): number {
  seedNonce = (seedNonce + 1) >>> 0;

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);

    const first = values[0] ?? 0;
    const second = values[1] ?? 0;

    const mixed = (
      first
      ^ second
      ^ (Date.now() >>> 0)
      ^ ((seedNonce * 2654435761) >>> 0)
    ) >>> 0;

    return mixed || 1;
  }

  return (
    Date.now()
    ^ Math.floor(performance.now() * 1000)
    ^ ((seedNonce * 2654435761) >>> 0)
  ) >>> 0 || 1;
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
