import { describe, expect, it } from 'vitest';
import {
  battleIntroDurationMs,
  battleLaunchPausesSimulation,
  initialLaunchPhase,
  FULL_BATTLE_INTRO_DURATION_MS,
  REDUCED_MOTION_BATTLE_INTRO_DURATION_MS
} from '../apps/game/src/ui/battleLaunch';

describe('Stage 8.1 battle launch and intro flow', () => {
  it('keeps a prepared fight paused until the launch phase is running', () => {
    expect(battleLaunchPausesSimulation('ready')).toBe(true);
    expect(battleLaunchPausesSimulation('intro')).toBe(true);
    expect(battleLaunchPausesSimulation('running')).toBe(false);
  });

  it('skips the intro when the accessibility setting is disabled', () => {
    expect(initialLaunchPhase(true)).toBe('intro');
    expect(initialLaunchPhase(false)).toBe('running');
  });

  it('uses a shorter presentation window for reduced motion', () => {
    expect(battleIntroDurationMs(false)).toBe(FULL_BATTLE_INTRO_DURATION_MS);
    expect(battleIntroDurationMs(true)).toBe(REDUCED_MOTION_BATTLE_INTRO_DURATION_MS);
    expect(REDUCED_MOTION_BATTLE_INTRO_DURATION_MS).toBeLessThan(FULL_BATTLE_INTRO_DURATION_MS);
  });
});
