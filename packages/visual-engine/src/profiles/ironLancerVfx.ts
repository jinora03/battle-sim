import type { CombatVfxProfile } from '../combatVfxProfiles';

export const IRON_LANCER_VFX_PROFILES = {
  'lance-charge': {
    abilityId: 'lance-charge',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0xffc66b, glow: 0xffe4a6 },
    layers: [
      { phase: 'anticipation', intent: 'channel', anchor: 'activated', useCastDuration: true, intensity: 0.94, radiusScale: 0.66, directional: true },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.18, intensity: 1.08, radiusScale: 0.86, directional: true },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.02, durationSeconds: 0.28, intensity: 0.8, radiusScale: 0.76, directional: true },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.26, intensity: 1.14, radiusScale: 0.98, directional: true }
    ]
  },
  'breakthrough-charge': {
    abilityId: 'breakthrough-charge',
    palette: 'metal',
    hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0xffad42, glow: 0xffe89a },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', useCastDuration: true, intensity: 1.08, radiusScale: 0.82, directional: true },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.22, intensity: 1.18, radiusScale: 0.98, directional: true },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.02, durationSeconds: 0.34, intensity: 0.92, radiusScale: 0.86, directional: true },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.32, intensity: 1.22, radiusScale: 1.12, directional: true }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
