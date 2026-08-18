import type { BroadcastFighterView } from './broadcastScene';

type MatchupFighter = Pick<BroadcastFighterView, 'fighterId' | 'name' | 'identity'> & {
  memberCount?: number;
};

const CREATOR_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'pyro-brawler': 'Fire',
  'water-shaper': 'Water',
  'frost-warden': 'Ice',
  'mech-bruiser': 'Steel',
  'volt-striker': 'Lightning',
  'thorn-colossus': 'Nature',
  gunner: 'Gun',
  'rocket-vanguard': 'Missile',
  bomber: 'Bomb',
  ballast: 'Mass',
  'void-reaper': 'Void',
  'solar-sentinel': 'Laser',
  'blade-vanguard': 'Sword',
  'iron-lancer': 'Spear'
};

const CREATOR_LABELS: Readonly<Record<string, string>> = {
  'pyro-brawler': 'FIRE',
  'water-shaper': 'WATER',
  'frost-warden': 'ICE',
  'mech-bruiser': 'STEEL',
  'volt-striker': 'LIGHTNING',
  'thorn-colossus': 'NATURE',
  gunner: 'GUNS',
  'rocket-vanguard': 'MISSILES',
  bomber: 'BOMBS',
  ballast: 'MASS',
  'void-reaper': 'VOID',
  'solar-sentinel': 'LASERS',
  'blade-vanguard': 'SWORD',
  'iron-lancer': 'SPEAR'
};

const MATCHUP_OVERRIDES: Readonly<Record<string, readonly [string, string]>> = {
  'pyro-brawler|water-shaper': ['FIRE', 'WATER'],
  'pyro-brawler|frost-warden': ['FIRE', 'ICE'],
  'pyro-brawler|mech-bruiser': ['FIRE', 'STEEL'],
  'pyro-brawler|gunner': ['FIRE', 'GUNS'],
  'pyro-brawler|bomber': ['FIRE', 'BOMBS'],
  'frost-warden|bomber': ['ICE', 'BOMBS'],
  'gunner|bomber': ['GUNS', 'BOMBS'],
  'solar-sentinel|gunner': ['LASERS', 'GUNS'],
  'solar-sentinel|bomber': ['LASERS', 'BOMBS'],
  'rocket-vanguard|gunner': ['MISSILES', 'GUNS'],
  'bomber|water-shaper': ['BOMBS', 'WATER'],
  'bomber|ballast': ['BOMBS', 'MASS'],
  'volt-striker|thorn-colossus': ['SPEED', 'NATURE']
};

/**
 * Presentation-only fighter name used by creator/Shorts surfaces.
 * Internal fighter IDs and authored roster names stay unchanged so gameplay,
 * content references, replays and analytics remain stable.
 */
export function resolveCreatorFighterName(fighter: MatchupFighter): string {
  if ((fighter.memberCount ?? 1) > 1) return fighter.name;
  return resolveCreatorDisplayName(fighter.fighterId, fighter.name);
}

export function resolveCreatorDisplayName(fighterId: string, fallbackName: string): string {
  return CREATOR_DISPLAY_NAMES[fighterId] ?? fallbackName;
}

/** Presentation-only matchup copy for creator overlays/intros. */
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
