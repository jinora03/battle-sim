import type { CombatVfxProfile } from '../combatVfxProfiles';

export const WATER_SHAPER_VFX_PROFILES = {
  'surge-dash': {
    abilityId: 'surge-dash', palette: 'water', hierarchy: 'skill',
    colors: { core: 0xeaffff, accent: 0x38ccff, glow: 0x86efff },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.68, radiusScale: 0.58, directional: true, treatment: 'water-flow' },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.18, intensity: 0.92, radiusScale: 0.84, directional: true, treatment: 'water-flow' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.025, durationSeconds: 0.34, intensity: 0.66, radiusScale: 0.78, directional: true, treatment: 'water-flow' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.17, durationSeconds: 0.2, intensity: 0.58, radiusScale: 0.72, treatment: 'water-flow' }
    ]
  },
  'pressure-wave': {
    abilityId: 'pressure-wave', palette: 'water', hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x2aaee8, glow: 0x84eaff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.74, radiusScale: 0.7, treatment: 'water-flow' },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.26, intensity: 1, radiusScale: 1.04, treatment: 'water-flow' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.32, intensity: 0.66, radiusScale: 0.9, treatment: 'water-flow' },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.18, durationSeconds: 0.22, intensity: 0.72, radiusScale: 0.94, treatment: 'water-flow' }
    ]
  },
  undertow: {
    abilityId: 'undertow', palette: 'water', hierarchy: 'payoff',
    colors: { core: 0xdffcff, accent: 0x1679be, glow: 0x62dfff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.82, treatment: 'water-flow' },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.38, intensity: 1.04, radiusScale: 1.16, treatment: 'water-flow' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.52, intensity: 0.8, radiusScale: 1.04, treatment: 'water-flow' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.38, durationSeconds: 0.24, intensity: 0.66, radiusScale: 0.88, treatment: 'water-flow' }
    ]
  },
  'tidal-cataclysm': {
    abilityId: 'tidal-cataclysm', palette: 'water', hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0x20bdf4, glow: 0x9cf3ff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', durationSeconds: 0.94, intensity: 1.02, radiusScale: 0.96, treatment: 'water-flow' },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.48, intensity: 1.14, radiusScale: 1.34, treatment: 'water-flow' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.055, durationSeconds: 0.74, intensity: 0.9, radiusScale: 1.18, treatment: 'water-flow' },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.52, durationSeconds: 0.42, intensity: 1.04, radiusScale: 1.28, treatment: 'water-flow' }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
