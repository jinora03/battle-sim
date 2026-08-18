import type { CombatVfxProfile } from '../combatVfxProfiles';

export const BLADE_VANGUARD_VFX_PROFILES = {
  'driving-slash': {
    abilityId: 'driving-slash',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x8fd9ff, glow: 0xd8f3ff },
    layers: [
      { phase: 'anticipation', intent: 'channel', anchor: 'activated', useCastDuration: true, intensity: 0.88, radiusScale: 0.64, directional: true },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.16, intensity: 1.02, radiusScale: 0.82, directional: true },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.02, durationSeconds: 0.22, intensity: 0.76, radiusScale: 0.72, directional: true },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.24, intensity: 1.08, radiusScale: 0.94, directional: true }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
