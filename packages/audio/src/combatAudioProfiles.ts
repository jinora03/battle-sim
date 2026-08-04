export const COMBAT_AUDIO_PHASES = ['anticipation', 'activation', 'sustain', 'release'] as const;
export type CombatAudioPhase = (typeof COMBAT_AUDIO_PHASES)[number];

export const COMBAT_AUDIO_INTENTS = [
  'projectile',
  'burst-fire',
  'beam',
  'explosion',
  'pull',
  'knockback',
  'transformation',
  'channel',
  'status-application',
  'ultimate'
] as const;
export type CombatAudioIntent = (typeof COMBAT_AUDIO_INTENTS)[number];

export const COMBAT_AUDIO_PALETTES = [
  'kinetic',
  'fire',
  'electric',
  'gravity',
  'mechanical',
  'water',
  'ice',
  'nature',
  'void',
  'solar'
] as const;
export type CombatAudioPalette = (typeof COMBAT_AUDIO_PALETTES)[number];

export const COMBAT_AUDIO_HIERARCHY = ['basic', 'skill', 'payoff', 'ultimate'] as const;
export type CombatAudioHierarchy = (typeof COMBAT_AUDIO_HIERARCHY)[number];

export const COMBAT_AUDIO_HIERARCHY_GAIN: Readonly<Record<CombatAudioHierarchy, number>> = {
  basic: 0.54,
  skill: 0.7,
  payoff: 0.84,
  ultimate: 1
};

export interface CombatAudioLayerProfile {
  intent: CombatAudioIntent;
  /** Relative emphasis inside the ability's hierarchy tier. */
  intensity?: number;
  /** Optional fixed duration. Anticipation normally follows cast time instead. */
  durationSeconds?: number;
  /** Schedules a layer after activation without creating simulation timers. */
  delaySeconds?: number;
}

export interface AbilityCombatAudioProfile {
  abilityId: string;
  palette: CombatAudioPalette;
  hierarchy: CombatAudioHierarchy;
  layers: Partial<Record<CombatAudioPhase, CombatAudioLayerProfile>>;
}

export interface ResolvedCombatAudioLayer extends Required<CombatAudioLayerProfile> {
  abilityId: string;
  phase: CombatAudioPhase;
  palette: CombatAudioPalette;
  hierarchy: CombatAudioHierarchy;
  gainScale: number;
}

const DEFAULT_PHASE_DURATION: Readonly<Record<CombatAudioPhase, number>> = {
  anticipation: 0.34,
  activation: 0.16,
  sustain: 0.3,
  release: 0.22
};

const LIGHTNING_DASH_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'lightning-dash',
  palette: 'electric',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'projectile', intensity: 0.62, durationSeconds: 0.16 },
    activation: { intent: 'knockback', intensity: 0.82, durationSeconds: 0.17 },
    sustain: { intent: 'channel', intensity: 0.46, durationSeconds: 0.14, delaySeconds: 0.025 },
    release: { intent: 'status-application', intensity: 0.52, durationSeconds: 0.12, delaySeconds: 0.12 }
  }
};

const ARC_BURST_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'arc-burst',
  palette: 'electric',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'status-application', intensity: 0.58, durationSeconds: 0.28 },
    activation: { intent: 'explosion', intensity: 0.88, durationSeconds: 0.28 },
    release: { intent: 'status-application', intensity: 0.64, durationSeconds: 0.17, delaySeconds: 0.12 }
  }
};

const POLARITY_PULL_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'polarity-pull',
  palette: 'electric',
  hierarchy: 'payoff',
  layers: {
    anticipation: { intent: 'pull', intensity: 0.82 },
    activation: { intent: 'pull', intensity: 0.9, durationSeconds: 0.25 },
    sustain: { intent: 'pull', intensity: 0.7, durationSeconds: 0.34, delaySeconds: 0.025 },
    release: { intent: 'knockback', intensity: 0.92, durationSeconds: 0.24, delaySeconds: 0.27 }
  }
};

const THUNDER_DOME_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'thunder-dome',
  palette: 'electric',
  hierarchy: 'ultimate',
  layers: {
    anticipation: { intent: 'ultimate', intensity: 1, durationSeconds: 0.72 },
    activation: { intent: 'explosion', intensity: 1, durationSeconds: 0.55 },
    sustain: { intent: 'channel', intensity: 0.82, durationSeconds: 0.42, delaySeconds: 0.055 },
    release: { intent: 'status-application', intensity: 0.86, durationSeconds: 0.3, delaySeconds: 0.34 }
  }
};

const MAGMA_DASH_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'magma-dash',
  palette: 'fire',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'transformation', intensity: 0.54, durationSeconds: 0.15 },
    activation: { intent: 'knockback', intensity: 0.82, durationSeconds: 0.2 },
    sustain: { intent: 'channel', intensity: 0.48, durationSeconds: 0.2, delaySeconds: 0.035 },
    release: { intent: 'status-application', intensity: 0.54, durationSeconds: 0.14, delaySeconds: 0.14 }
  }
};

const FLAME_RING_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'flame-ring',
  palette: 'fire',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'pull', intensity: 0.62 },
    activation: { intent: 'pull', intensity: 0.82, durationSeconds: 0.28 },
    sustain: { intent: 'channel', intensity: 0.56, durationSeconds: 0.34, delaySeconds: 0.035 },
    release: { intent: 'status-application', intensity: 0.64, durationSeconds: 0.2, delaySeconds: 0.24 }
  }
};

const MOLTEN_GUARD_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'molten-guard',
  palette: 'fire',
  hierarchy: 'payoff',
  layers: {
    anticipation: { intent: 'status-application', intensity: 0.74 },
    activation: { intent: 'explosion', intensity: 0.96, durationSeconds: 0.34 },
    sustain: { intent: 'channel', intensity: 0.5, durationSeconds: 0.22, delaySeconds: 0.045 },
    release: { intent: 'knockback', intensity: 0.78, durationSeconds: 0.22, delaySeconds: 0.18 }
  }
};

const INFERNO_COLLAPSE_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'inferno-collapse',
  palette: 'fire',
  hierarchy: 'ultimate',
  layers: {
    anticipation: { intent: 'ultimate', intensity: 1, durationSeconds: 0.8 },
    activation: { intent: 'explosion', intensity: 1.08, durationSeconds: 0.58 },
    sustain: { intent: 'transformation', intensity: 0.82, durationSeconds: 0.62, delaySeconds: 0.06 },
    release: { intent: 'status-application', intensity: 0.88, durationSeconds: 0.34, delaySeconds: 0.46 }
  }
};

const FEATHERFALL_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'featherfall',
  palette: 'gravity',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'status-application', intensity: 0.56 },
    activation: { intent: 'pull', intensity: 0.72, durationSeconds: 0.3 },
    sustain: { intent: 'status-application', intensity: 0.44, durationSeconds: 0.3, delaySeconds: 0.045 },
    release: { intent: 'status-application', intensity: 0.58, durationSeconds: 0.2, delaySeconds: 0.22 }
  }
};

const DOWNBEAT_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'downbeat',
  palette: 'gravity',
  hierarchy: 'payoff',
  layers: {
    anticipation: { intent: 'knockback', intensity: 0.7, durationSeconds: 0.22 },
    activation: { intent: 'knockback', intensity: 1, durationSeconds: 0.32 },
    release: { intent: 'explosion', intensity: 0.8, durationSeconds: 0.24, delaySeconds: 0.12 }
  }
};

const DEAD_WEIGHT_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'dead-weight',
  palette: 'gravity',
  hierarchy: 'skill',
  layers: {
    anticipation: { intent: 'transformation', intensity: 0.68 },
    activation: { intent: 'knockback', intensity: 0.84, durationSeconds: 0.32 },
    sustain: { intent: 'transformation', intensity: 0.6, durationSeconds: 0.38, delaySeconds: 0.045 },
    release: { intent: 'status-application', intensity: 0.54, durationSeconds: 0.2, delaySeconds: 0.26 }
  }
};

const LAST_CALL_PROFILE: AbilityCombatAudioProfile = {
  abilityId: 'last-call',
  palette: 'gravity',
  hierarchy: 'ultimate',
  layers: {
    anticipation: { intent: 'ultimate', intensity: 1, durationSeconds: 0.88 },
    activation: { intent: 'pull', intensity: 1.08, durationSeconds: 0.62 },
    sustain: { intent: 'transformation', intensity: 0.84, durationSeconds: 0.68, delaySeconds: 0.05 },
    release: { intent: 'explosion', intensity: 0.94, durationSeconds: 0.4, delaySeconds: 0.5 }
  }
};

const VOLT_AUDIO_PROFILES = [
  LIGHTNING_DASH_PROFILE,
  ARC_BURST_PROFILE,
  POLARITY_PULL_PROFILE,
  THUNDER_DOME_PROFILE
] as const;

const PYRO_AUDIO_PROFILES = [
  MAGMA_DASH_PROFILE,
  FLAME_RING_PROFILE,
  MOLTEN_GUARD_PROFILE,
  INFERNO_COLLAPSE_PROFILE
] as const;

const BALLAST_AUDIO_PROFILES = [
  FEATHERFALL_PROFILE,
  DOWNBEAT_PROFILE,
  DEAD_WEIGHT_PROFILE,
  LAST_CALL_PROFILE
] as const;

const ABILITY_AUDIO_PROFILES = new Map<string, AbilityCombatAudioProfile>(
  [...VOLT_AUDIO_PROFILES, ...PYRO_AUDIO_PROFILES, ...BALLAST_AUDIO_PROFILES]
    .map((profile) => [profile.abilityId, profile])
);

export function getAbilityCombatAudioProfile(abilityId: string): AbilityCombatAudioProfile | undefined {
  return ABILITY_AUDIO_PROFILES.get(abilityId);
}

export function listAbilityCombatAudioProfiles(): AbilityCombatAudioProfile[] {
  return [...ABILITY_AUDIO_PROFILES.values()];
}

export function resolveCombatAudioLayer(
  profile: AbilityCombatAudioProfile,
  phase: CombatAudioPhase,
  castTicks = 0
): ResolvedCombatAudioLayer | undefined {
  const layer = profile.layers[phase];
  if (!layer) return undefined;

  const castDuration = Math.max(0.12, Math.min(1.8, castTicks / 60));
  const durationSeconds = layer.durationSeconds
    ?? (phase === 'anticipation' && castTicks > 0 ? castDuration : DEFAULT_PHASE_DURATION[phase]);
  const intensity = Math.max(0.1, Math.min(1.25, layer.intensity ?? 1));
  const delaySeconds = Math.max(0, layer.delaySeconds ?? 0);

  return {
    abilityId: profile.abilityId,
    phase,
    palette: profile.palette,
    hierarchy: profile.hierarchy,
    intent: layer.intent,
    intensity,
    durationSeconds,
    delaySeconds,
    gainScale: COMBAT_AUDIO_HIERARCHY_GAIN[profile.hierarchy] * intensity
  };
}
