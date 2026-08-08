import type { SimulationEvent, Vec2 } from '@kinetic/protocol';
import type { CreatorBattleHighlight } from './types';

export const CREATOR_ULTIMATE_SCORE = 760;
export const CREATOR_KNOCKOUT_SCORE = 1_600;

export interface CreatorHighlightSignal {
  tick: number;
  kind: CreatorBattleHighlight['kind'];
  score: number;
  position: Vec2 | null;
}

/**
 * Shared deterministic creator-highlight scoring used by summary/thumbnail
 * analysis and the Stage 8.11C cinematic presentation planner.
 */
export function scoreCreatorHighlightEvent(event: SimulationEvent): CreatorHighlightSignal | null {
  if (event.type === 'abilityActivated' && event.slot === 'ultimate') {
    return {
      tick: event.tick,
      kind: 'ultimate',
      score: CREATOR_ULTIMATE_SCORE + Math.max(0, event.castTicks),
      position: event.position
    };
  }

  if (event.type === 'damage' && !event.prevented && event.amount > 0) {
    return {
      tick: event.tick,
      kind: event.hpAfter <= 0 ? 'knockout' : 'heavy-hit',
      score: 420 + event.amount * 2.2 + (event.hpAfter <= 0 ? 650 : 0),
      position: event.position ?? null
    };
  }

  if (event.type === 'death') {
    return {
      tick: event.tick,
      kind: 'knockout',
      score: CREATOR_KNOCKOUT_SCORE,
      position: event.position
    };
  }

  return null;
}
