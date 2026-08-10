import type { BroadcastFighterView } from './broadcastScene';

type MatchupFighter = Pick<BroadcastFighterView, 'fighterId' | 'name' | 'identity'>;

const CREATOR_LABELS: Readonly<Record<string, string>> = {
  'pyro-brawler': 'FIRE',
  'water-shaper': 'WATER',
  'frost-warden': 'ICE',
  'mech-bruiser': 'STEEL',
  'volt-striker': 'LIGHTNING',
  'thorn-colossus': 'NATURE',
  gunner: 'BULLETS',
  'rocket-vanguard': 'MISSILES',
  bomber: 'EXPLOSIONS',
  ballast: 'MASS',
  'void-reaper': 'VOID',
  'solar-sentinel': 'SOLAR'
};

const MATCHUP_OVERRIDES: Readonly<Record<string, readonly [string, string]>> = {
  'pyro-brawler|water-shaper': ['FIRE', 'WATER'],
  'pyro-brawler|frost-warden': ['FIRE', 'ICE'],
  'pyro-brawler|mech-bruiser': ['FIRE', 'STEEL'],
  'rocket-vanguard|gunner': ['MISSILES', 'BULLETS'],
  'bomber|water-shaper': ['EXPLOSIONS', 'WATER'],
  'bomber|ballast': ['EXPLOSIONS', 'MASS'],
  'volt-striker|thorn-colossus': ['SPEED', 'NATURE']
};

/** Presentation-only matchup copy for creator intros. */
export function resolveMatchupHook(left: MatchupFighter, right: MatchupFighter): string {
  const direct = MATCHUP_OVERRIDES[`${left.fighterId}|${right.fighterId}`];
  if (direct) return `${direct[0]} vs ${direct[1]}`;

  const reverse = MATCHUP_OVERRIDES[`${right.fighterId}|${left.fighterId}`];
  if (reverse) return `${reverse[1]} vs ${reverse[0]}`;

  return `${resolveCreatorLabel(left)} vs ${resolveCreatorLabel(right)}`;
}

export function resolveCreatorLabel(fighter: MatchupFighter): string {
  const mapped = CREATOR_LABELS[fighter.fighterId];
  if (mapped) return mapped;

  const identity = readableIdentityLabel(fighter.identity);
  if (identity) return identity;

  const name = cleanLabel(fighter.name);
  if (name) return name;

  return cleanLabel(fighter.fighterId) || 'FIGHTER';
}

function readableIdentityLabel(identity: string): string | null {
  const first = identity.split('·')[0]?.split('/')[0]?.trim() ?? '';
  if (!first || /^arena fighter$/i.test(first) || /^fighter$/i.test(first)) return null;
  return cleanLabel(first) || null;
}

function cleanLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
