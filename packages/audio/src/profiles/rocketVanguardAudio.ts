import type { AbilityCombatAudioProfile } from '../combatAudioProfiles';

export const ROCKET_VANGUARD_AUDIO_PROFILES = [
  {
    abilityId: 'rocket-salvo', palette: 'explosive', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.72, variant: 'rocket-ignition' },
      activation: { intent: 'burst-fire', intensity: 0.92, durationSeconds: 0.24, variant: 'rocket-ignition' },
      sustain: { intent: 'projectile', intensity: 0.7, durationSeconds: 0.34, delaySeconds: 0.04 },
      release: { intent: 'transformation', intensity: 0.54, durationSeconds: 0.18, delaySeconds: 0.28 }
    }
  },
  {
    abilityId: 'blast-jump', palette: 'explosive', hierarchy: 'skill',
    layers: {
      anticipation: { intent: 'transformation', intensity: 0.68, durationSeconds: 0.2, variant: 'rocket-ignition' },
      activation: { intent: 'knockback', intensity: 0.98, durationSeconds: 0.24, variant: 'rocket-ignition' },
      sustain: { intent: 'channel', intensity: 0.66, durationSeconds: 0.28, delaySeconds: 0.025 },
      release: { intent: 'explosion', intensity: 0.72, durationSeconds: 0.2, delaySeconds: 0.16 }
    }
  },
  {
    abilityId: 'siege-marker', palette: 'mechanical', hierarchy: 'payoff',
    layers: {
      anticipation: { intent: 'status-application', intensity: 0.84, variant: 'target-lock' },
      activation: { intent: 'status-application', intensity: 0.98, durationSeconds: 0.28, variant: 'target-lock' },
      sustain: { intent: 'channel', intensity: 0.58, durationSeconds: 0.38, delaySeconds: 0.05, variant: 'target-lock' },
      release: { intent: 'projectile', intensity: 0.78, durationSeconds: 0.18, delaySeconds: 0.3, variant: 'rocket-ignition' }
    }
  },
  {
    abilityId: 'starburst-convergence', palette: 'explosive', hierarchy: 'ultimate',
    layers: {
      anticipation: { intent: 'ultimate', intensity: 1.08, durationSeconds: 1.02, variant: 'target-lock' },
      activation: { intent: 'burst-fire', intensity: 1.12, durationSeconds: 0.42, variant: 'rocket-ignition' },
      sustain: { intent: 'projectile', intensity: 0.9, durationSeconds: 0.82, delaySeconds: 0.06 },
      release: { intent: 'explosion', intensity: 1.16, durationSeconds: 0.56, delaySeconds: 0.64, variant: 'starburst-finale' }
    }
  }
] as const satisfies readonly AbilityCombatAudioProfile[];
