import type { CombatVfxProfile } from '../combatVfxProfiles';

export const THORN_COLOSSUS_VFX_PROFILES = {
  'bramble-charge': {
    abilityId: 'bramble-charge', palette: 'nature', hierarchy: 'skill',
    colors: { core: 0xf0ffc2, accent: 0x62bf4d, glow: 0x9ce27b },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.62, directional: true, treatment: 'root-growth' },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.22, intensity: 0.98, radiusScale: 0.9, directional: true, treatment: 'root-growth' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.035, durationSeconds: 0.36, intensity: 0.68, radiusScale: 0.84, directional: true, treatment: 'root-growth' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.21, durationSeconds: 0.22, intensity: 0.72, radiusScale: 0.8, treatment: 'root-growth' }
    ]
  },
  'seed-burst': {
    abilityId: 'seed-burst', palette: 'nature', hierarchy: 'skill',
    colors: { core: 0xf6ffc7, accent: 0x83cc55, glow: 0xb5ee82 },
    layers: [
      { phase: 'anticipation', intent: 'status', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.7, treatment: 'root-growth' },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.26, intensity: 0.96, radiusScale: 1.02, treatment: 'root-growth' },
      { phase: 'sustain', intent: 'projectile', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.34, intensity: 0.7, radiusScale: 0.94, treatment: 'root-growth' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.19, durationSeconds: 0.22, intensity: 0.7, radiusScale: 0.88, treatment: 'root-growth' }
    ]
  },
  regenerate: {
    abilityId: 'regenerate', palette: 'nature', hierarchy: 'payoff',
    colors: { core: 0xf2ffd0, accent: 0x45ac52, glow: 0xa8ef87 },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.82, radiusScale: 0.72, treatment: 'root-growth' },
      { phase: 'activation', intent: 'status', anchor: 'resolved', durationSeconds: 0.3, intensity: 0.98, radiusScale: 0.96, treatment: 'root-growth' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.6, intensity: 0.78, radiusScale: 0.9, treatment: 'root-growth' },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.46, durationSeconds: 0.24, intensity: 0.62, radiusScale: 0.76, treatment: 'root-growth' }
    ]
  },
  overgrowth: {
    abilityId: 'overgrowth', palette: 'nature', hierarchy: 'ultimate',
    colors: { core: 0xfbffd3, accent: 0x52b83f, glow: 0xb7f28a },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', durationSeconds: 1.08, intensity: 1.04, radiusScale: 0.98, treatment: 'root-growth' },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.54, intensity: 1.14, radiusScale: 1.34, treatment: 'root-growth' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.84, intensity: 0.92, radiusScale: 1.2, treatment: 'root-growth' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.64, durationSeconds: 0.42, intensity: 1.04, radiusScale: 1.26, treatment: 'root-growth' }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
