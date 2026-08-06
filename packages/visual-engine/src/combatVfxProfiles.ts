import {
  FROST_WARDEN_VFX_PROFILES,
  ROCKET_VANGUARD_VFX_PROFILES,
  THORN_COLOSSUS_VFX_PROFILES,
  VOID_REAPER_VFX_PROFILES,
  WATER_SHAPER_VFX_PROFILES
} from './profiles';
import type { Element } from '@kinetic/protocol';
import type { VfxParticleShape } from './vfx';

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
export type CombatVfxTreatment =
  | 'crystalline'
  | 'rocket-exhaust'
  | 'target-lock'
  | 'starburst'
  | 'water-flow'
  | 'root-growth'
  | 'void-tear'
  | 'singularity';

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
  /** Directional force cone instead of a radial pressure wave. */
  directional?: boolean;
  /** Reusable renderer treatment for fighter-specific presentation without ability-ID checks. */
  treatment?: CombatVfxTreatment;
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
  directional: boolean;
  treatment?: CombatVfxTreatment;
}


export interface CombatVfxParticleStyle {
  primary: VfxParticleShape;
  secondary: VfxParticleShape;
}

/**
 * Shared shape vocabulary for profile-driven effects. Circles remain useful for
 * soft glows and smoke, but damaging actions default to directional, broken or
 * angular particles so combat does not read as a field of floating bubbles.
 */
export function resolveCombatVfxParticleStyle(
  layer: Pick<ResolvedCombatVfxLayer, 'intent' | 'palette' | 'phase' | 'directional'>
): CombatVfxParticleStyle {
  if (layer.intent === 'explosion') {
    if (layer.palette === 'fire') return { primary: 'flame', secondary: 'debris' };
    if (layer.palette === 'electric') return { primary: 'arc', secondary: 'ring-fragment' };
    if (layer.palette === 'ice') return { primary: 'shard', secondary: 'ring-fragment' };
    if (layer.palette === 'water') return { primary: 'ribbon', secondary: 'droplet' };
    if (layer.palette === 'nature') return { primary: 'wedge', secondary: 'debris' };
    if (layer.palette === 'void') return { primary: 'streak', secondary: 'ring-fragment' };
    if (layer.palette === 'metal' || layer.palette === 'neutral') return { primary: 'debris', secondary: 'smoke' };
    return { primary: 'streak', secondary: 'ring-fragment' };
  }
  if (layer.intent === 'pull') return { primary: 'ribbon', secondary: 'ring-fragment' };
  if (layer.intent === 'knockback') {
    return layer.directional
      ? { primary: 'wedge', secondary: 'streak' }
      : { primary: 'ring-fragment', secondary: 'debris' };
  }
  if (layer.intent === 'beam') {
    return layer.palette === 'electric'
      ? { primary: 'arc', secondary: 'streak' }
      : { primary: 'streak', secondary: 'spark' };
  }
  if (layer.intent === 'burst-fire' || layer.intent === 'projectile' || layer.intent === 'dash') {
    if (layer.palette === 'electric') return { primary: 'arc', secondary: 'streak' };
    if (layer.palette === 'ice') return { primary: 'shard', secondary: 'streak' };
    if (layer.palette === 'water') return { primary: 'ribbon', secondary: 'droplet' };
    if (layer.palette === 'nature') return { primary: 'wedge', secondary: 'debris' };
    if (layer.palette === 'void') return { primary: 'streak', secondary: 'ring-fragment' };
    return { primary: 'streak', secondary: layer.palette === 'fire' ? 'ember' : 'spark' };
  }
  if (layer.intent === 'transformation' || layer.intent === 'ultimate') {
    if (layer.palette === 'water') return { primary: 'ribbon', secondary: 'droplet' };
    if (layer.palette === 'nature') return { primary: 'wedge', secondary: 'ribbon' };
    if (layer.palette === 'void') return { primary: 'streak', secondary: 'ring-fragment' };
    return {
      primary: layer.palette === 'fire' ? 'flame' : layer.palette === 'electric' ? 'arc' : layer.palette === 'ice' ? 'shard' : 'ring-fragment',
      secondary: layer.palette === 'metal' ? 'debris' : layer.palette === 'ice' ? 'ring-fragment' : 'ribbon'
    };
  }
  if (layer.intent === 'status') {
    if (layer.palette === 'fire') return { primary: 'ember', secondary: 'flame' };
    if (layer.palette === 'electric') return { primary: 'arc', secondary: 'spark' };
    if (layer.palette === 'ice') return { primary: 'shard', secondary: 'spark' };
    if (layer.palette === 'water') return { primary: 'droplet', secondary: 'ribbon' };
    if (layer.palette === 'nature') return { primary: 'wedge', secondary: 'debris' };
    if (layer.palette === 'void') return { primary: 'streak', secondary: 'ring-fragment' };
    return { primary: 'spark', secondary: 'ribbon' };
  }
  if (layer.intent === 'channel') {
    if (layer.palette === 'fire') return { primary: 'flame', secondary: 'ember' };
    if (layer.palette === 'ice') return { primary: 'shard', secondary: 'ring-fragment' };
    if (layer.palette === 'water') return { primary: 'ribbon', secondary: 'droplet' };
    if (layer.palette === 'nature') return { primary: 'ribbon', secondary: 'debris' };
    if (layer.palette === 'void') return { primary: 'streak', secondary: 'ring-fragment' };
    if (layer.palette === 'metal' || layer.palette === 'neutral') return { primary: 'smoke', secondary: 'debris' };
    return { primary: 'ribbon', secondary: 'spark' };
  }
  return { primary: 'spark', secondary: 'streak' };
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
      { phase: 'activation', intent: 'knockback', anchor: 'resolved', durationSeconds: 0.18, intensity: 1.06, radiusScale: 1.02, directional: true },
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
  'blast-dash': {
    abilityId: 'blast-dash',
    palette: 'neutral',
    hierarchy: 'skill',
    colors: { core: 0xffffd2, accent: 0xff702f, glow: 0xffb34f },
    layers: [
      { phase: 'anticipation', intent: 'dash', anchor: 'activated', useCastDuration: true, intensity: 0.7, radiusScale: 0.58 },
      { phase: 'activation', intent: 'dash', anchor: 'resolved', durationSeconds: 0.18, intensity: 0.94, radiusScale: 0.84 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.03, durationSeconds: 0.3, intensity: 0.62, radiusScale: 0.76 },
      { phase: 'release', intent: 'explosion', anchor: 'resolved', delaySeconds: 0.16, durationSeconds: 0.2, intensity: 0.66, radiusScale: 0.78 }
    ]
  },
  'concussion-bomb': {
    abilityId: 'concussion-bomb',
    palette: 'neutral',
    hierarchy: 'skill',
    colors: { core: 0xffffe0, accent: 0xff9a3d, glow: 0xffd76a },
    layers: [
      { phase: 'anticipation', intent: 'explosion', anchor: 'activated', useCastDuration: true, intensity: 0.76, radiusScale: 0.72 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.26, intensity: 0.98, radiusScale: 1.04 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.08, durationSeconds: 0.22, intensity: 0.74, radiusScale: 0.94 }
    ]
  },
  'shrapnel-burst': {
    abilityId: 'shrapnel-burst',
    palette: 'neutral',
    hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0xff5e36, glow: 0xffd65c },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.76 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.28, intensity: 1.08, radiusScale: 1.12 },
      { phase: 'sustain', intent: 'burst-fire', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.3, intensity: 0.78, radiusScale: 1.02 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.18, durationSeconds: 0.24, intensity: 0.78, radiusScale: 0.98 }
    ]
  },
  'mega-bomb': {
    abilityId: 'mega-bomb',
    palette: 'neutral',
    hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0xff3d20, glow: 0xffef65 },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', useCastDuration: true, intensity: 1.04, radiusScale: 0.92 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.36, intensity: 1.2, radiusScale: 1.34 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.7, intensity: 0.88, radiusScale: 1.18 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.38, durationSeconds: 0.34, intensity: 0.92, radiusScale: 1.12 }
    ]
  },
  'kinetic-pulse': {
    abilityId: 'kinetic-pulse',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x60d9ff, glow: 0xcff9ff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.72, radiusScale: 0.68 },
      { phase: 'activation', intent: 'explosion', anchor: 'resolved', durationSeconds: 0.24, intensity: 0.98, radiusScale: 1.02 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.08, durationSeconds: 0.22, intensity: 0.72, radiusScale: 0.94 }
    ]
  },
  'magnet-drag': {
    abilityId: 'magnet-drag',
    palette: 'metal',
    hierarchy: 'skill',
    colors: { core: 0xffffff, accent: 0x54c9dc, glow: 0xa9f5ff },
    layers: [
      { phase: 'anticipation', intent: 'pull', anchor: 'activated', useCastDuration: true, intensity: 0.78, radiusScale: 0.82 },
      { phase: 'activation', intent: 'pull', anchor: 'resolved', durationSeconds: 0.3, intensity: 1, radiusScale: 1.12 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.04, durationSeconds: 0.4, intensity: 0.7, radiusScale: 1 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.24, durationSeconds: 0.2, intensity: 0.66, radiusScale: 0.88 }
    ]
  },
  'fortify': {
    abilityId: 'fortify',
    palette: 'metal',
    hierarchy: 'payoff',
    colors: { core: 0xffffff, accent: 0x7193a6, glow: 0xd9fbff },
    layers: [
      { phase: 'anticipation', intent: 'transformation', anchor: 'activated', useCastDuration: true, intensity: 0.84, radiusScale: 0.72 },
      { phase: 'activation', intent: 'transformation', anchor: 'resolved', durationSeconds: 0.28, intensity: 1.02, radiusScale: 0.96 },
      { phase: 'sustain', intent: 'status', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.66, intensity: 0.74, radiusScale: 0.88 },
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.4, durationSeconds: 0.2, intensity: 0.6, radiusScale: 0.8 }
    ]
  },
  'reactor-overdrive': {
    abilityId: 'reactor-overdrive',
    palette: 'metal',
    hierarchy: 'ultimate',
    colors: { core: 0xffffff, accent: 0x5edcff, glow: 0xbff8ff },
    layers: [
      { phase: 'anticipation', intent: 'ultimate', anchor: 'activated', useCastDuration: true, intensity: 1, radiusScale: 0.82 },
      { phase: 'activation', intent: 'transformation', anchor: 'resolved', durationSeconds: 0.3, intensity: 1.1, radiusScale: 1.04 },
      { phase: 'sustain', intent: 'channel', anchor: 'resolved', delaySeconds: 0.06, durationSeconds: 0.9, intensity: 0.86, radiusScale: 1 },
      { phase: 'release', intent: 'transformation', anchor: 'resolved', delaySeconds: 0.72, durationSeconds: 0.3, intensity: 0.78, radiusScale: 0.9 }
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
      { phase: 'release', intent: 'knockback', anchor: 'resolved', delaySeconds: 0.05, durationSeconds: 0.16, intensity: 0.58, radiusScale: 0.72, directional: true }
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
  },
  ...FROST_WARDEN_VFX_PROFILES,
  ...ROCKET_VANGUARD_VFX_PROFILES,
  ...WATER_SHAPER_VFX_PROFILES,
  ...THORN_COLOSSUS_VFX_PROFILES,
  ...VOID_REAPER_VFX_PROFILES
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
    radiusScale: Math.max(0.2, layer.radiusScale ?? 1),
    directional: layer.directional ?? false,
    ...(layer.treatment ? { treatment: layer.treatment } : {})
  };
}
