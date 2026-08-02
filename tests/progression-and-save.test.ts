import { describe, expect, it } from 'vitest';
import {
  applyAchievementToProfile,
  createDefaultPlayerProfile,
  getChallengeProgress,
  migratePlayerProfile,
  parsePlayerProfile,
  recordBattleToProfile,
  serializePlayerProfile,
  upsertBattlePreset,
  type BattleCompletionSummary,
  type FighterStats
} from '@kinetic/meta';
import type { BattleDefinition } from '@kinetic/protocol';

const fighterStats: FighterStats = {
  damageDealt: 420,
  damageTaken: 80,
  kills: 1,
  wallHits: 3,
  maxImpact: 48,
  abilitiesUsed: 21,
  blasts: 4,
  obstaclesDestroyed: 1,
  hazardHits: 0
};

function summary(seed: number, difficulty: BattleCompletionSummary['difficulty'] = 'standard'): BattleCompletionSummary {
  const battle: BattleDefinition = {
    seed,
    arenaId: seed % 2 === 0 ? 'pillar-court' : 'elemental-foundry',
    modeId: 'duel',
    participants: [
      { fighterId: 'water-shaper', team: 1, controller: 'player' },
      { fighterId: 'bomber', team: 2, controller: 'ai' }
    ]
  };
  return {
    battle,
    durationTicks: 900,
    winningTeam: 1,
    playerTeam: 1,
    stats: { 0: fighterStats },
    difficulty
  };
}

describe('v0.8 progression and persistent profile', () => {
  it('migrates incomplete save data into a valid current profile', () => {
    const migrated = migratePlayerProfile({ displayName: 'Brian', xp: 720, unlockedFighterIds: ['water-shaper'] }, 1000);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.displayName).toBe('Brian');
    expect(migrated.level).toBeGreaterThan(1);
    expect(migrated.totals.battles).toBe(0);
  });

  it('persists achievement unlocks and fighter rewards', () => {
    const profile = createDefaultPlayerProfile(1);
    const update = applyAchievementToProfile(profile, {
      id: 'first-blood',
      name: 'First Blood',
      description: 'Witness a knockout.',
      xp: 80,
      unlockFighterId: 'pyro-brawler'
    }, 2);
    expect(update.profile.unlockedAchievementIds).toContain('first-blood');
    expect(update.profile.unlockedFighterIds).toContain('pyro-brawler');
    expect(update.xpGained).toBe(80);
  });

  it('records match history, statistics, challenges and difficulty-scaled XP', () => {
    let profile = createDefaultPlayerProfile(1);
    const standard = recordBattleToProfile(profile, summary(10, 'standard'), 10);
    profile = standard.profile;
    profile = recordBattleToProfile(profile, summary(11, 'standard'), 11).profile;
    const third = recordBattleToProfile(profile, summary(12, 'intense'), 12);

    expect(third.profile.totals.battles).toBe(3);
    expect(third.profile.totals.wins).toBe(3);
    expect(third.profile.matchHistory).toHaveLength(3);
    expect(third.profile.totals.damageDealt).toBe(1260);
    expect(getChallengeProgress(third.profile).find((item) => item.id === 'battle-tested')?.claimed).toBe(true);
    expect(third.profile.matchHistory[0]?.xpEarned).toBeGreaterThan(standard.profile.matchHistory[0]?.xpEarned ?? 0);
  });

  it('round-trips portable profile JSON and saves battle loadouts', () => {
    let profile = createDefaultPlayerProfile(1);
    profile = upsertBattlePreset(profile, {
      name: 'Drone Gunner',
      fighterAId: 'gunner',
      fighterBId: 'bomber',
      moduleIdsA: ['targeting-drone'],
      moduleIdsB: [],
      controllerA: 'player',
      controllerB: 'ai',
      arenaId: 'pillar-court',
      modeId: 'duel',
      teamSizeA: 1,
      teamSizeB: 1,
      friendlyFire: false,
      teamCollision: 'full',
      difficulty: 'standard'
    }, 15);
    const restored = parsePlayerProfile(serializePlayerProfile(profile));
    expect(restored.loadouts).toHaveLength(1);
    expect(restored.loadouts[0]?.name).toBe('Drone Gunner');
    expect(restored.loadouts[0]?.moduleIdsA).toEqual(['targeting-drone']);
    expect(restored.playerId).toBe(profile.playerId);
  });
});
