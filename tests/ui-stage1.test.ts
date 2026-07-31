import { describe, expect, it } from 'vitest';
import { getGameMode, listGameModes } from '@kinetic/content';
import {
  aggregateActiveCasts,
  formatModeCapacity,
  noticeDurationMs,
  shouldPauseBattle,
  shouldSuppressNoticeOnCompactViewport
} from '../apps/game/src/ui/presentation';

describe('v1.1 stage 1 UI rules', () => {
  it('describes Duel as 1v1 only and keeps its actual unit limit at two', () => {
    const duel = getGameMode('duel');
    expect(duel.minUnits).toBe(2);
    expect(duel.maxUnits).toBe(2);
    expect(duel.formatLabel).toBe('1v1 only');
    expect(duel.description.toLowerCase()).toContain('1v1');
    expect(formatModeCapacity(duel)).toBe('1v1 only');
  });

  it('provides player-facing descriptions and capacity labels for every mode', () => {
    for (const mode of listGameModes()) {
      expect(mode.description.trim().length).toBeGreaterThan(12);
      expect(formatModeCapacity(mode).trim().length).toBeGreaterThan(2);
    }
  });

  it('auto-dismisses informational notices sooner than major progression notices', () => {
    expect(noticeDurationMs('battle')).toBeLessThan(noticeDurationMs('achievement'));
    expect(noticeDurationMs('achievement')).toBeLessThanOrEqual(noticeDurationMs('fighter'));
  });

  it('suppresses low-priority informational notices on compact screens', () => {
    expect(shouldSuppressNoticeOnCompactViewport('battle', 390)).toBe(true);
    expect(shouldSuppressNoticeOnCompactViewport('achievement', 390)).toBe(false);
    expect(shouldSuppressNoticeOnCompactViewport('battle', 1280)).toBe(false);
  });

  it('keeps manual and browser-lifecycle pause reasons independent', () => {
    expect(shouldPauseBattle(false, false)).toBe(false);
    expect(shouldPauseBattle(true, false)).toBe(true);
    expect(shouldPauseBattle(false, true)).toBe(true);
    expect(shouldPauseBattle(true, true)).toBe(true);
  });

  it('groups repeated skill casts instead of creating one banner per fighter', () => {
    const grouped = aggregateActiveCasts([
      { entityId: 1, fighterName: 'Bomber', abilityId: 'mega-bomb', abilityName: 'Mega Bomb', icon: 'MB', color: 0xff9933, importance: 'ultimate', slot: 'ultimate', progress: 0.3 },
      { entityId: 2, fighterName: 'Bomber', abilityId: 'mega-bomb', abilityName: 'Mega Bomb', icon: 'MB', color: 0xff9933, importance: 'ultimate', slot: 'ultimate', progress: 0.6 },
      { entityId: 3, fighterName: 'Water Shaper', abilityId: 'pressure-wave', abilityName: 'Pressure Wave', icon: 'PW', color: 0x55ccff, importance: 'skill', slot: 'skill2', progress: 0.4 }
    ]);
    expect(grouped.totalCasts).toBe(3);
    expect(grouped.visible).toHaveLength(2);
    expect(grouped.visible[0]?.abilityId).toBe('mega-bomb');
    expect(grouped.visible[0]?.count).toBe(2);
    expect(grouped.visible[0]?.progress).toBe(0.6);
  });
});
