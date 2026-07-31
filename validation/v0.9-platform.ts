import {
  applyQualityPreset,
  createDefaultAppSettings,
  normalizeAppSettings,
  recommendQualityPreset,
  toPresentationSettings,
  type DeviceCapabilities
} from '@kinetic/platform';

const desktop: DeviceCapabilities = {
  mobile: false,
  coarsePointer: false,
  anyCoarsePointer: false,
  hoverCapable: true,
  touchPoints: 0,
  touchFirst: false,
  reducedMotion: false,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
  saveData: false,
  devicePixelRatio: 2
};
const phone: DeviceCapabilities = {
  mobile: true,
  coarsePointer: true,
  anyCoarsePointer: true,
  hoverCapable: false,
  touchPoints: 5,
  touchFirst: true,
  reducedMotion: false,
  hardwareConcurrency: 4,
  deviceMemoryGb: 3,
  saveData: false,
  devicePixelRatio: 2.75
};

const high = recommendQualityPreset(desktop);
const low = recommendQualityPreset(phone);
if (high !== 'high') throw new Error(`Expected high desktop preset, received ${high}`);
if (low !== 'battery') throw new Error(`Expected battery phone preset, received ${low}`);
const defaults = createDefaultAppSettings(desktop);
const battery = applyQualityPreset({ ...defaults, highContrast: true }, 'battery', desktop);
if (battery.targetRenderFps !== 30 || battery.maxDevicePixelRatio !== 1 || !battery.highContrast) throw new Error('Battery preset did not preserve accessibility state.');
const migrated = normalizeAppSettings({ effects: false, audio: true, renderProfile: 'minimal' }, desktop);
if (migrated.schemaVersion !== 3 || migrated.effects || !migrated.audio || migrated.renderProfile !== 'minimal') throw new Error('Legacy settings migration failed.');
const presentation = toPresentationSettings({ ...defaults, reducedMotion: true, cameraShake: true, impactFreeze: true, screenFlash: true });
if (presentation.cameraShake || presentation.impactFreeze || presentation.screenFlash) throw new Error('Reduced motion did not disable motion-heavy presentation.');
console.log(JSON.stringify({ phase: '0.9-platform', desktopPreset: high, phonePreset: low, targetFps: battery.targetRenderFps, migratedSchema: migrated.schemaVersion, reducedMotionSafe: true }));
