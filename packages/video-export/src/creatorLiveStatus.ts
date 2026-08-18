import type { BroadcastAbilityView, BroadcastFighterView, BroadcastStatusView } from './broadcastScene';

export interface CreatorLiveStatus {
  action: string;
  status: string | null;
  resource: string | null;
}

const STATUS_PRIORITY: Readonly<Record<string, number>> = {
  frozen: 100,
  rooted: 95,
  pinned: 94,
  suppressed: 92,
  shocked: 90,
  anchored: 88,
  featherlight: 86,
  burn: 84,
  wet: 82,
  overcharged: 80,
  phased: 78,
  fortified: 76,
  barkskin: 74,
  'cryo-guard': 72,
  'molten-guard': 72,
  'void-mark': 70,
  'target-lock': 68
};

const SLOT_PRIORITY: Readonly<Record<BroadcastAbilityView['slot'], number>> = {
  ultimate: 0,
  skill3: 1,
  skill2: 2,
  skill1: 3,
  basic: 4
};

/**
 * Resolves the small amount of authoritative combat state shown in vertical
 * creator exports. This is presentation-only: it reads snapshot-derived views
 * and never infers actions from particles or other visual effects.
 */
export function resolveCreatorLiveStatus(fighter: BroadcastFighterView): CreatorLiveStatus {
  return {
    action: resolveCurrentAction(fighter.abilities),
    status: resolveImportantStatus(fighter.statuses),
    resource: resolveImportantResource(fighter)
  };
}

function resolveCurrentAction(abilities: readonly BroadcastAbilityView[]): string {
  const active = abilities
    .filter((ability) => ability.phase === 'casting' || ability.phase === 'armed')
    .slice()
    .sort((a, b) => SLOT_PRIORITY[a.slot] - SLOT_PRIORITY[b.slot] || a.id.localeCompare(b.id));
  const special = active.find((ability) => ability.slot !== 'basic');
  if (special) return `${special.name} · ACTIVE`;
  // Basic attacks are intentionally folded into the neutral state so this
  // compact strip does not flicker on every primary-attack cycle.
  return 'Ready';
}

function resolveImportantStatus(statuses: readonly BroadcastStatusView[]): string | null {
  const status = statuses
    .slice()
    .sort((a, b) => statusPriority(b) - statusPriority(a) || a.id.localeCompare(b.id))[0];
  if (!status) return null;
  return status.stacks > 1 ? `${status.name} ×${status.stacks}` : status.name;
}

function statusPriority(status: BroadcastStatusView): number {
  return STATUS_PRIORITY[status.id] ?? 40;
}

function resolveImportantResource(fighter: BroadcastFighterView): string | null {
  if (fighter.resource && fighter.resource.maximum > 0) {
    return `${fighter.resource.name} ${Math.round(fighter.resource.ratio * 100)}%`;
  }
  const ultimate = fighter.abilities.find((ability) => ability.slot === 'ultimate');
  if (!ultimate) return null;
  return `Ult ${Math.round(ultimate.readiness * 100)}%`;
}
