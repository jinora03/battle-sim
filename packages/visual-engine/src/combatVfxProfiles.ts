import type { Element } from '@kinetic/protocol';

export const COMBAT_VFX_PHASES = ['anticipation', 'activation', 'sustain', 'release'] as const;
export const COMBAT_VFX_INTENTS = [
  'projectile',
  'burst-fire',
  'dash',
  'beam',
  'explosion',
  'pull',
  'knockback',
  'status',
  'transformation',
  'channel',
  'ultimate'
] as const;

export type CombatVfxPhase = (typeof COMBAT_VFX_PHASES)[number];
export type CombatVfxIntent = (typeof COMBAT_VFX_INTENTS)[number];
export type CombatVfxAnchor = 'activated' | 'resolved';
export type CombatVfxHierarchy = 'basic' | 'skill' | 'payoff' | 'ultimate';

export interface CombatVfxColorOverride {
  core?: number;
  accent?: number;
  glow?: number;
}

export interface CombatVfxLayerDefinition {
  phase: CombatVfxPhase;
  intent: CombatVfxIntent;
  anchor: CombatVfxAnchor;
  delaySeconds?: number;
  durationSeconds?: number;
  useCastDuration?: boolean;
  intensity?: number;
  radiusScale?: number;
}

export interface DualEyeBeamTelegraphDefinition {
  kind: 'dual-eye-beam';
  eyeChargeTicks: number;
  beamStartTicks: number;
  range: number;
  outerColor: number;
  middleColor: number;
  coreColor: number;
}

export interface RotaryCannonRigDefinition {
  kind: 'rotary-cannon';
  statusId: string;
}

export interface CombatVfxProfile {
  abilityId: string;
  palette: Element;
  hierarchy: CombatVfxHierarchy;
  colors?: CombatVfxColorOverride;
  telegraph?: DualEyeBeamTelegraphDefinition;
  persistentRig?: RotaryCannonRigDefinition;
  layers: readonly CombatVfxLayerDefinition[];
}

export interface ResolvedCombatVfxLayer {
  abilityId: string;
  palette: Element;
  hierarchy: CombatVfxHierarchy;
  colors?: CombatVfxColorOverride;
  phase: CombatVfxPhase;
  intent: CombatVfxIntent;
  anchor: CombatVfxAnchor;
  delaySeconds: number;
  durationSeconds: number;
  intensity: number;
  radiusScale: number;
}

const profiles: Readonly<Record<string, CombatVfxProfile>> = {
  'lightning-dash': {
    abilityId: 'lightning-dash',
    palette: 'electric',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0xffed44, glow: 0x75f5ff },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.68, radiusScale: 0.58 },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.16, intensity: 0.9, radiusScale: 0.82 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.03, durationSeconds: 0.26, intensity: 0.62, radiusScale: 0.72 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.14, durationSeconds: 0.18, intensity: 0.58, radiusScale: 0.7 }
    ]
  },
  'arc-burst': {
    abilityId: 'arc-burst',
    palette: 'electric',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x7aeaff, glow: 0xffed55 },
    layers: [
      { phase: 'anticipation', intent: 'explosion', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.7 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.22, intensity: 0.96, radiusScale: 1.02 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.07, durationSeconds: 0.22, intensity: 0.7, radiusScale: 0.9 }
    ]
  },
  'polarity-pull': {
    abilityId: 'polarity-pull',
    palette: 'electric',
    hierarchy: 'payoff',
    colors: { core: 0xf8ffca, accent: 0xd9ec4a, glow: 0x78f5ff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.82, radiusScale: 0.82 },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.28, intensity: 1, radiusScale: 1.1 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.34, intensity: 0.7, radiusScale: 0.92 },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.18, durationSeconds: 0.2, intensity: 0.68, radiusScale: 0.8 }
    ]
  },
  'magma-dash': {
    abilityId: 'magma-dash',
    palette: 'fire',
    hierarchy: 'skill',
    colors: { core: 0xffffc2, accent: 0xff6b28, glow: 0xffb23f },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.7, radiusScale: 0.6 },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.18, intensity: 0.94, radiusScale: 0.86 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.02, durationSeconds: 0.38, intensity: 0.72, radiusScale: 0.82 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.18, durationSeconds: 0.2, intensity: 0.62, radiusScale: 0.74 }
    ]
  },
  'flame-ring': {
    abilityId: 'flame-ring',
    palette: 'fire',
    hierarchy: 'skill',
    colors: { core: 0xffffc9, accent: 0xff4b20, glow: 0xffd35a },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.76, radiusScale: 0.8 },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.28, intensity: 0.98, radiusScale: 1.08 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.46, intensity: 0.78, radiusScale: 1 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.24, durationSeconds: 0.2, intensity: 0.62, radiusScale: 0.84 }
    ]
  },
  'molten-guard': {
    abilityId: 'molten-guard',
    palette: 'fire',
    hierarchy: 'payoff',
    colors: { core: 0xffffe0, accent: 0xff361e, glow: 0xffff7d },
    layers: [
      { phase: 'anticipation', intent: 'explosion', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.74 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.24, intensity: 1.06, radiusScale: 1.04 },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.34, intensity: 0.68, radiusScale: 0.88 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.16, durationSeconds: 0.22, intensity: 0.76, radiusScale: 0.9 }
    ]
  },
  'inferno-collapse': {
    abilityId: 'inferno-collapse',
    palette: 'fire',
    hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0xff421f, glow: 0xffd35a },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.96, radiusScale: 0.82 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.3, intensity: 1.14, radiusScale: 1.18 },
      { phase: 'sustain', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.72, intensity: 0.86, radiusScale: 1.02 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.42, durationSeconds: 0.28, intensity: 0.76, radiusScale: 0.92 }
    ]
  },
  'featherfall': {
    abilityId: 'featherfall',
    palette: 'void',
    hierarchy: 'skill',
    colors: { core: 0xf4feff, accent: 0xc9b7f4, glow: 0x9cf4ff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.7, radiusScale: 0.78 },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.26, intensity: 0.9, radiusScale: 1.08 },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.42, intensity: 0.62, radiusScale: 0.96 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.24, durationSeconds: 0.2, intensity: 0.52, radiusScale: 0.82 }
    ]
  },
  'downbeat': {
    abilityId: 'downbeat',
    palette: 'void',
    hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0x9cf4ff, glow: 0x7859aa },
    layers: [
      { phase: 'anticipation', intent: 'knockback', anchor: 'activated', useCastDuration: true, intensity: 0.78, radiusScale: 0.62 },
      { phase: 'activation', intent: 'knockback', anchor: 'resolved', durationSeconds: 0.18, intensity: 1.06, radiusScale: 1.02 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.07, durationSeconds: 0.2, intensity: 0.62, radiusScale: 0.78 }
    ]
  },
  'dead-weight': {
    abilityId: 'dead-weight',
    palette: 'void',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x4f405f, glow: 0xbcefff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.76, radiusScale: 0.68 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.24, intensity: 0.92, radiusScale: 0.94 },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.54, intensity: 0.68, radiusScale: 0.84 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.34, durationSeconds: 0.18, intensity: 0.48, radiusScale: 0.72 }
    ]
  },
  'last-call': {
    abilityId: 'last-call',
    palette: 'void',
    hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0xd8faff, glow: 0x6b47a0 },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', useCastDuration: true, intensity: 0.98, radiusScale: 0.88 },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.34, intensity: 1.16, radiusScale: 1.28 },
      { phase: 'sustain', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.08, durationSeconds: 0.72, intensity: 0.88, radiusScale: 1.08 },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.42, durationSeconds: 0.3, intensity: 0.82, radiusScale: 1.02 }
    ]
  },
  'thunder-dome': {
    abilityId: 'thunder-dome',
    palette: 'electric',
    hierarchy: 'ultimate',
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', useCastDuration: true, intensity: 0.82, radiusScale: 0.72 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.24, intensity: 1.12, radiusScale: 1.12 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.08, durationSeconds: 0.5, intensity: 0.82, radiusScale: 1 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.32, durationSeconds: 0.28, intensity: 0.72, radiusScale: 0.9 }
    ]
  },
  'tactical-slide': {
    abilityId: 'tactical-slide',
    palette: 'metal',
    hierarchy: 'skill',
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.62, radiusScale: 0.52 },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.14, intensity: 0.82, radiusScale: 0.72 },
      { phase: 'release', intent: 'projectile', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.12, intensity: 0.54, radiusScale: 0.58 }
    ]
  },
  'suppressive-fire': {
    abilityId: 'suppressive-fire',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xfff6cf, accent: 0xffc45b, glow: 0x7fdfff },
    layers: [
      { phase: 'anticipation', intent: 'burst-fire', anchor: 'activated', useCastDuration: true, intensity: 0.68, radiusScale: 0.58 },
      { phase: 'activation', intent: 'projectile', anchor: 'resolved', durationSeconds: 0.12, intensity: 0.84, radiusScale: 0.76 },
      { phase: 'sustain', intent: 'burst-fire', anchor: 'resolved', delaySeconds: 0.03, durationSeconds: 0.24, intensity: 0.72, radiusScale: 0.9 },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.2, durationSeconds: 0.14, intensity: 0.42, radiusScale: 0.56 }
    ]
  },
  'pinning-round': {
    abilityId: 'pinning-round',
    palette: 'metal',
    hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0xffa04f, glow: 0x75eaff },
    layers: [
      { phase: 'anticipation', intent: 'projectile', anchor: 'activated', useCastDuration: true, intensity: 0.78, radiusScale: 0.64 },
      { phase: 'activation', intent: 'projectile', anchor: 'resolved', durationSeconds: 0.16, intensity: 1, radiusScale: 0.88 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.08, durationSeconds: 0.2, intensity: 0.7, radiusScale: 0.76 }
    ]
  },
  'kill-zone': {
    abilityId: 'kill-zone',
    palette: 'metal',
    hierarchy: 'ultimate',
    colors: { core: 0xfff4c2, accent: 0xffa13d, glow: 0x73ddff },
    persistentRig: { kind: 'rotary-cannon', statusId: 'kill-zone-overdrive' },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.94, radiusScale: 0.78 },
      { phase: 'activation', intent: 'ultimate', anchor: 'resolved', durationSeconds: 0.18, intensity: 1.04, radiusScale: 0.94 },
      { phase: 'sustain', intent: 'burst-fire', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.82, intensity: 0.92, radiusScale: 1.08 },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.86, durationSeconds: 0.28, intensity: 0.76, radiusScale: 0.88 }
    ]
  },
  'solar-rush': {
    abilityId: 'solar-rush',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x4b9cff, glow: 0xffc76b },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.66, radiusScale: 0.58 },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.16, intensity: 0.9, radiusScale: 0.82 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.16, intensity: 0.58, radiusScale: 0.72 }
    ]
  },
  'thunder-clap': {
    abilityId: 'thunder-clap',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x8dd8ff, glow: 0xffdf8a },
    layers: [
      { phase: 'anticipation', intent: 'explosion', anchor: 'activated', useCastDuration: true, intensity: 0.74, radiusScale: 0.72 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.22, intensity: 0.96, radiusScale: 1.02 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.2, intensity: 0.7, radiusScale: 0.94 }
    ]
  },
  'solar-aegis': {
    abilityId: 'solar-aegis',
    palette: 'fire',
    hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0xffb34d, glow: 0x8fdcff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.82, radiusScale: 0.68 },
      { phase: 'activation', intent: 'transformation', anchor: 'resolved', durationSeconds: 0.24, intensity: 0.96, radiusScale: 0.92 },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.62, intensity: 0.7, radiusScale: 0.84 },
      { phase: 'release', intent: 'status', anchor: 'resolved', delaySeconds: 0.42, durationSeconds: 0.2, intensity: 0.54, radiusScale: 0.74 }
    ]
  },
  'solar-laser': {
    abilityId: 'solar-laser',
    palette: 'fire',
    hierarchy: 'ultimate',
    colors: { core: 0xfff7dc, accent: 0xff7258, glow: 0xffc66c },
    telegraph: {
      kind: 'dual-eye-beam',
      eyeChargeTicks: 30,
      beamStartTicks: 48,
      range: 1080,
      outerColor: 0xff3028,
      middleColor: 0xff7258,
      coreColor: 0xfff7dc
    },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', durationSeconds: 0.8, intensity: 0.9, radiusScale: 0.72 },
      { phase: 'activation', intent: 'beam', anchor: 'activated', delaySeconds: 0.8, durationSeconds: 0.18, intensity: 1.06, radiusScale: 0.92 },
      { phase: 'sustain', intent: 'channel', anchor: 'activated', delaySeconds: 0.9, durationSeconds: 2.5, intensity: 0.8, radiusScale: 0.88 },
      { phase: 'release', intent: 'beam', anchor: 'resolved', durationSeconds: 0.28, intensity: 0.78, radiusScale: 0.82 }
    ]
  }
};

export const COMBAT_VFX_HIERARCHY_SCALE: Readonly<Record<CombatVfxHierarchy, number>> = {
  basic: 0.52,
  skill: 0.76,
  payoff: 0.94,
  ultimate: 1.16
};

const phaseDuration: Readonly<Record<CombatVfxPhase, number>> = {
  anticipation: 0.28,
  activation: 0.18,
  sustain: 0.42,
  release: 0.22
};

export function getAbilityCombatVfxProfile(abilityId: string): CombatVfxProfile | undefined {
  return profiles[abilityId];
}

export function listAbilityCombatVfxProfiles(): CombatVfxProfile[] {
  return Object.values(profiles).map((profile) => ({
    ...profile,
    ...(profile.colors ? { colors: { ...profile.colors } } : {}),
    ...(profile.telegraph ? { telegraph: { ...profile.telegraph } } : {}),
    ...(profile.persistentRig ? { persistentRig: { ...profile.persistentRig } } : {}),
    layers: profile.layers.map((layer) => ({ ...layer }))
  }));
}

export function getCombatVfxPersistentRig(statusId: string): RotaryCannonRigDefinition | undefined {
  for (const profile of Object.values(profiles)) {
    if (profile.persistentRig?.statusId === statusId) return { ...profile.persistentRig };
  }
  return undefined;
}

export function resolveCombatVfxLayer(
  profile: CombatVfxProfile,
  phase: CombatVfxPhase,
  castTicks = 0
): ResolvedCombatVfxLayer | undefined {
  const layer = profile.layers.find((candidate) => candidate.phase === phase);
  if (!layer) return undefined;
  const castSeconds = Math.max(0.12, Math.min(1.8, castTicks / 60));
  const scale = COMBAT_VFX_HIERARCHY_SCALE[profile.hierarchy];
  return {
    abilityId: profile.abilityId,
    palette: profile.palette,
    hierarchy: profile.hierarchy,
    ...(profile.colors ? { colors: { ...profile.colors } } : {}),
    phase: layer.phase,
    intent: layer.intent,
    anchor: layer.anchor,
    delaySeconds: Math.max(0, layer.delaySeconds ?? 0),
    durationSeconds: Math.max(0.06, layer.useCastDuration ? castSeconds : layer.durationSeconds ?? phaseDuration[layer.phase]),
    intensity: Math.max(0.1, (layer.intensity ?? 1) * scale),
    radiusScale: Math.max(0.2, layer.radiusScale ?? 1)
  };
}
