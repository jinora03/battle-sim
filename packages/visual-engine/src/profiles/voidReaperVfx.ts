import type { CombatVfxProfile } from '../combatVfxProfiles';

export const VOID_REAPER_VFX_PROFILES = {
  'phase-lunge': {
    abilityId: 'phase-lunge', palette: 'void', hierarchy: 'skill',
    colors: { core: 0xf8e6ff, accent: 0x9d54eb, glow: 0x64e7ff },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.7, radiusScale: 0.58, directional: true, treatment: 'void-tear' },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.18, intensity: 0.96, radiusScale: 0.84, directional: true, treatment: 'void-tear' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.025, durationSeconds: 0.32, intensity: 0.66, radiusScale: 0.78, directional: true, treatment: 'void-tear' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.17, durationSeconds: 0.2, intensity: 0.6, radiusScale: 0.72, treatment: 'void-tear' }
    ]
  },
  'gravity-well': {
    abilityId: 'gravity-well', palette: 'void', hierarchy: 'payoff',
    colors: { core: 0xf2dcff, accent: 0x7940ca, glow: 0x72e9ff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.86, radiusScale: 0.84, treatment: 'void-tear' },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.4, intensity: 1.06, radiusScale: 1.18, treatment: 'void-tear' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.58, intensity: 0.82, radiusScale: 1.08, treatment: 'void-tear' },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.42, durationSeconds: 0.24, intensity: 0.7, radiusScale: 0.9, treatment: 'void-tear' }
    ]
  },
  'void-burst': {
    abilityId: 'void-burst', palette: 'void', hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0xa150eb, glow: 0x83eaff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.82, radiusScale: 0.74, treatment: 'void-tear' },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.3, intensity: 1.06, radiusScale: 1.06, treatment: 'void-tear' },
      { phase: 'sustain', intent: 'pull', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.36, intensity: 0.72, radiusScale: 0.94, treatment: 'void-tear' },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.21, durationSeconds: 0.22, intensity: 0.8, radiusScale: 0.96, treatment: 'void-tear' }
    ]
  },
  singularity: {
    abilityId: 'singularity', palette: 'void', hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0x64249d, glow: 0x78eaff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', durationSeconds: 1.1, intensity: 1.08, radiusScale: 1, treatment: 'singularity' },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.58, intensity: 1.18, radiusScale: 1.42, treatment: 'singularity' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.9, intensity: 0.96, radiusScale: 1.28, treatment: 'singularity' },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.7, durationSeconds: 0.5, intensity: 1.16, radiusScale: 1.46, treatment: 'singularity' }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
