import { getAbilityActivationProfile } from '@kinetic/content';
import type { MatchupMatrixResult } from './matchupMatrix';

export type BattleIntelligenceFindingSeverity = 'high' | 'watch' | 'info';
export type BattleIntelligenceFindingCategory = 'balance' | 'ability' | 'ai' | 'pacing' | 'reliability';

export interface BattleIntelligenceFinding {
  id: string;
  severity: BattleIntelligenceFindingSeverity;
  category: BattleIntelligenceFindingCategory;
  title: string;
  detail: string;
  fighterId?: string;
  opponentId?: string;
  actionId?: string;
}

/**
 * Conservative, explainable heuristics for Stage 9A.6. Findings are signals to
 * inspect, not automatic balance changes or claims that a fighter is broken.
 */
export function buildBattleIntelligenceFindings(result: Omit<MatchupMatrixResult, 'findings'>): BattleIntelligenceFinding[] {
  const findings: BattleIntelligenceFinding[] = [];

  for (const fighter of result.fighterSummaries) {
    if (fighter.battleSamples < 20) continue;
    if (fighter.winRate >= 0.62) {
      findings.push({
        id: `balance-high-${fighter.fighterId}`,
        severity: fighter.winRate >= 0.68 ? 'high' : 'watch',
        category: 'balance',
        fighterId: fighter.fighterId,
        title: 'High roster win rate',
        detail: `${fighter.fighterId} wins ${percent(fighter.winRate)} across ${fighter.battleSamples} baseline battle samples.`
      });
    } else if (fighter.winRate <= 0.38) {
      findings.push({
        id: `balance-low-${fighter.fighterId}`,
        severity: fighter.winRate <= 0.32 ? 'high' : 'watch',
        category: 'balance',
        fighterId: fighter.fighterId,
        title: 'Low roster win rate',
        detail: `${fighter.fighterId} wins ${percent(fighter.winRate)} across ${fighter.battleSamples} baseline battle samples.`
      });
    }
  }

  const extremeMatchups = result.cells
    .map((cell) => {
      const highRate = Math.max(cell.fighterAWinRate, cell.fighterBWinRate);
      const strongerId = cell.fighterAWinRate >= cell.fighterBWinRate ? cell.fighterAId : cell.fighterBId;
      const weakerId = strongerId === cell.fighterAId ? cell.fighterBId : cell.fighterAId;
      return { cell, highRate, strongerId, weakerId };
    })
    .filter(({ cell, highRate }) => cell.sampleSize >= 10 && highRate >= 0.7)
    .sort((a, b) => b.highRate - a.highRate)
    .slice(0, 8);

  for (const matchup of extremeMatchups) {
    findings.push({
      id: `matchup-${matchup.strongerId}-${matchup.weakerId}`,
      severity: matchup.highRate >= 0.8 ? 'high' : 'watch',
      category: 'balance',
      fighterId: matchup.strongerId,
      opponentId: matchup.weakerId,
      title: 'Matchup outlier',
      detail: `${matchup.strongerId} wins ${percent(matchup.highRate)} against ${matchup.weakerId} across ${matchup.cell.sampleSize} side-balanced samples.`
    });
  }

  for (const fighter of result.abilityAnalytics.fighters) {
    for (const action of fighter.abilities) {
      if (action.battleSamples < 20) continue;
      if (action.usageRate <= 0.25) {
        findings.push({
          id: `ability-rare-${fighter.fighterId}-${action.actionId}`,
          severity: action.usageRate <= 0.1 ? 'high' : 'watch',
          category: 'ability',
          fighterId: fighter.fighterId,
          actionId: action.actionId,
          title: 'Ability rarely used',
          detail: `${action.name} appears in only ${percent(action.usageRate)} of ${action.battleSamples} sampled battles.`
        });
      }
      if (action.uses >= 10 && action.completionRate < 0.65) {
        const activation = getAbilityActivationProfile(action.actionId);
        const collisionFollowThrough = activation.collisionWindowTicks > 0;
        findings.push({
          id: `ability-completion-${fighter.fighterId}-${action.actionId}`,
          severity: collisionFollowThrough ? 'watch' : action.completionRate < 0.4 ? 'high' : 'watch',
          category: 'ability',
          fighterId: fighter.fighterId,
          actionId: action.actionId,
          title: collisionFollowThrough ? 'Low collision follow-through' : 'Low cast completion',
          detail: collisionFollowThrough
            ? `${action.name} converts ${percent(action.completionRate)} of activations into its collision follow-through window.`
            : `${action.name} resolves after ${percent(action.completionRate)} of observed activations.`
        });
      }
      if (action.slot === 'ultimate' && action.damageContribution >= 0.45 && fighter.attributedDamageRate >= 0.6) {
        findings.push({
          id: `ability-concentration-${fighter.fighterId}-${action.actionId}`,
          severity: 'watch',
          category: 'ability',
          fighterId: fighter.fighterId,
          actionId: action.actionId,
          title: 'Damage concentrated in ultimate',
          detail: `${action.name} accounts for ${percent(action.damageContribution)} of measured fighter damage.`
        });
      }
    }
  }

  for (const fighter of result.aiDecisionAnalytics.fighters) {
    const abilityUsage = result.abilityAnalytics.fighters.find((entry) => entry.fighterId === fighter.fighterId);
    for (const action of fighter.actions) {
      if (action.evaluations < 20) continue;
      if (action.validOpportunities >= 10 && action.readyButSkippedRate >= 0.7) {
        findings.push({
          id: `ai-skipped-${fighter.fighterId}-${action.actionId}`,
          severity: action.readyButSkippedRate >= 0.85 ? 'high' : 'watch',
          category: 'ai',
          fighterId: fighter.fighterId,
          actionId: action.actionId,
          title: 'Valid action frequently skipped',
          detail: `${action.name} is not selected in ${percent(action.readyButSkippedRate)} of valid decision windows.`
        });
      }
      const topBlocker = action.blockReasons[0];
      const expectedAvailabilityBlocker = topBlocker?.category === 'cooldown-or-busy' || topBlocker?.category === 'opening-lockout';
      const measuredUsage = abilityUsage?.abilities.find((entry) => entry.actionId === action.actionId)?.usageRate ?? 1;
      if (
        action.source === 'ability'
        && measuredUsage <= 0.75
        && action.blockedRate >= 0.75
        && topBlocker
        && topBlocker.rate >= 0.5
        && !expectedAvailabilityBlocker
      ) {
        findings.push({
          id: `ai-blocked-${fighter.fighterId}-${action.actionId}-${topBlocker.category}`,
          severity: action.blockedRate >= 0.9 ? 'high' : 'watch',
          category: 'ai',
          fighterId: fighter.fighterId,
          actionId: action.actionId,
          title: 'Action mostly blocked',
          detail: `${action.name} is blocked in ${percent(action.blockedRate)} of evaluations; ${blockerLabel(topBlocker.category)} is the main blocker.`
        });
      }
    }
  }

  const pacing = result.pacingAnalytics.overall;
  if (pacing.battleSamples >= 20) {
    if (pacing.shortFightRate >= 0.25) {
      findings.push({
        id: 'pacing-short-fights',
        severity: pacing.shortFightRate >= 0.45 ? 'high' : 'watch',
        category: 'pacing',
        title: 'Many fights end very quickly',
        detail: `${percent(pacing.shortFightRate)} of sampled battles end before 10 seconds.`
      });
    }
    if (pacing.longFightRate >= 0.15) {
      findings.push({
        id: 'pacing-long-fights',
        severity: pacing.longFightRate >= 0.3 ? 'high' : 'watch',
        category: 'pacing',
        title: 'Long-fight tail',
        detail: `${percent(pacing.longFightRate)} of sampled battles last longer than 45 seconds.`
      });
    }
    if (pacing.stallBattleRate >= 0.15) {
      findings.push({
        id: 'pacing-stalls',
        severity: pacing.stallBattleRate >= 0.3 ? 'high' : 'watch',
        category: 'pacing',
        title: 'Combat inactivity detected',
        detail: `${percent(pacing.stallBattleRate)} of battles contain a combat-quiet gap of at least 6 seconds.`
      });
    }
    if (pacing.slowOpeningRate >= 0.25) {
      findings.push({
        id: 'pacing-slow-openings',
        severity: 'watch',
        category: 'pacing',
        title: 'Slow battle openings',
        detail: `${percent(pacing.slowOpeningRate)} of battles take more than 5 seconds to produce the first damage.`
      });
    }
    if (pacing.timeoutRate >= 0.03 || pacing.safetyLimitRate >= 0.03) {
      findings.push({
        id: 'reliability-unresolved',
        severity: pacing.timeoutRate + pacing.safetyLimitRate >= 0.1 ? 'high' : 'watch',
        category: 'reliability',
        title: 'Unresolved battle rate',
        detail: `${percent(pacing.timeoutRate)} time out and ${percent(pacing.safetyLimitRate)} reach the analysis safety limit.`
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: 'no-strong-signals',
      severity: 'info',
      category: 'balance',
      title: 'No strong diagnostic signal yet',
      detail: 'The current sample does not cross the conservative Stage 9A finding thresholds. Increase samples before making balance changes.'
    });
  }

  return findings
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
    .slice(0, 30);
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function blockerLabel(category: string): string {
  return category.replaceAll('-', ' ');
}

function severityRank(severity: BattleIntelligenceFindingSeverity): number {
  if (severity === 'high') return 0;
  if (severity === 'watch') return 1;
  return 2;
}
