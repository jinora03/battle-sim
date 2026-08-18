import { describe, expect, it } from 'vitest';
import {
  buildBattleIntelligenceFindings,
  type MatchupMatrixResult
} from '@kinetic/video-export';

describe('Stage 9A.6 intelligence findings', () => {
  it('surfaces balance, ability, AI and pacing signals without changing data', () => {
    const source = {
      fighters: [
        { id: 'gunner', name: 'Gunner' },
        { id: 'bomber', name: 'Bomber' }
      ],
      sampleSizePerMatchup: 50,
      totalPairings: 1,
      totalBattles: 50,
      cells: [{
        fighterAId: 'bomber', fighterBId: 'gunner', sampleSize: 50,
        fighterAWins: 40, fighterBWins: 10, fighterAWinRate: 0.8, fighterBWinRate: 0.2,
        drawRate: 0, timeoutRate: 0, safetyLimitRate: 0,
        medianDurationSeconds: 18, averageDurationSeconds: 19,
        averageTotalDamage: 1200, averageUltimates: 1.2,
        closeFightRate: 0.2, oneSidedFightRate: 0.4,
        bestCreatorSeed: 12, bestCreatorScore: 80, bestCreatorOrientation: 'forward'
      }],
      fighterSummaries: [{
        fighterId: 'bomber', matchupCount: 1, battleSamples: 50, wins: 40, losses: 10, draws: 0,
        winRate: 0.8, drawRate: 0, averageMedianDurationSeconds: 18,
        closeFightRate: 0.2, oneSidedFightRate: 0.4,
        strongestOpponentId: 'gunner', strongestOpponentWinRate: 0.8,
        weakestOpponentId: 'gunner', weakestOpponentWinRate: 0.8
      }, {
        fighterId: 'gunner', matchupCount: 1, battleSamples: 50, wins: 10, losses: 40, draws: 0,
        winRate: 0.2, drawRate: 0, averageMedianDurationSeconds: 18,
        closeFightRate: 0.2, oneSidedFightRate: 0.4,
        strongestOpponentId: 'bomber', strongestOpponentWinRate: 0.2,
        weakestOpponentId: 'bomber', weakestOpponentWinRate: 0.2
      }],
      abilityAnalytics: {
        fighters: [{
          fighterId: 'gunner', battleSamples: 50, totalDamage: 1000, attributedDamage: 800,
          unattributedDamage: 200, attributedDamageRate: 0.8,
          primaryAttack: {
            fighterId: 'gunner', actionId: 'automatic-rifle', name: 'Automatic Rifle', kind: 'primary', slot: 'basic',
            battleSamples: 50, battlesUsed: 50, uses: 500, usesPerBattle: 10, usageRate: 1, neverUsedRate: 0,
            resolutions: 0, completionRate: 1, damageHits: 300, hitsPerUse: 0.6, damage: 700,
            damagePerBattle: 14, damageContribution: 0.7, effectEvents: 300, kills: 5, averageFirstUseSeconds: 1
          },
          abilities: [{
            fighterId: 'gunner', actionId: 'suppressive-fire', name: 'Suppressive Fire', kind: 'ability', slot: 'skill2',
            battleSamples: 50, battlesUsed: 5, uses: 5, usesPerBattle: 0.1, usageRate: 0.1, neverUsedRate: 0.9,
            resolutions: 5, completionRate: 1, damageHits: 2, hitsPerUse: 0.4, damage: 50,
            damagePerBattle: 1, damageContribution: 0.05, effectEvents: 5, kills: 0, averageFirstUseSeconds: 8
          }]
        }]
      },
      aiDecisionAnalytics: {
        fighters: [{
          fighterId: 'gunner', battleSamples: 50, decisionEvaluations: 100, decisionsPerBattle: 2,
          primarySelections: 40, abilitySelections: 10, repositionDecisions: 50, idleDecisions: 0,
          primarySelectionRate: 0.4, abilitySelectionRate: 0.1, repositionRate: 0.5,
          actions: [{
            fighterId: 'gunner', actionId: 'suppressive-fire', name: 'Suppressive Fire', slot: 'skill2', source: 'ability',
            evaluations: 100, validOpportunities: 30, validOpportunityRate: 0.3, selections: 3,
            selectionRateWhenValid: 0.1, readyButSkipped: 27, readyButSkippedRate: 0.9,
            blockedEvaluations: 70, blockedRate: 0.7, averageValidScore: 50, blockReasons: []
          }]
        }]
      },
      pacingAnalytics: {
        overall: {
          battleSamples: 50, averageDurationSeconds: 16, medianDurationSeconds: 15,
          shortFightRate: 0.35, longFightRate: 0.02, slowOpeningRate: 0.1,
          averageFirstDamageSeconds: 2, averageFirstSkillSeconds: 4, averageFirstUltimateSeconds: 12,
          ultimateBattleRate: 0.8, averageFirstKoSeconds: 14, koBattleRate: 0.98,
          averageLongestQuietGapSeconds: 7, averageQuietTimeRatio: 0.2, stallBattleRate: 0.3,
          timeoutRate: 0, safetyLimitRate: 0
        },
        fighters: []
      }
    } satisfies Omit<MatchupMatrixResult, 'findings'>;

    const findings = buildBattleIntelligenceFindings(source);
    expect(findings.some((finding) => finding.title === 'High roster win rate')).toBe(true);
    expect(findings.some((finding) => finding.title === 'Ability rarely used')).toBe(true);
    expect(findings.some((finding) => finding.title === 'Valid action frequently skipped')).toBe(true);
    expect(findings.some((finding) => finding.title === 'Combat inactivity detected')).toBe(true);
    expect(source.fighterSummaries[0]!.winRate).toBe(0.8);
  });
});
