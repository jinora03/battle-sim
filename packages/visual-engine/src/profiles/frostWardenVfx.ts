import type { CombatVfxProfile } from '../combatVfxProfiles';

export const FROST_WARDEN_VFX_PROFILES = {
  'glacier-charge': {
    abilityId: 'glacier-charge', palette: 'ice', hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x7edfff, glow: 0xcdfaff },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.62, treatment: 'crystalline' },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.2, intensity: 0.98, radiusScale: 0.9, treatment: 'crystalline' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.03, durationSeconds: 0.3, intensity: 0.66, radiusScale: 0.8, treatment: 'crystalline' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.16, durationSeconds: 0.2, intensity: 0.68, radiusScale: 0.76, treatment: 'crystalline' }
    ]
  },
  'frost-nova': {
    abilityId: 'frost-nova', palette: 'ice', hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x8cecff, glow: 0xd9fbff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.8, radiusScale: 0.78, treatment: 'crystalline' },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.26, intensity: 1.02, radiusScale: 1.06, treatment: 'crystalline' },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.34, intensity: 0.66, radiusScale: 0.94, treatment: 'crystalline' },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.18, durationSeconds: 0.2, intensity: 0.72, radiusScale: 0.92, treatment: 'crystalline' }
    ]
  },
  'ice-anchor': {
    abilityId: 'ice-anchor', palette: 'ice', hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0x5dbfe8, glow: 0xc7f7ff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.72, treatment: 'crystalline' },
      { phase: 'activation', intent: 'status', anchor: 'resolved', durationSeconds: 0.28, intensity: 1, radiusScale: 0.96, treatment: 'crystalline' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.5, intensity: 0.72, radiusScale: 0.88, treatment: 'crystalline' },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.36, durationSeconds: 0.22, intensity: 0.62, radiusScale: 0.74, treatment: 'crystalline' }
    ]
  },
  'absolute-zero': {
    abilityId: 'absolute-zero', palette: 'ice', hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0x76dfff, glow: 0xdffcff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', durationSeconds: 0.92, intensity: 1, radiusScale: 0.92, treatment: 'crystalline' },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.48, intensity: 1.12, radiusScale: 1.24, treatment: 'crystalline' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.72, intensity: 0.9, radiusScale: 1.08, treatment: 'crystalline' },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.5, durationSeconds: 0.4, intensity: 1.08, radiusScale: 1.28, treatment: 'crystalline' }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
