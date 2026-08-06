import type { CombatVfxProfile } from '../combatVfxProfiles';

export const ROCKET_VANGUARD_VFX_PROFILES = {
  'rocket-salvo': {
    abilityId: 'rocket-salvo', palette: 'fire', hierarchy: 'skill',
    colors: { core: 0xfff8c8, accent: 0xff8a32, glow: 0xffc65a },
    layers: [
      { phase: 'anticipation', intent: 'burst-fire', anchor: 'activated', useCastDuration: true, intensity: 0.74, radiusScale: 0.64, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'activation', intent: 'projectile', anchor: 'resolved', durationSeconds: 0.2, intensity: 0.96, radiusScale: 0.86, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'sustain', intent: 'burst-fire', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.4, intensity: 0.78, radiusScale: 0.94, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.32, durationSeconds: 0.18, intensity: 0.5, radiusScale: 0.64, treatment: 'rocket-exhaust' }
    ]
  },
  'blast-jump': {
    abilityId: 'blast-jump', palette: 'fire', hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0xff7138, glow: 0xffd06a },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.62, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.2, intensity: 1, radiusScale: 0.92, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.025, durationSeconds: 0.32, intensity: 0.72, radiusScale: 0.86, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.17, durationSeconds: 0.22, intensity: 0.76, radiusScale: 0.88, treatment: 'rocket-exhaust' }
    ]
  },
  'siege-marker': {
    abilityId: 'siege-marker', palette: 'metal', hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0xff7738, glow: 0xffd66f },
    layers: [
      { phase: 'anticipation', intent: 'status', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.8, treatment: 'target-lock' },
      { phase: 'activation', intent: 'status', anchor: 'resolved', durationSeconds: 0.26, intensity: 1.02, radiusScale: 1.04, treatment: 'target-lock' },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.42, intensity: 0.68, radiusScale: 0.92, treatment: 'target-lock' },
      { phase: 'release', intent: 'projectile', anchor: 'resolved', delaySeconds: 0.32, durationSeconds: 0.18, intensity: 0.78, radiusScale: 0.78, directional: true, treatment: 'rocket-exhaust' }
    ]
  },
  'starburst-convergence': {
    abilityId: 'starburst-convergence', palette: 'fire', hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0xff4f22, glow: 0xffd35f },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', durationSeconds: 1.02, intensity: 1.02, radiusScale: 0.92, treatment: 'target-lock' },
      { phase: 'activation', intent: 'burst-fire', anchor: 'resolved', durationSeconds: 0.36, intensity: 1.14, radiusScale: 1.08, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'sustain', intent: 'projectile', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.86, intensity: 0.94, radiusScale: 1.12, directional: true, treatment: 'rocket-exhaust' },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.66, durationSeconds: 0.48, intensity: 1.18, radiusScale: 1.42, treatment: 'starburst' }
    ]
  }
} as const satisfies Readonly<Record<string, CombatVfxProfile>>;
