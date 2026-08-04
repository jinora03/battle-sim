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

const ABILITY_AUDIO_PROFILES = new Map<string, AbilityCombatAudioProfile>([
  [THUNDER_DOME_PROFILE.abilityId, THUNDER_DOME_PROFILE]
]);

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
