import type { AbilityCombatAudioProfile } from '../combatAudioProfiles';

export const THORN_COLOSSUS_AUDIO_PROFILES = [
  {
    abilityId: 'bramble-charge', palette: 'nature', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.72, variant: 'organic-growth' },
      activation: { intent: 'knockback', intensity: 0.96, durationSeconds: 0.24, variant: 'thorn-fracture' },
      sustain: { intent: 'channel', intensity: 0.62, durationSeconds: 0.34, delaySeconds: 0.035, variant: 'organic-growth' },
      release: { intent: 'status-application', intensity: 0.7, durationSeconds: 0.2, delaySeconds: 0.2, variant: 'thorn-fracture' }
    }
  },
  {
    abilityId: 'seed-burst', palette: 'nature', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'status-application', intensity: 0.7, variant: 'organic-growth' },
      activation: { intent: 'explosion', intensity: 0.94, durationSeconds: 0.28, variant: 'thorn-fracture' },
      sustain: { intent: 'projectile', intensity: 0.66, durationSeconds: 0.32, delaySeconds: 0.04, variant: 'thorn-fracture' },
      release: { intent: 'status-application', intensity: 0.68, durationSeconds: 0.22, delaySeconds: 0.18, variant: 'organic-growth' }
    }
  },
  {
    abilityId: 'regenerate', palette: 'nature', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.8, variant: 'organic-growth' },
      activation: { intent: 'status-application', intensity: 0.94, durationSeconds: 0.34, variant: 'organic-growth' },
      sustain: { intent: 'channel', intensity: 0.76, durationSeconds: 0.58, delaySeconds: 0.04, variant: 'organic-growth' },
      release: { intent: 'transformation', intensity: 0.62, durationSeconds: 0.24, delaySeconds: 0.44, variant: 'thorn-fracture' }
    }
  },
  {
    abilityId: 'overgrowth', palette: 'nature', hierarchy: 'ultimate',
    layers: {
      anticipation: { intent: 'ultimate', intensity: 1.06, durationSeconds: 1.08, variant: 'organic-growth' },
      activation: { intent: 'pull', intensity: 1.12, durationSeconds: 0.54, variant: 'organic-growth' },
      sustain: { intent: 'channel', intensity: 0.9, durationSeconds: 0.82, delaySeconds: 0.06, variant: 'organic-growth' },
      release: { intent: 'status-application', intensity: 1.02, durationSeconds: 0.42, delaySeconds: 0.62, variant: 'thorn-fracture' }
    }
  }
] as const satisfies readonly AbilityCombatAudioProfile[];
