import type { Element } from '@kinetic/protocol';

export const COMBAT_VFX_PHASES = ['anticipation', 'activation', 'sustain', 'release'] as const;
export const COMBAT_VFX_INTENTS = [
  'projectile',
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

export interface CombatVfxProfile {
  abilityId: string;
  palette: Element;
  hierarchy: CombatVfxHierarchy;
  layers: readonly CombatVfxLayerDefinition[];
}

export interface ResolvedCombatVfxLayer {
  abilityId: string;
  palette: Element;
  hierarchy: CombatVfxHierarchy;
  phase: CombatVfxPhase;
  intent: CombatVfxIntent;
  anchor: CombatVfxAnchor;
  delaySeconds: number;
  durationSeconds: number;
  intensity: number;
  radiusScale: number;
}

const profiles: Readonly<Record<string, CombatVfxProfile>> = {
  'thunder-dome': {
    abilityId: 'thunder-dome',
    palette: 'electric',
    hierarchy: 'ultimate',
    layers: [
      {
        phase: 'anticipation',
        intent: 'ultimate',
        anchor: 'activated',
        useCastDuration: true,
        intensity: 0.82,
        radiusScale: 0.72
      },
      {
        phase: 'activation',
        intent: 'explosion',
        anchor: 'resolved',
        durationSeconds: 0.24,
        intensity: 1.12,
        radiusScale: 1.12
      },
      {
        phase: 'sustain',
        intent: 'channel',
        anchor: 'resolved',
        delaySeconds: 0.08,
        durationSeconds: 0.5,
        intensity: 0.82,
        radiusScale: 1
      },
      {
        phase: 'release',
        intent: 'status',
        anchor: 'resolved',
        delaySeconds: 0.32,
        durationSeconds: 0.28,
        intensity: 0.72,
        radiusScale: 0.9
      }
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
    layers: profile.layers.map((layer) => ({ ...layer }))
  }));
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
    phase: layer.phase,
    intent: layer.intent,
    anchor: layer.anchor,
    delaySeconds: Math.max(0, layer.delaySeconds ?? 0),
    durationSeconds: Math.max(0.06, layer.useCastDuration ? castSeconds : layer.durationSeconds ?? phaseDuration[layer.phase]),
    intensity: Math.max(0.1, (layer.intensity ?? 1) * scale),
    radiusScale: Math.max(0.2, layer.radiusScale ?? 1)
  };
}
