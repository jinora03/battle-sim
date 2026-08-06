import type { AbilityCombatAudioProfile } from '../combatAudioProfiles';

export const FROST_WARDEN_AUDIO_PROFILES = [
  {
    abilityId: 'glacier-charge', palette: 'ice', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.7, variant: 'frozen-pressure' },
      activation: { intent: 'knockback', intensity: 0.94, durationSeconds: 0.22, variant: 'crystalline-fracture' },
      sustain: { intent: 'channel', intensity: 0.58, durationSeconds: 0.24, delaySeconds: 0.03, variant: 'frozen-pressure' },
      release: { intent: 'status-application', intensity: 0.66, durationSeconds: 0.18, delaySeconds: 0.14, variant: 'crystalline-fracture' }
    }
  },
  {
    abilityId: 'frost-nova', palette: 'ice', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'status-application', intensity: 0.76, variant: 'frozen-pressure' },
      activation: { intent: 'explosion', intensity: 1, durationSeconds: 0.3, variant: 'crystalline-fracture' },
      sustain: { intent: 'channel', intensity: 0.58, durationSeconds: 0.28, delaySeconds: 0.04, variant: 'frozen-pressure' },
      release: { intent: 'knockback', intensity: 0.68, durationSeconds: 0.2, delaySeconds: 0.16, variant: 'crystalline-fracture' }
    }
  },
  {
    abilityId: 'ice-anchor', palette: 'ice', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.82, variant: 'frozen-pressure' },
      activation: { intent: 'status-application', intensity: 0.96, durationSeconds: 0.34, variant: 'crystalline-fracture' },
      sustain: { intent: 'channel', intensity: 0.68, durationSeconds: 0.46, delaySeconds: 0.04, variant: 'frozen-pressure' },
      release: { intent: 'transformation', intensity: 0.64, durationSeconds: 0.22, delaySeconds: 0.34, variant: 'crystalline-fracture' }
    }
  },
  {
    abilityId: 'absolute-zero', palette: 'ice', hierarchy: 'ultimate',
    layers: {
      anticipation: { intent: 'ultimate', intensity: 1.08, durationSeconds: 0.92, variant: 'frozen-pressure' },
      activation: { intent: 'pull', intensity: 1.08, durationSeconds: 0.56, variant: 'frozen-pressure' },
      sustain: { intent: 'channel', intensity: 0.86, durationSeconds: 0.68, delaySeconds: 0.06, variant: 'frozen-pressure' },
      release: { intent: 'explosion', intensity: 1.04, durationSeconds: 0.44, delaySeconds: 0.48, variant: 'crystalline-fracture' }
    }
  }
] as const satisfies readonly AbilityCombatAudioProfile[];
