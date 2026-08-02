import { describe, expect, it } from 'vitest';
import { getFighter, MIN_FIGHTER_RADIUS } from '@kinetic/content';
import type { BattleDefinition } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

const expectedRadii: Readonly<Record<string, number>> = {
  'volt-striker': 45,
  'void-reaper': 46,
  'pyro-brawler': 47,
  gunner: 48,
  'water-shaper': 49,
  'solar-sentinel': 50,
  'rocket-vanguard': 51,
  bomber: 52,
  'frost-warden': 54,
  'mech-bruiser': 57,
  'thorn-colossus': 60
};

describe('Stage 8.2A fighter scale normalization', () => {
  it('uses a 45 minimum and preserves readable role-based size tiers', () => {
    expect(MIN_FIGHTER_RADIUS).toBe(45);
    for (const [fighterId, radius] of Object.entries(expectedRadii)) {
      expect(getFighter(fighterId).physics.radius).toBe(radius);
      expect(radius).toBeGreaterThanOrEqual(MIN_FIGHTER_RADIUS);
    }
    expect(getFighter('thorn-colossus').physics.radius).toBeGreaterThan(getFighter('gunner').physics.radius);
    expect(getFighter('gunner').physics.radius).toBeGreaterThan(getFighter('volt-striker').physics.radius);
  });

  it('uses radius-aware default spawn spacing for compact team battles', () => {
    const participants: BattleDefinition['participants'] = [];
    for (let index = 0; index < 3; index += 1) participants.push({ fighterId: 'gunner', team: 1 });
    for (let index = 0; index < 3; index += 1) participants.push({ fighterId: 'thorn-colossus', team: 2 });

    const runner = new LocalSimulationRunner({
      seed: 8201,
      arenaId: 'pillar-court',
      modeId: 'team-battle',
      participants,
      rules: { maxBattleTicks: 600 }
    });
    const entities = runner.getSnapshot().entities;

    for (let firstIndex = 0; firstIndex < entities.length; firstIndex += 1) {
      const first = entities[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < entities.length; secondIndex += 1) {
        const second = entities[secondIndex]!;
        if (first.team !== second.team) continue;
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        expect(distance).toBeGreaterThanOrEqual(first.radius + second.radius);
      }
    }
  });
});
