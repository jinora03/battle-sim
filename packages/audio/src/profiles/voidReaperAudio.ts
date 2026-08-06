import type { AbilityCombatAudioProfile } from '../combatAudioProfiles';

export const VOID_REAPER_AUDIO_PROFILES = [
  {
    abilityId: 'phase-lunge', palette: 'void', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.68, durationSeconds: 0.18, variant: 'void-rift' },
      activation: { intent: 'knockback', intensity: 0.94, durationSeconds: 0.2, variant: 'void-rift' },
      sustain: { intent: 'channel', intensity: 0.6, durationSeconds: 0.3, delaySeconds: 0.025, variant: 'void-compression' },
      release: { intent: 'status-application', intensity: 0.58, durationSeconds: 0.18, delaySeconds: 0.16, variant: 'void-rift' }
    }
  },
  {
    abilityId: 'gravity-well', palette: 'void', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'pull', intensity: 0.86, variant: 'void-compression' },
      activation: { intent: 'pull', intensity: 1.04, durationSeconds: 0.42, variant: 'void-compression' },
      sustain: { intent: 'channel', intensity: 0.8, durationSeconds: 0.56, delaySeconds: 0.04, variant: 'void-compression' },
      release: { intent: 'status-application', intensity: 0.68, durationSeconds: 0.24, delaySeconds: 0.4, variant: 'void-rift' }
    }
  },
  {
    abilityId: 'void-burst', palette: 'void', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.82, variant: 'void-compression' },
      activation: { intent: 'explosion', intensity: 1.04, durationSeconds: 0.32, variant: 'void-rift' },
      sustain: { intent: 'pull', intensity: 0.7, durationSeconds: 0.34, delaySeconds: 0.04, variant: 'void-compression' },
      release: { intent: 'knockback', intensity: 0.78, durationSeconds: 0.22, delaySeconds: 0.2, variant: 'void-rift' }
    }
  },
  {
    abilityId: 'singularity', palette: 'void', hierarchy: 'ultimate',
    layers: {
      anticipation: { intent: 'ultimate', intensity: 1.1, durationSeconds: 1.1, variant: 'void-compression' },
      activation: { intent: 'pull', intensity: 1.16, durationSeconds: 0.58, variant: 'void-compression' },
      sustain: { intent: 'channel', intensity: 0.94, durationSeconds: 0.88, delaySeconds: 0.06, variant: 'void-compression' },
      release: { intent: 'explosion', intensity: 1.14, durationSeconds: 0.52, delaySeconds: 0.68, variant: 'singularity-collapse' }
    }
  }
] as const satisfies readonly AbilityCombatAudioProfile[];
