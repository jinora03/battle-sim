import type { RenderProfileId } from '@kinetic/protocol';

export interface VisualRecipe {
  id: string;
  shape: 'orb' | 'mech' | 'water' | 'bomber';
  bodyColor: number;
  bodyDarkColor: number;
  coreColor: number;
  auraColor: number;
  accentColor: number;
  horns: boolean;
}

export interface MotionRecipe {
  id: string;
  speedStretch: number;
  impactSquash: number;
  lean: number;
  pulseAmount: number;
  pulseSpeed: number;
  weaponSpin: number;
}

export interface RenderProfile {
  id: RenderProfileId;
  showCharacterLayers: boolean;
  showLabels: boolean;
  showColliders: boolean;
  showVelocityVectors: boolean;
  defaultParticleScale: number;
}

export interface PresentationSettings {
  renderProfile: RenderProfileId;
  effects: boolean;
  arenaBackground: boolean;
  trails: boolean;
  cameraShake: boolean;
  impactFreeze: boolean;
  showMountedAttachments: boolean;
  showFighterHealthRings: boolean;
  showDamageNumbers: boolean;
  cameraFollow: boolean;
  screenFlash: boolean;
  audio: boolean;
  masterVolume: number;
  particleScale: number;
  maxDevicePixelRatio: number;
  renderScale: number;
  targetRenderFps: 30 | 60;
  adaptiveQuality: boolean;
  reducedMotion: boolean;
}

export interface ImpactResponse {
  tier: 'tap' | 'solid' | 'heavy' | 'critical';
  particleCount: number;
  particleSpeed: number;
  shockwaveRadius: number;
  shake: number;
  freezeMs: number;
  flash: number;
}

const visualRecipes: Record<string, VisualRecipe> = {
  'pyro-brawler': {
    id: 'pyro-brawler', shape: 'orb', bodyColor: 0xf04a24, bodyDarkColor: 0x621c18,
    coreColor: 0xffdf73, auraColor: 0xff6b2c, accentColor: 0xffb347, horns: true
  },
  'mech-bruiser': {
    id: 'mech-bruiser', shape: 'mech', bodyColor: 0x62748a, bodyDarkColor: 0x202b38,
    coreColor: 0x72e1ff, auraColor: 0x6abbd1, accentColor: 0xc2e9f4, horns: false
  },
  'water-shaper': {
    id: 'water-shaper', shape: 'water', bodyColor: 0x1f8ecb, bodyDarkColor: 0x0b3558,
    coreColor: 0xbff7ff, auraColor: 0x3bc9ff, accentColor: 0x73dcff, horns: false
  },
  bomber: {
    id: 'bomber', shape: 'bomber', bodyColor: 0x383c49, bodyDarkColor: 0x11141c,
    coreColor: 0xff6a38, auraColor: 0xff8a37, accentColor: 0xffcf57, horns: false
  },
  'frost-warden': {
    id: 'frost-warden', shape: 'mech', bodyColor: 0x8bcce5, bodyDarkColor: 0x183348,
    coreColor: 0xe9fdff, auraColor: 0x78e6ff, accentColor: 0xc9f6ff, horns: true
  },
  'volt-striker': {
    id: 'volt-striker', shape: 'orb', bodyColor: 0xe3d92f, bodyDarkColor: 0x4d4410,
    coreColor: 0xffffff, auraColor: 0xfff35a, accentColor: 0x79f4ff, horns: false
  },
  'thorn-colossus': {
    id: 'thorn-colossus', shape: 'mech', bodyColor: 0x568b45, bodyDarkColor: 0x19351d,
    coreColor: 0xd9ff8a, auraColor: 0x72df62, accentColor: 0xbbe67c, horns: true
  },
  'void-reaper': {
    id: 'void-reaper', shape: 'orb', bodyColor: 0x6c3eb2, bodyDarkColor: 0x1c103a,
    coreColor: 0xf2d6ff, auraColor: 0xa55cff, accentColor: 0x61e0ff, horns: true
  },
  gunner: {
    id: 'gunner', shape: 'mech', bodyColor: 0x394957, bodyDarkColor: 0x111a22,
    coreColor: 0xffd36b, auraColor: 0x63d7ff, accentColor: 0x94efff, horns: false
  },
  'rocket-vanguard': {
    id: 'rocket-vanguard', shape: 'mech', bodyColor: 0x56616b, bodyDarkColor: 0x171d23,
    coreColor: 0xffb44d, auraColor: 0xff6b32, accentColor: 0xffd780, horns: false
  },
  'solar-sentinel': {
    id: 'solar-sentinel', shape: 'orb', bodyColor: 0x2668b8, bodyDarkColor: 0x102747,
    coreColor: 0xffe36d, auraColor: 0xff7250, accentColor: 0xe7f6ff, horns: false
  }
};

const motionRecipes: Record<string, MotionRecipe> = {
  'volatile-orb': {
    id: 'volatile-orb', speedStretch: 0.18, impactSquash: 0.24, lean: 0.16,
    pulseAmount: 0.045, pulseSpeed: 3.2, weaponSpin: 2.8
  },
  'heavy-mech': {
    id: 'heavy-mech', speedStretch: 0.06, impactSquash: 0.1, lean: 0.05,
    pulseAmount: 0.012, pulseSpeed: 1.2, weaponSpin: 1.1
  },
  'fluid-orb': {
    id: 'fluid-orb', speedStretch: 0.23, impactSquash: 0.28, lean: 0.22,
    pulseAmount: 0.055, pulseSpeed: 2.2, weaponSpin: 0.8
  },
  'volatile-bomber': {
    id: 'volatile-bomber', speedStretch: 0.12, impactSquash: 0.2, lean: 0.1,
    pulseAmount: 0.026, pulseSpeed: 4.2, weaponSpin: 0
  },
  'frozen-sentinel': {
    id: 'frozen-sentinel', speedStretch: 0.07, impactSquash: 0.09, lean: 0.05,
    pulseAmount: 0.018, pulseSpeed: 1.4, weaponSpin: 0.75
  },
  'electric-spark': {
    id: 'electric-spark', speedStretch: 0.28, impactSquash: 0.18, lean: 0.25,
    pulseAmount: 0.065, pulseSpeed: 5.8, weaponSpin: 5.2
  },
  'rooted-giant': {
    id: 'rooted-giant', speedStretch: 0.04, impactSquash: 0.08, lean: 0.035,
    pulseAmount: 0.022, pulseSpeed: 0.8, weaponSpin: 0.5
  },
  'void-orbit': {
    id: 'void-orbit', speedStretch: 0.22, impactSquash: 0.16, lean: 0.19,
    pulseAmount: 0.052, pulseSpeed: 2.8, weaponSpin: 3.7
  },
  'gunner-mobile': {
    id: 'gunner-mobile', speedStretch: 0.14, impactSquash: 0.12, lean: 0.08,
    pulseAmount: 0.02, pulseSpeed: 2.4, weaponSpin: 0
  },
  'rocket-artillery': {
    id: 'rocket-artillery', speedStretch: 0.11, impactSquash: 0.16, lean: 0.09,
    pulseAmount: 0.026, pulseSpeed: 2, weaponSpin: 0
  },
  'solar-flight': {
    id: 'solar-flight', speedStretch: 0.24, impactSquash: 0.12, lean: 0.22,
    pulseAmount: 0.035, pulseSpeed: 2.8, weaponSpin: 0
  }
};


const builtinVisualRecipeIds = new Set(Object.keys(visualRecipes));
const builtinMotionRecipeIds = new Set(Object.keys(motionRecipes));
const customVisualRecipeIds = new Set<string>();
const customMotionRecipeIds = new Set<string>();

export interface RegisterRecipeOptions {
  replace?: boolean;
}

function assertFiniteColor(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new Error(`${label} must be an integer between 0x000000 and 0xFFFFFF.`);
}

export function registerVisualRecipe(recipe: VisualRecipe, options: RegisterRecipeOptions = {}): VisualRecipe {
  if (!recipe.id.trim()) throw new Error('Visual recipe ID is required.');
  if (visualRecipes[recipe.id] && !options.replace) throw new Error(`Visual recipe already exists: ${recipe.id}`);
  if (builtinVisualRecipeIds.has(recipe.id)) throw new Error(`Built-in visual recipe IDs cannot be replaced: ${recipe.id}`);
  assertFiniteColor(recipe.bodyColor, 'bodyColor');
  assertFiniteColor(recipe.bodyDarkColor, 'bodyDarkColor');
  assertFiniteColor(recipe.coreColor, 'coreColor');
  assertFiniteColor(recipe.auraColor, 'auraColor');
  assertFiniteColor(recipe.accentColor, 'accentColor');
  visualRecipes[recipe.id] = { ...recipe };
  customVisualRecipeIds.add(recipe.id);
  return visualRecipes[recipe.id]!;
}

export function registerMotionRecipe(recipe: MotionRecipe, options: RegisterRecipeOptions = {}): MotionRecipe {
  if (!recipe.id.trim()) throw new Error('Motion recipe ID is required.');
  if (motionRecipes[recipe.id] && !options.replace) throw new Error(`Motion recipe already exists: ${recipe.id}`);
  if (builtinMotionRecipeIds.has(recipe.id)) throw new Error(`Built-in motion recipe IDs cannot be replaced: ${recipe.id}`);
  for (const [key, value] of Object.entries(recipe)) {
    if (key !== 'id' && (!Number.isFinite(value) || Number(value) < 0)) throw new Error(`${key} must be a finite non-negative number.`);
  }
  motionRecipes[recipe.id] = { ...recipe };
  customMotionRecipeIds.add(recipe.id);
  return motionRecipes[recipe.id]!;
}

export function removeCustomVisualRecipe(id: string): boolean {
  if (!customVisualRecipeIds.has(id)) return false;
  customVisualRecipeIds.delete(id);
  delete visualRecipes[id];
  return true;
}

export function removeCustomMotionRecipe(id: string): boolean {
  if (!customMotionRecipeIds.has(id)) return false;
  customMotionRecipeIds.delete(id);
  delete motionRecipes[id];
  return true;
}

export const hasVisualRecipe = (id: string) => Boolean(visualRecipes[id]);
export const hasMotionRecipe = (id: string) => Boolean(motionRecipes[id]);
export const isCustomVisualRecipe = (id: string) => customVisualRecipeIds.has(id);
export const isCustomMotionRecipe = (id: string) => customMotionRecipeIds.has(id);
export const listVisualRecipes = () => Object.values(visualRecipes).map((recipe) => ({ ...recipe }));
export const listMotionRecipes = () => Object.values(motionRecipes).map((recipe) => ({ ...recipe }));

const renderProfiles: Record<RenderProfileId, RenderProfile> = {
  standard: {
    id: 'standard', showCharacterLayers: true, showLabels: false, showColliders: false,
    showVelocityVectors: false, defaultParticleScale: 1
  },
  minimal: {
    id: 'minimal', showCharacterLayers: false, showLabels: false, showColliders: false,
    showVelocityVectors: false, defaultParticleScale: 0.35
  },
  debug: {
    id: 'debug', showCharacterLayers: false, showLabels: true, showColliders: true,
    showVelocityVectors: true, defaultParticleScale: 0
  }
};

export const defaultPresentationSettings: PresentationSettings = {
  renderProfile: 'standard',
  effects: true,
  arenaBackground: true,
  trails: true,
  cameraShake: true,
  impactFreeze: true,
  showMountedAttachments: true,
  showFighterHealthRings: true,
  showDamageNumbers: true,
  cameraFollow: true,
  screenFlash: true,
  audio: true,
  masterVolume: 0.32,
  particleScale: 1,
  maxDevicePixelRatio: 2,
  renderScale: 1,
  targetRenderFps: 60,
  adaptiveQuality: true,
  reducedMotion: false
};

export function getVisualRecipe(id: string): VisualRecipe {
  const recipe = visualRecipes[id];
  if (!recipe) throw new Error(`Unknown visual recipe: ${id}`);
  return recipe;
}

export function getMotionRecipe(id: string): MotionRecipe {
  const recipe = motionRecipes[id];
  if (!recipe) throw new Error(`Unknown motion recipe: ${id}`);
  return recipe;
}

export function getRenderProfile(id: RenderProfileId): RenderProfile {
  const profile = renderProfiles[id];
  if (!profile) throw new Error(`Unknown render profile: ${id}`);
  return profile;
}

export function elementColor(element: string): number {
  switch (element) {
    case 'fire': return 0xff5d2e;
    case 'water': return 0x4db8ff;
    case 'ice': return 0xa5efff;
    case 'electric': return 0xffee5d;
    case 'metal': return 0x9db0c4;
    case 'nature': return 0x78d46f;
    case 'void': return 0xaa6cff;
    default: return 0xffb24d;
  }
}

export function resolveImpactResponse(magnitude: number): ImpactResponse {
  if (magnitude >= 16) {
    return { tier: 'critical', particleCount: 34, particleSpeed: 9.5, shockwaveRadius: 58, shake: 13, freezeMs: 58, flash: 0.42 };
  }
  if (magnitude >= 8) {
    return { tier: 'heavy', particleCount: 24, particleSpeed: 7.2, shockwaveRadius: 44, shake: 8.5, freezeMs: 38, flash: 0.28 };
  }
  if (magnitude >= 3.2) {
    return { tier: 'solid', particleCount: 13, particleSpeed: 5.2, shockwaveRadius: 28, shake: 4.2, freezeMs: 20, flash: 0.13 };
  }
  return { tier: 'tap', particleCount: 5, particleSpeed: 3.1, shockwaveRadius: 0, shake: 1.2, freezeMs: 0, flash: 0 };
}

export interface MotionPoseInput {
  speed: number;
  impact: number;
  elapsedSeconds: number;
}

export interface MotionPose {
  scaleX: number;
  scaleY: number;
}

export function computeMotionPose(recipe: MotionRecipe, input: MotionPoseInput): MotionPose {
  const pulse = Math.sin(input.elapsedSeconds * recipe.pulseSpeed * Math.PI * 2) * recipe.pulseAmount;
  const stretch = Math.min(0.14, input.speed * 0.005) * recipe.speedStretch * 4;
  const squash = input.impact * recipe.impactSquash;
  return {
    scaleX: 1 + pulse + stretch - squash * 0.25,
    scaleY: 1 + pulse - stretch + squash
  };
}

export type SkillTelegraphStyle =
  | 'none'
  | 'directional-stream'
  | 'outward-rings'
  | 'inward-vortex'
  | 'tidal-gather'
  | 'fuse-charge'
  | 'rocket-charge'
  | 'warning-ring'
  | 'shrapnel-lock'
  | 'mega-danger'
  | 'reactor-charge';

export type SkillMotionStyle =
  | 'snap'
  | 'stream'
  | 'compress'
  | 'vortex'
  | 'gather'
  | 'fuse-pop'
  | 'rocket'
  | 'brace'
  | 'spin'
  | 'tremble'
  | 'overdrive';

export type SkillResolveStyle =
  | 'water-splash'
  | 'water-dash'
  | 'pressure-wave'
  | 'undertow'
  | 'tidal-cataclysm'
  | 'contact-pop'
  | 'rocket-burst'
  | 'concussion'
  | 'shrapnel'
  | 'mega-bomb'
  | 'magma-dash'
  | 'inferno-collapse'
  | 'kinetic-pulse'
  | 'reactor-overdrive'
  | 'solar-laser'
  | 'generic';

export interface SkillPresentationRecipe {
  abilityId: string;
  icon: string;
  shortName: string;
  color: number;
  accentColor: number;
  telegraph: SkillTelegraphStyle;
  motion: SkillMotionStyle;
  resolve: SkillResolveStyle;
  importance: 'basic' | 'skill' | 'ultimate';
  telegraphRadius: number;
}

const skillPresentationRecipes: Record<string, SkillPresentationRecipe> = {
  'magma-dash': {
    abilityId: 'magma-dash', icon: 'MD', shortName: 'Magma Dash', color: 0xff572f, accentColor: 0xffe18a,
    telegraph: 'directional-stream', motion: 'stream', resolve: 'magma-dash', importance: 'skill', telegraphRadius: 110
  },
  'inferno-collapse': {
    abilityId: 'inferno-collapse', icon: 'IC', shortName: 'Inferno Collapse', color: 0xff321f, accentColor: 0xffd75e,
    telegraph: 'mega-danger', motion: 'gather', resolve: 'inferno-collapse', importance: 'ultimate', telegraphRadius: 260
  },
  'kinetic-pulse': {
    abilityId: 'kinetic-pulse', icon: 'KP', shortName: 'Kinetic Pulse', color: 0x60d9ff, accentColor: 0xe3fbff,
    telegraph: 'outward-rings', motion: 'brace', resolve: 'kinetic-pulse', importance: 'skill', telegraphRadius: 220
  },
  'reactor-overdrive': {
    abilityId: 'reactor-overdrive', icon: 'RO', shortName: 'Reactor Overdrive', color: 0x5edcff, accentColor: 0xffffff,
    telegraph: 'reactor-charge', motion: 'overdrive', resolve: 'reactor-overdrive', importance: 'ultimate', telegraphRadius: 185
  },
  'riptide-contact': {
    abilityId: 'riptide-contact', icon: 'RI', shortName: 'Riptide', color: 0x36bfff, accentColor: 0xcffbff,
    telegraph: 'none', motion: 'snap', resolve: 'water-splash', importance: 'basic', telegraphRadius: 54
  },
  'surge-dash': {
    abilityId: 'surge-dash', icon: 'SD', shortName: 'Surge Dash', color: 0x27c9ff, accentColor: 0xe1fdff,
    telegraph: 'directional-stream', motion: 'stream', resolve: 'water-dash', importance: 'skill', telegraphRadius: 92
  },
  'pressure-wave': {
    abilityId: 'pressure-wave', icon: 'PW', shortName: 'Pressure Wave', color: 0x238de8, accentColor: 0xc7f8ff,
    telegraph: 'outward-rings', motion: 'compress', resolve: 'pressure-wave', importance: 'skill', telegraphRadius: 165
  },
  undertow: {
    abilityId: 'undertow', icon: 'UT', shortName: 'Undertow', color: 0x175fa8, accentColor: 0x7cecff,
    telegraph: 'inward-vortex', motion: 'vortex', resolve: 'undertow', importance: 'skill', telegraphRadius: 260
  },
  'tidal-cataclysm': {
    abilityId: 'tidal-cataclysm', icon: 'TC', shortName: 'Tidal Cataclysm', color: 0x41d9ff, accentColor: 0xffffff,
    telegraph: 'tidal-gather', motion: 'gather', resolve: 'tidal-cataclysm', importance: 'ultimate', telegraphRadius: 300
  },
  'blast-contact': {
    abilityId: 'blast-contact', icon: 'ID', shortName: 'Impact Detonator', color: 0xff8a36, accentColor: 0xfff0a8,
    telegraph: 'none', motion: 'fuse-pop', resolve: 'contact-pop', importance: 'basic', telegraphRadius: 105
  },
  'blast-dash': {
    abilityId: 'blast-dash', icon: 'BD', shortName: 'Blast Dash', color: 0xff7836, accentColor: 0xffef8a,
    telegraph: 'rocket-charge', motion: 'rocket', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 95
  },
  'concussion-bomb': {
    abilityId: 'concussion-bomb', icon: 'CB', shortName: 'Concussion Bomb', color: 0xffa23b, accentColor: 0xfff2b0,
    telegraph: 'warning-ring', motion: 'brace', resolve: 'concussion', importance: 'skill', telegraphRadius: 155
  },
  'shrapnel-burst': {
    abilityId: 'shrapnel-burst', icon: 'SB', shortName: 'Shrapnel Burst', color: 0xff6840, accentColor: 0xffd65c,
    telegraph: 'shrapnel-lock', motion: 'spin', resolve: 'shrapnel', importance: 'skill', telegraphRadius: 205
  },
  'mega-bomb': {
    abilityId: 'mega-bomb', icon: 'MB', shortName: 'MEGA BOMB', color: 0xff3d20, accentColor: 0xffef65,
    telegraph: 'mega-danger', motion: 'tremble', resolve: 'mega-bomb', importance: 'ultimate', telegraphRadius: 285
  },
  'ember-impact': { abilityId: 'ember-impact', icon: 'EI', shortName: 'Ember Impact', color: 0xff6b32, accentColor: 0xffe083, telegraph: 'none', motion: 'snap', resolve: 'contact-pop', importance: 'basic', telegraphRadius: 54 },
  'flame-ring': { abilityId: 'flame-ring', icon: 'FR', shortName: 'Flame Ring', color: 0xff4c22, accentColor: 0xffd45c, telegraph: 'outward-rings', motion: 'compress', resolve: 'inferno-collapse', importance: 'skill', telegraphRadius: 190 },
  'molten-guard': { abilityId: 'molten-guard', icon: 'MG', shortName: 'Molten Guard', color: 0xe64925, accentColor: 0xffe29d, telegraph: 'reactor-charge', motion: 'brace', resolve: 'reactor-overdrive', importance: 'skill', telegraphRadius: 145 },
  'steel-impact': { abilityId: 'steel-impact', icon: 'SI', shortName: 'Steel Impact', color: 0x91a9b8, accentColor: 0xe4fbff, telegraph: 'none', motion: 'snap', resolve: 'kinetic-pulse', importance: 'basic', telegraphRadius: 62 },
  'magnet-drag': { abilityId: 'magnet-drag', icon: 'MD', shortName: 'Magnet Drag', color: 0x54c9dc, accentColor: 0xf1ffff, telegraph: 'inward-vortex', motion: 'vortex', resolve: 'undertow', importance: 'skill', telegraphRadius: 255 },
  fortify: { abilityId: 'fortify', icon: 'FT', shortName: 'Fortify', color: 0x7193a6, accentColor: 0xd9fbff, telegraph: 'reactor-charge', motion: 'brace', resolve: 'reactor-overdrive', importance: 'skill', telegraphRadius: 160 },
  'frost-impact': { abilityId: 'frost-impact', icon: 'FI', shortName: 'Frost Impact', color: 0x9eeaff, accentColor: 0xffffff, telegraph: 'none', motion: 'snap', resolve: 'water-splash', importance: 'basic', telegraphRadius: 58 },
  'glacier-charge': { abilityId: 'glacier-charge', icon: 'GC', shortName: 'Glacier Charge', color: 0x69ccf3, accentColor: 0xeaffff, telegraph: 'directional-stream', motion: 'stream', resolve: 'magma-dash', importance: 'skill', telegraphRadius: 110 },
  'frost-nova': { abilityId: 'frost-nova', icon: 'FN', shortName: 'Frost Nova', color: 0x8adfff, accentColor: 0xffffff, telegraph: 'outward-rings', motion: 'compress', resolve: 'pressure-wave', importance: 'skill', telegraphRadius: 185 },
  'ice-anchor': { abilityId: 'ice-anchor', icon: 'IA', shortName: 'Ice Anchor', color: 0x5aa8d1, accentColor: 0xe9fdff, telegraph: 'reactor-charge', motion: 'brace', resolve: 'reactor-overdrive', importance: 'skill', telegraphRadius: 165 },
  'absolute-zero': { abilityId: 'absolute-zero', icon: 'AZ', shortName: 'Absolute Zero', color: 0x8deaff, accentColor: 0xffffff, telegraph: 'tidal-gather', motion: 'gather', resolve: 'tidal-cataclysm', importance: 'ultimate', telegraphRadius: 310 },
  'static-strike': { abilityId: 'static-strike', icon: 'SS', shortName: 'Static Strike', color: 0xfff45c, accentColor: 0xb9fbff, telegraph: 'none', motion: 'snap', resolve: 'contact-pop', importance: 'basic', telegraphRadius: 52 },
  'lightning-dash': { abilityId: 'lightning-dash', icon: 'LD', shortName: 'Lightning Dash', color: 0xffed44, accentColor: 0x75f5ff, telegraph: 'rocket-charge', motion: 'rocket', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 100 },
  'arc-burst': { abilityId: 'arc-burst', icon: 'AB', shortName: 'Arc Burst', color: 0x7aeaff, accentColor: 0xffffff, telegraph: 'outward-rings', motion: 'brace', resolve: 'kinetic-pulse', importance: 'skill', telegraphRadius: 175 },
  'polarity-pull': { abilityId: 'polarity-pull', icon: 'PP', shortName: 'Polarity Pull', color: 0xd9ec4a, accentColor: 0x78f5ff, telegraph: 'inward-vortex', motion: 'vortex', resolve: 'undertow', importance: 'skill', telegraphRadius: 255 },
  'thunder-dome': { abilityId: 'thunder-dome', icon: 'TD', shortName: 'Thunder Dome', color: 0xffec35, accentColor: 0xffffff, telegraph: 'reactor-charge', motion: 'overdrive', resolve: 'reactor-overdrive', importance: 'ultimate', telegraphRadius: 300 },
  'thorn-impact': { abilityId: 'thorn-impact', icon: 'TI', shortName: 'Thorn Impact', color: 0x7ecf55, accentColor: 0xe1ffa7, telegraph: 'none', motion: 'snap', resolve: 'contact-pop', importance: 'basic', telegraphRadius: 58 },
  'bramble-charge': { abilityId: 'bramble-charge', icon: 'BC', shortName: 'Bramble Charge', color: 0x5cac43, accentColor: 0xcfff85, telegraph: 'directional-stream', motion: 'stream', resolve: 'magma-dash', importance: 'skill', telegraphRadius: 118 },
  'seed-burst': { abilityId: 'seed-burst', icon: 'SB', shortName: 'Seed Burst', color: 0x84d45d, accentColor: 0xeaffb1, telegraph: 'shrapnel-lock', motion: 'spin', resolve: 'shrapnel', importance: 'skill', telegraphRadius: 195 },
  regenerate: { abilityId: 'regenerate', icon: 'RG', shortName: 'Regenerate', color: 0x4fb957, accentColor: 0xe8ffc2, telegraph: 'reactor-charge', motion: 'gather', resolve: 'reactor-overdrive', importance: 'skill', telegraphRadius: 155 },
  overgrowth: { abilityId: 'overgrowth', icon: 'OG', shortName: 'Overgrowth', color: 0x65c94d, accentColor: 0xf2ffb3, telegraph: 'tidal-gather', motion: 'gather', resolve: 'tidal-cataclysm', importance: 'ultimate', telegraphRadius: 315 },
  'phase-cut': { abilityId: 'phase-cut', icon: 'PC', shortName: 'Phase Cut', color: 0xaa68ff, accentColor: 0x75e9ff, telegraph: 'none', motion: 'snap', resolve: 'contact-pop', importance: 'basic', telegraphRadius: 54 },
  'phase-lunge': { abilityId: 'phase-lunge', icon: 'PL', shortName: 'Phase Lunge', color: 0x9252e8, accentColor: 0x67eaff, telegraph: 'directional-stream', motion: 'stream', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 105 },
  'gravity-well': { abilityId: 'gravity-well', icon: 'GW', shortName: 'Gravity Well', color: 0x7540c5, accentColor: 0x8cecff, telegraph: 'inward-vortex', motion: 'vortex', resolve: 'undertow', importance: 'skill', telegraphRadius: 270 },
  'void-burst': { abilityId: 'void-burst', icon: 'VB', shortName: 'Void Burst', color: 0x9a50ec, accentColor: 0xc5a3ff, telegraph: 'warning-ring', motion: 'compress', resolve: 'concussion', importance: 'skill', telegraphRadius: 195 },
  singularity: { abilityId: 'singularity', icon: 'SG', shortName: 'Singularity', color: 0x5e238f, accentColor: 0xb7eaff, telegraph: 'mega-danger', motion: 'tremble', resolve: 'inferno-collapse', importance: 'ultimate', telegraphRadius: 340 },
  'combat-roll': { abilityId: 'combat-roll', icon: 'CR', shortName: 'Combat Roll', color: 0x7edfff, accentColor: 0xffffff, telegraph: 'directional-stream', motion: 'stream', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 100 },
  'tactical-slide': { abilityId: 'tactical-slide', icon: 'TS', shortName: 'Tactical Slide', color: 0x7edfff, accentColor: 0xffffff, telegraph: 'directional-stream', motion: 'stream', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 130 },
  'suppressive-fire': { abilityId: 'suppressive-fire', icon: 'SB', shortName: 'Suppressive Burst', color: 0xffd56a, accentColor: 0xffffff, telegraph: 'directional-stream', motion: 'brace', resolve: 'shrapnel', importance: 'skill', telegraphRadius: 310 },
  'pinning-round': { abilityId: 'pinning-round', icon: 'PR', shortName: 'Pinning Round', color: 0x6ee6ff, accentColor: 0xffffff, telegraph: 'shrapnel-lock', motion: 'brace', resolve: 'concussion', importance: 'skill', telegraphRadius: 340 },
  'kill-zone': { abilityId: 'kill-zone', icon: 'KZ', shortName: 'Kill Zone', color: 0xff5664, accentColor: 0xfff1ad, telegraph: 'mega-danger', motion: 'overdrive', resolve: 'reactor-overdrive', importance: 'ultimate', telegraphRadius: 410 },
  'grenade-launcher': { abilityId: 'grenade-launcher', icon: 'GL', shortName: 'Grenade Launcher', color: 0xff934e, accentColor: 0xffec9b, telegraph: 'warning-ring', motion: 'fuse-pop', resolve: 'concussion', importance: 'skill', telegraphRadius: 210 },
  'overdrive-barrage': { abilityId: 'overdrive-barrage', icon: 'OB', shortName: 'Overdrive Barrage', color: 0xffdf74, accentColor: 0xffffff, telegraph: 'reactor-charge', motion: 'overdrive', resolve: 'reactor-overdrive', importance: 'ultimate', telegraphRadius: 320 },
  'rocket-salvo': { abilityId: 'rocket-salvo', icon: 'RS', shortName: 'Rocket Salvo', color: 0xffa33d, accentColor: 0xfff1a8, telegraph: 'directional-stream', motion: 'brace', resolve: 'shrapnel', importance: 'skill', telegraphRadius: 430 },
  'blast-jump': { abilityId: 'blast-jump', icon: 'BJ', shortName: 'Blast Jump', color: 0xff7138, accentColor: 0xffdf8c, telegraph: 'rocket-charge', motion: 'rocket', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 145 },
  'siege-marker': { abilityId: 'siege-marker', icon: 'SM', shortName: 'Siege Marker', color: 0xff8b36, accentColor: 0xfff0a3, telegraph: 'warning-ring', motion: 'brace', resolve: 'concussion', importance: 'skill', telegraphRadius: 250 },
  'starburst-convergence': { abilityId: 'starburst-convergence', icon: 'SC', shortName: 'Starburst Convergence', color: 0xff5a2a, accentColor: 0xffef83, telegraph: 'mega-danger', motion: 'tremble', resolve: 'mega-bomb', importance: 'ultimate', telegraphRadius: 380 },
  'solar-rush': { abilityId: 'solar-rush', icon: 'SR', shortName: 'Sky Rush', color: 0x4b9cff, accentColor: 0xffffff, telegraph: 'directional-stream', motion: 'rocket', resolve: 'rocket-burst', importance: 'skill', telegraphRadius: 190 },
  'thunder-clap': { abilityId: 'thunder-clap', icon: 'TC', shortName: 'Thunder Clap', color: 0x8dd8ff, accentColor: 0xffffff, telegraph: 'outward-rings', motion: 'brace', resolve: 'kinetic-pulse', importance: 'skill', telegraphRadius: 210 },
  'solar-aegis': { abilityId: 'solar-aegis', icon: 'SA', shortName: 'Solar Aegis', color: 0xffb34d, accentColor: 0xffffff, telegraph: 'reactor-charge', motion: 'overdrive', resolve: 'reactor-overdrive', importance: 'skill', telegraphRadius: 115 },
  'solar-laser': { abilityId: 'solar-laser', icon: 'SL', shortName: 'Solar Beam', color: 0xff3b2f, accentColor: 0xfff4c2, telegraph: 'directional-stream', motion: 'tremble', resolve: 'solar-laser', importance: 'ultimate', telegraphRadius: 900 }
};

const fallbackSkillPresentation: SkillPresentationRecipe = {
  abilityId: 'generic', icon: 'SK', shortName: 'Skill', color: 0xb994ff, accentColor: 0xffffff,
  telegraph: 'warning-ring', motion: 'compress', resolve: 'generic', importance: 'skill', telegraphRadius: 120
};

export function getSkillPresentation(abilityId: string): SkillPresentationRecipe {
  return skillPresentationRecipes[abilityId] ?? { ...fallbackSkillPresentation, abilityId };
}

export * from './vfx';
