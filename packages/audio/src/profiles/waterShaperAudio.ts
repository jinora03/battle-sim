import type { AbilityCombatAudioProfile } from '../combatAudioProfiles';

export const WATER_SHAPER_AUDIO_PROFILES = [
  {
    abilityId: 'surge-dash', palette: 'water', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.66, durationSeconds: 0.18, variant: 'water-pressure' },
      activation: { intent: 'knockback', intensity: 0.9, durationSeconds: 0.2, variant: 'water-pressure' },
      sustain: { intent: 'channel', intensity: 0.58, durationSeconds: 0.3, delaySeconds: 0.025, variant: 'water-flow' },
      release: { intent: 'status-application', intensity: 0.56, durationSeconds: 0.18, delaySeconds: 0.16, variant: 'water-flow' }
    }
  },
  {
    abilityId: 'pressure-wave', palette: 'water', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.72, variant: 'water-pressure' },
      activation: { intent: 'explosion', intensity: 0.98, durationSeconds: 0.3, variant: 'water-pressure' },
      sustain: { intent: 'channel', intensity: 0.62, durationSeconds: 0.28, delaySeconds: 0.04, variant: 'water-flow' },
      release: { intent: 'knockback', intensity: 0.7, durationSeconds: 0.2, delaySeconds: 0.17, variant: 'water-pressure' }
    }
  },
  {
    abilityId: 'undertow', palette: 'water', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'pull', intensity: 0.84, variant: 'undertow-pull' },
      activation: { intent: 'pull', intensity: 1, durationSeconds: 0.4, variant: 'undertow-pull' },
      sustain: { intent: 'channel', intensity: 0.74, durationSeconds: 0.5, delaySeconds: 0.04, variant: 'undertow-pull' },
      release: { intent: 'status-application', intensity: 0.64, durationSeconds: 0.24, delaySeconds: 0.36, variant: 'water-flow' }
    }
  },
  {
    abilityId: 'tidal-cataclysm', palette: 'water', hierarchy: 'ultimate',
    layers: {
      anticipation: { intent: 'ultimate', intensity: 1.08, durationSeconds: 0.94, variant: 'undertow-pull' },
      activation: { intent: 'explosion', intensity: 1.12, durationSeconds: 0.52, variant: 'water-pressure' },
      sustain: { intent: 'channel', intensity: 0.88, durationSeconds: 0.7, delaySeconds: 0.055, variant: 'water-flow' },
      release: { intent: 'knockback', intensity: 1.02, durationSeconds: 0.44, delaySeconds: 0.5, variant: 'tidal-release' }
    }
  }
] as const satisfies readonly AbilityCombatAudioProfile[];
