import type { Element } from '@kinetic/protocol';

export type VfxQualityTier = 'low' | 'medium' | 'high';
export type VfxAnchor = 'arena' | 'world' | 'fighter' | 'weapon' | 'projectile' | 'screen';
export type VfxParticleShape = 'spark' | 'smoke' | 'debris' | 'ember' | 'droplet' | 'shard';

export interface ElementVfxPalette {
  core: number;
  accent: number;
  glow: number;
  smoke: number;
  debris: number;
  groundMark: number;
}

export interface WeaponVfxRecipe {
  weaponId: string;
  trailShape: 'slash' | 'thrust' | 'spin' | 'beam' | 'lob' | 'orbit';
  trailColor: number;
  impactColor: number;
  residualShape: VfxParticleShape;
  groundMark: 'none' | 'scorch' | 'frost' | 'crack' | 'wet' | 'void';
  muzzleFlash: boolean;
}

export interface VfxQualityProfile {
  tier: VfxQualityTier;
  particleMultiplier: number;
  residualMultiplier: number;
  maxGroundMarks: number;
  trailSamples: number;
  glowMultiplier: number;
  shakeMultiplier: number;
  freezeMultiplier: number;
  flashMultiplier: number;
}

export interface VfxQualityInput {
  effects: boolean;
  particleScale: number;
  reducedMotion: boolean;
  adaptiveQuality: boolean;
  performanceScale: number;
  fighterCount: number;
}

const qualityProfiles: Record<VfxQualityTier, VfxQualityProfile> = {
  low: {
    tier: 'low', particleMultiplier: 0.3, residualMultiplier: 0.16, maxGroundMarks: 8,
    trailSamples: 5, glowMultiplier: 0.55, shakeMultiplier: 0.5, freezeMultiplier: 0.55, flashMultiplier: 0.5
  },
  medium: {
    tier: 'medium', particleMultiplier: 0.66, residualMultiplier: 0.5, maxGroundMarks: 22,
    trailSamples: 9, glowMultiplier: 0.82, shakeMultiplier: 0.78, freezeMultiplier: 0.8, flashMultiplier: 0.76
  },
  high: {
    tier: 'high', particleMultiplier: 1, residualMultiplier: 1, maxGroundMarks: 72,
    trailSamples: 18, glowMultiplier: 1, shakeMultiplier: 1, freezeMultiplier: 1, flashMultiplier: 1
  }
};

const palettes: Record<Element, ElementVfxPalette> = {
  neutral: { core: 0xffffff, accent: 0xffcf7a, glow: 0xffe3a8, smoke: 0x59616d, debris: 0xc8b58d, groundMark: 0x332d27 },
  fire: { core: 0xfff4a8, accent: 0xff6a2f, glow: 0xffa13d, smoke: 0x4e4548, debris: 0xff9b52, groundMark: 0x4b1d17 },
  water: { core: 0xe1fdff, accent: 0x39c9ff, glow: 0x6ee7ff, smoke: 0x2f6680, debris: 0x8deaff, groundMark: 0x164b68 },
  ice: { core: 0xffffff, accent: 0x8cecff, glow: 0xc8f8ff, smoke: 0x7ca6b8, debris: 0xcdf8ff, groundMark: 0x35687c },
  electric: { core: 0xffffff, accent: 0xffef4f, glow: 0x8bf5ff, smoke: 0x53656d, debris: 0xcafcff, groundMark: 0x3c3a16 },
  metal: { core: 0xe9fbff, accent: 0x9db6c9, glow: 0x7fdfff, smoke: 0x525b64, debris: 0xbec8d1, groundMark: 0x30383f },
  nature: { core: 0xeaffb1, accent: 0x74d35d, glow: 0xa6f08c, smoke: 0x445d42, debris: 0xb8df75, groundMark: 0x254425 },
  void: { core: 0xf3ddff, accent: 0xa55cff, glow: 0x69e8ff, smoke: 0x302944, debris: 0xc69cff, groundMark: 0x26173d }
};

const weaponRecipes: Record<string, WeaponVfxRecipe> = {
  'flame-fists': { weaponId: 'flame-fists', trailShape: 'beam', trailColor: 0xff5a24, impactColor: 0xffffae, residualShape: 'ember', groundMark: 'scorch', muzzleFlash: true },
  'pressure-orb': { weaponId: 'pressure-orb', trailShape: 'beam', trailColor: 0x57dfff, impactColor: 0xdafcff, residualShape: 'droplet', groundMark: 'wet', muzzleFlash: true },
  'hydraulic-gauntlet': { weaponId: 'hydraulic-gauntlet', trailShape: 'slash', trailColor: 0xb9d2df, impactColor: 0xf4ffff, residualShape: 'debris', groundMark: 'crack', muzzleFlash: false },
  'demolition-bomb': { weaponId: 'demolition-bomb', trailShape: 'lob', trailColor: 0xffb347, impactColor: 0xffef9a, residualShape: 'smoke', groundMark: 'scorch', muzzleFlash: false },
  'frost-halberd': { weaponId: 'frost-halberd', trailShape: 'slash', trailColor: 0xa9efff, impactColor: 0xffffff, residualShape: 'shard', groundMark: 'frost', muzzleFlash: false },
  'arc-emitter': { weaponId: 'arc-emitter', trailShape: 'beam', trailColor: 0x8df6ff, impactColor: 0xe8ffff, residualShape: 'spark', groundMark: 'none', muzzleFlash: true },
  'automatic-rifle': { weaponId: 'automatic-rifle', trailShape: 'beam', trailColor: 0xffd36a, impactColor: 0xfff1b0, residualShape: 'spark', groundMark: 'none', muzzleFlash: true },
  'tactical-round': { weaponId: 'tactical-round', trailShape: 'beam', trailColor: 0x8ee8ff, impactColor: 0xe9fcff, residualShape: 'spark', groundMark: 'none', muzzleFlash: true },
  'suppressive-round': { weaponId: 'suppressive-round', trailShape: 'beam', trailColor: 0xffd36a, impactColor: 0xffefb5, residualShape: 'spark', groundMark: 'none', muzzleFlash: true },
  'pinning-round-projectile': { weaponId: 'pinning-round-projectile', trailShape: 'beam', trailColor: 0xff9f54, impactColor: 0xffffff, residualShape: 'debris', groundMark: 'crack', muzzleFlash: true },
  'guided-rocket': { weaponId: 'guided-rocket', trailShape: 'beam', trailColor: 0xffa13d, impactColor: 0xfff1a0, residualShape: 'smoke', groundMark: 'scorch', muzzleFlash: true },
  'rocket-salvo-missile': { weaponId: 'rocket-salvo-missile', trailShape: 'beam', trailColor: 0xffb44d, impactColor: 0xfff0a3, residualShape: 'smoke', groundMark: 'scorch', muzzleFlash: true },
  'siege-missile': { weaponId: 'siege-missile', trailShape: 'beam', trailColor: 0xff7b38, impactColor: 0xffffff, residualShape: 'smoke', groundMark: 'crack', muzzleFlash: true },
  'micro-missile': { weaponId: 'micro-missile', trailShape: 'beam', trailColor: 0xffd06b, impactColor: 0xffffff, residualShape: 'smoke', groundMark: 'scorch', muzzleFlash: true },
  'thorn-claws': { weaponId: 'thorn-claws', trailShape: 'slash', trailColor: 0x8fdf67, impactColor: 0xe7ffaf, residualShape: 'debris', groundMark: 'none', muzzleFlash: false },
  'void-scythe': { weaponId: 'void-scythe', trailShape: 'slash', trailColor: 0xb06cff, impactColor: 0xd9b8ff, residualShape: 'spark', groundMark: 'void', muzzleFlash: false },
  'duelist-sword': { weaponId: 'duelist-sword', trailShape: 'slash', trailColor: 0xd8e6ff, impactColor: 0xffffff, residualShape: 'spark', groundMark: 'none', muzzleFlash: false },
  'cyclone-sword': { weaponId: 'cyclone-sword', trailShape: 'spin', trailColor: 0xb9d8ff, impactColor: 0xffffff, residualShape: 'spark', groundMark: 'none', muzzleFlash: false },
  'lancer-spear': { weaponId: 'lancer-spear', trailShape: 'thrust', trailColor: 0xbfe8ff, impactColor: 0xffffff, residualShape: 'spark', groundMark: 'none', muzzleFlash: false },
  'cyclone-spear': { weaponId: 'cyclone-spear', trailShape: 'spin', trailColor: 0xbfe8ff, impactColor: 0xffffff, residualShape: 'spark', groundMark: 'none', muzzleFlash: false }
};

const fallbackWeaponRecipe: WeaponVfxRecipe = {
  weaponId: 'generic', trailShape: 'slash', trailColor: 0xffe4b5, impactColor: 0xffffff,
  residualShape: 'spark', groundMark: 'none', muzzleFlash: false
};

export function getElementVfxPalette(element: Element): ElementVfxPalette {
  return palettes[element] ?? palettes.neutral;
}

export function getWeaponVfxRecipe(weaponId: string): WeaponVfxRecipe {
  return weaponRecipes[weaponId] ?? { ...fallbackWeaponRecipe, weaponId };
}

export function getVfxQualityProfile(tier: VfxQualityTier): VfxQualityProfile {
  return qualityProfiles[tier];
}

export function resolveVfxQuality(input: VfxQualityInput): VfxQualityProfile {
  if (!input.effects || input.particleScale <= 0 || input.fighterCount >= 64) return qualityProfiles.low;
  const loadPenalty = input.fighterCount >= 36 ? 0.28 : input.fighterCount >= 20 ? 0.14 : input.fighterCount >= 12 ? 0.06 : 0;
  const adaptive = input.adaptiveQuality ? Math.max(0.35, Math.min(1, input.performanceScale)) : 1;
  const motionPenalty = input.reducedMotion ? 0.18 : 0;
  const score = Math.max(0, Math.min(1.25, input.particleScale / 1.1)) * adaptive - loadPenalty - motionPenalty;
  if (input.fighterCount < 36 && score >= 0.78) return qualityProfiles.high;
  if (score >= 0.4) return qualityProfiles.medium;
  return qualityProfiles.low;
}

export function resolveVisualRadius(gameplayRadius: number, tier: VfxQualityTier, importance: 'ambient' | 'impact' | 'ultimate' = 'impact'): number {
  const quality = tier === 'high' ? 1 : tier === 'medium' ? 0.86 : 0.68;
  const importanceScale = importance === 'ultimate' ? 1.35 : importance === 'ambient' ? 0.72 : 1;
  return Math.max(4, gameplayRadius * quality * importanceScale);
}
