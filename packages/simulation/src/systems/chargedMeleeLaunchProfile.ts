import type { AbilityImpulseOptions } from './AbilitySystemTypes';

export interface ChargedMeleeLaunchProfile {
  targetForceMultiplier: number;
  selfForceMultiplier: number;
  targetImpulse: AbilityImpulseOptions;
  selfImpulse: AbilityImpulseOptions;
}

const CHARGED_MELEE_LAUNCH_PROFILES: Readonly<Record<string, ChargedMeleeLaunchProfile>> = {
  'driving-slash': {
    targetForceMultiplier: 1.08,
    selfForceMultiplier: 1.05,
    targetImpulse: { retention: 0.993, maxSpeed: 68, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.968, maxSpeed: 42, trailStrength: 0.68 }
  },
  'lance-charge': {
    targetForceMultiplier: 1.1,
    selfForceMultiplier: 1.07,
    targetImpulse: { retention: 0.994, maxSpeed: 69, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.974, maxSpeed: 44, trailStrength: 0.76 }
  },
  'breakthrough-charge': {
    targetForceMultiplier: 1.14,
    selfForceMultiplier: 1.08,
    targetImpulse: { retention: 0.996, maxSpeed: 71, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.982, maxSpeed: 48, trailStrength: 0.9 }
  },
  'glacier-charge': {
    targetForceMultiplier: 1.08,
    selfForceMultiplier: 1.05,
    targetImpulse: { retention: 0.993, maxSpeed: 69, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.97, maxSpeed: 42, trailStrength: 0.7 }
  },
  'bramble-charge': {
    targetForceMultiplier: 1.08,
    selfForceMultiplier: 1.05,
    targetImpulse: { retention: 0.993, maxSpeed: 69, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.972, maxSpeed: 42, trailStrength: 0.74 }
  },
  'solar-rush': {
    targetForceMultiplier: 1.08,
    selfForceMultiplier: 1.05,
    targetImpulse: { retention: 0.992, maxSpeed: 68, minWallBounces: 1, trailStrength: 1 },
    selfImpulse: { retention: 0.968, maxSpeed: 44, trailStrength: 0.72 }
  },
  'phase-lunge': {
    targetForceMultiplier: 1.09,
    selfForceMultiplier: 1.06,
    targetImpulse: { retention: 0.994, maxSpeed: 69, minWallBounces: 2, trailStrength: 1 },
    selfImpulse: { retention: 0.976, maxSpeed: 44, trailStrength: 0.78 }
  }
};

export function getChargedMeleeLaunchProfile(abilityId: string): ChargedMeleeLaunchProfile | null {
  return CHARGED_MELEE_LAUNCH_PROFILES[abilityId] ?? null;
}

export function listChargedMeleeLaunchAbilityIds(): string[] {
  return Object.keys(CHARGED_MELEE_LAUNCH_PROFILES);
}
