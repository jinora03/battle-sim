import {
  getElementVfxPalette,
  getVfxQualityProfile,
  getWeaponVfxRecipe,
  resolveVfxQuality,
  resolveVisualRadius
} from '../packages/visual-engine/src/index';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const high = resolveVfxQuality({
  effects: true,
  particleScale: 1,
  reducedMotion: false,
  adaptiveQuality: true,
  performanceScale: 1,
  fighterCount: 8
});
const army = resolveVfxQuality({
  effects: true,
  particleScale: 0.8,
  reducedMotion: false,
  adaptiveQuality: true,
  performanceScale: 0.48,
  fighterCount: 80
});

assert(high.tier === 'high', 'Small healthy battles should use high VFX quality.');
assert(army.tier === 'low', 'Large constrained battles should use low VFX quality.');
assert(high.maxGroundMarks > army.maxGroundMarks, 'Ground-mark budget should scale with VFX quality.');
assert(resolveVisualRadius(100, 'high', 'ultimate') > 100, 'Ultimate visual radius should be allowed to exceed gameplay radius.');
assert(resolveVisualRadius(100, 'low', 'ambient') < 100, 'Low-quality ambient radius should be smaller than gameplay radius.');
assert(getWeaponVfxRecipe('arc-rifle').muzzleFlash, 'Arc Rifle should expose a muzzle flash recipe.');
assert(getWeaponVfxRecipe('steel-hammer').groundMark === 'crack', 'Steel Hammer should leave crack marks.');
assert(getElementVfxPalette('fire').accent !== getElementVfxPalette('ice').accent, 'Element palettes should remain visually distinct.');
assert(getVfxQualityProfile('medium').trailSamples < getVfxQualityProfile('high').trailSamples, 'Projectile trail budget should scale by quality.');

console.log(JSON.stringify({
  stage: 'v1.1-stage6',
  highTier: high.tier,
  armyTier: army.tier,
  highGroundMarks: high.maxGroundMarks,
  armyGroundMarks: army.maxGroundMarks,
  rifleTrail: getWeaponVfxRecipe('arc-rifle').trailShape,
  status: 'passed'
}, null, 2));
