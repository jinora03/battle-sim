import type { Vec2 } from '@kinetic/protocol';

export type ChargePresentationKind =
  | 'sweep'
  | 'brace'
  | 'heavy'
  | 'unstable'
  | 'electric'
  | 'gravity'
  | 'steady';

export interface ChargePresentationProfile {
  kind: ChargePresentationKind;
  shakeScale: number;
  shakeFrequency: number;
  trailOrbs: number;
  trailSpacing: number;
  bodyCompression: number;
  weaponBackScale: number;
  weaponRotationRadians: number;
}

export interface ChargeBodyPose {
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface ChargeWeaponPose {
  x: number;
  y: number;
  rotation: number;
}

const CHARGE_PRESENTATION_PROFILES: Readonly<Record<string, ChargePresentationProfile>> = {
  'driving-slash': {
    kind: 'sweep', shakeScale: 0.11, shakeFrequency: 82, trailOrbs: 0, trailSpacing: 0.36,
    bodyCompression: 0.11, weaponBackScale: 0.4, weaponRotationRadians: 2.7
  },
  'lance-charge': {
    kind: 'brace', shakeScale: 0.12, shakeFrequency: 76, trailOrbs: 0, trailSpacing: 0.34,
    bodyCompression: 0.13, weaponBackScale: 0.42, weaponRotationRadians: 0
  },
  'breakthrough-charge': {
    kind: 'brace', shakeScale: 0.15, shakeFrequency: 92, trailOrbs: 0, trailSpacing: 0.32,
    bodyCompression: 0.16, weaponBackScale: 0.5, weaponRotationRadians: 0
  },
  'blast-dash': {
    kind: 'unstable', shakeScale: 0.065, shakeFrequency: 92, trailOrbs: 4, trailSpacing: 0.46,
    bodyCompression: 0.04, weaponBackScale: 0, weaponRotationRadians: 0
  },
  'lightning-dash': {
    kind: 'electric', shakeScale: 0.06, shakeFrequency: 108, trailOrbs: 5, trailSpacing: 0.34,
    bodyCompression: 0.035, weaponBackScale: 0, weaponRotationRadians: 0
  },
  'bramble-charge': {
    kind: 'heavy', shakeScale: 0.07, shakeFrequency: 50, trailOrbs: 0, trailSpacing: 0.42,
    bodyCompression: 0.13, weaponBackScale: 0.3, weaponRotationRadians: 0.22
  },
  'solar-rush': {
    kind: 'heavy', shakeScale: 0.075, shakeFrequency: 76, trailOrbs: 0, trailSpacing: 0.38,
    bodyCompression: 0.1, weaponBackScale: 0.34, weaponRotationRadians: -0.1
  },
  'kinetic-pulse': {
    kind: 'heavy', shakeScale: 0.04, shakeFrequency: 54, trailOrbs: 3, trailSpacing: 0.5,
    bodyCompression: 0.1, weaponBackScale: 0.14, weaponRotationRadians: -0.06
  },
  downbeat: {
    kind: 'gravity', shakeScale: 0.035, shakeFrequency: 42, trailOrbs: 3, trailSpacing: 0.54,
    bodyCompression: 0.12, weaponBackScale: 0, weaponRotationRadians: 0
  },
  'glacier-charge': {
    kind: 'steady', shakeScale: 0.045, shakeFrequency: 42, trailOrbs: 0, trailSpacing: 0.42,
    bodyCompression: 0.09, weaponBackScale: 0.38, weaponRotationRadians: -0.5
  },
  'phase-lunge': {
    kind: 'gravity', shakeScale: 0.075, shakeFrequency: 66, trailOrbs: 0, trailSpacing: 0.38,
    bodyCompression: 0.08, weaponBackScale: 0.36, weaponRotationRadians: 1.42
  }
};

export function getChargePresentationProfile(abilityId: string): ChargePresentationProfile | null {
  return CHARGE_PRESENTATION_PROFILES[abilityId] ?? null;
}

export function resolveChargeBodyPose(
  profile: ChargePresentationProfile,
  progress: number
): ChargeBodyPose {
  const t = Math.max(0, Math.min(1, progress));
  const load = t * t * (3 - 2 * t);
  return {
    scaleX: 1 - profile.bodyCompression * load,
    scaleY: 1 + profile.bodyCompression * 0.55 * load,
    rotation: profile.kind === 'sweep' ? -0.08 * load : 0
  };
}

export function resolveChargeWeaponPose(
  profile: ChargePresentationProfile,
  progress: number,
  fighterRadius: number
): ChargeWeaponPose {
  const t = Math.max(0, Math.min(1, progress));
  const load = t * t * (3 - 2 * t);
  return {
    x: -fighterRadius * profile.weaponBackScale * load,
    y: profile.kind === 'sweep' ? fighterRadius * 0.035 * load : 0,
    rotation: profile.weaponRotationRadians * load
  };
}

export function resolveChargeShake(
  profile: ChargePresentationProfile,
  direction: Vec2 | null,
  elapsedSeconds: number,
  progress: number,
  fighterRadius: number,
  reducedMotion: boolean
): Vec2 {
  if (!direction || reducedMotion) return { x: 0, y: 0 };
  const length = Math.hypot(direction.x, direction.y) || 1;
  const dx = direction.x / length;
  const dy = direction.y / length;
  const t = Math.max(0, Math.min(1, progress));
  const build = 0.15 + t * 0.85;
  const amplitude = fighterRadius * profile.shakeScale * build;
  const lateral = Math.sin(elapsedSeconds * profile.shakeFrequency) * amplitude;
  const longitudinal = Math.sin(elapsedSeconds * profile.shakeFrequency * 0.61 + 0.7) * amplitude * 0.28;
  return {
    x: -dy * lateral + dx * longitudinal,
    y: dx * lateral + dy * longitudinal
  };
}

export function resolveChargeTravelWeaponPose(
  abilityId: string,
  fighterRadius: number
): ChargeWeaponPose {
  switch (abilityId) {
    case 'driving-slash': return { x: fighterRadius * 0.18, y: 0, rotation: -0.34 };
    case 'lance-charge': return { x: fighterRadius * 0.28, y: 0, rotation: 0 };
    case 'breakthrough-charge': return { x: fighterRadius * 0.34, y: 0, rotation: 0 };
    case 'glacier-charge': return { x: fighterRadius * 0.2, y: 0, rotation: 0.14 };
    case 'bramble-charge': return { x: fighterRadius * 0.16, y: 0, rotation: 0.08 };
    case 'phase-lunge': return { x: fighterRadius * 0.2, y: 0, rotation: -0.28 };
    default: return { x: 0, y: 0, rotation: 0 };
  }
}

export function resolveChargeWeaponTipScale(form: string): number {
  switch (form) {
    case 'sword': return 2.16;
    case 'spear': return 1.78;
    case 'axe': return 1.68;
    case 'void': return 1.7;
    case 'claws': return 1.42;
    case 'gauntlet': return 1.46;
    case 'hammer': return 1.62;
    default: return 1.68;
  }
}

export function resolveChargeTravelAbility(
  fighterId: string,
  statuses: readonly { statusId: string }[],
  abilities: readonly {
    abilityId: string;
    phase: string;
    cooldownRemainingTicks: number;
    cooldownTotalTicks: number;
  }[]
): string | null {
  const has = (statusId: string) => statuses.some((status) => status.statusId === statusId);
  const recentlyResolved = (abilityId: string, travelTicks: number) => {
    const state = abilities.find((ability) => ability.abilityId === abilityId);
    if (!state || state.phase !== 'cooldown') return false;
    const age = Math.max(0, state.cooldownTotalTicks - state.cooldownRemainingTicks);
    return age <= travelTicks;
  };

  if (fighterId === 'blade-vanguard' && has('driving-slash') && recentlyResolved('driving-slash', 96)) return 'driving-slash';
  if (fighterId === 'iron-lancer' && has('breakthrough-charge') && recentlyResolved('breakthrough-charge', 126)) return 'breakthrough-charge';
  if (fighterId === 'iron-lancer' && has('lance-charge') && recentlyResolved('lance-charge', 110)) return 'lance-charge';
  if (fighterId === 'frost-warden' && has('cryo-guard') && recentlyResolved('glacier-charge', 98)) return 'glacier-charge';
  if (fighterId === 'thorn-colossus' && has('barkskin') && recentlyResolved('bramble-charge', 116)) return 'bramble-charge';
  if (fighterId === 'void-reaper' && has('phased') && recentlyResolved('phase-lunge', 96)) return 'phase-lunge';
  return null;
}

export interface ChargeReleasePose extends ChargeWeaponPose {
  abilityId: 'driving-slash' | 'lance-charge' | 'breakthrough-charge';
  progress: number;
}

const CHARGE_RELEASE_WINDOWS = {
  'driving-slash': { totalTicks: 96, releaseTicks: 12 },
  'lance-charge': { totalTicks: 110, releaseTicks: 11 },
  'breakthrough-charge': { totalTicks: 126, releaseTicks: 14 }
} as const;

/**
 * Very short post-cast follow-through derived from the charge status itself.
 * This is presentation-only: it does not change the simulation impulse or hit timing.
 */
export function resolveChargeReleasePose(
  statuses: readonly { statusId: string; remainingTicks: number }[],
  fighterRadius: number
): ChargeReleasePose | null {
  for (const abilityId of Object.keys(CHARGE_RELEASE_WINDOWS) as Array<keyof typeof CHARGE_RELEASE_WINDOWS>) {
    const status = statuses.find((candidate) => candidate.statusId === abilityId);
    if (!status) continue;
    const window = CHARGE_RELEASE_WINDOWS[abilityId];
    const ageTicks = Math.max(0, window.totalTicks - status.remainingTicks);
    if (ageTicks > window.releaseTicks) continue;
    const progress = Math.max(0, Math.min(1, ageTicks / window.releaseTicks));
    const eased = progress * progress * (3 - 2 * progress);

    if (abilityId === 'driving-slash') {
      return {
        abilityId,
        progress,
        x: -fighterRadius * 0.18 * (1 - eased) + fighterRadius * 0.12 * Math.sin(progress * Math.PI),
        y: fighterRadius * 0.035 * (1 - eased),
        rotation: 2.35 * (1 - eased) - 0.42 * Math.sin(progress * Math.PI)
      };
    }

    const power = abilityId === 'breakthrough-charge' ? 0.18 : 0.12;
    return {
      abilityId,
      progress,
      x: -fighterRadius * 0.2 * (1 - eased) + fighterRadius * power * Math.sin(progress * Math.PI),
      y: 0,
      rotation: 0
    };
  }
  return null;
}
