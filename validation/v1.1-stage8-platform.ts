import {
  classifyViewport,
  createDefaultAppSettings,
  normalizeAppSettings,
  resolveCanvasResolution,
  toPresentationSettings,
  type DeviceCapabilities
} from '../packages/platform/src/index';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
  devicePixelRatio: 3
};

const portrait = classifyViewport(390, 844);
assert(portrait.orientation === 'portrait' && portrait.compact, 'Portrait phone classification failed.');
const landscape = classifyViewport(844, 390);
assert(landscape.orientation === 'landscape' && landscape.shortLandscape, 'Short landscape classification failed.');

const resolution = resolveCanvasResolution({
  devicePixelRatio: 3,
  maxDevicePixelRatio: 1.75,
  renderScale: 0.9,
  adaptiveScale: 1
});
assert(resolution.effectiveResolution === 1.58, 'Canvas resolution policy changed unexpectedly.');

const adaptiveResolution = resolveCanvasResolution({
  devicePixelRatio: 2,
  maxDevicePixelRatio: 2,
  renderScale: 0.72,
  adaptiveScale: 0.55
});
assert(adaptiveResolution.effectiveResolution >= 0.65, 'Adaptive resolution dropped below its safety floor.');

const defaults = createDefaultAppSettings(phone);
assert(defaults.schemaVersion === 5, 'Stage 8 settings schema is not active.');
assert(defaults.renderScale <= 0.9, 'Touch-first device did not receive a mobile render scale.');

const migrated = normalizeAppSettings({ schemaVersion: 4, qualityPreset: 'custom', targetRenderFps: 30 }, phone);
assert(migrated.schemaVersion === 5, 'Legacy settings did not migrate to v5.');
assert(toPresentationSettings(migrated).renderScale === migrated.renderScale, 'Render scale was not forwarded to presentation.');

console.log(JSON.stringify({
  stage: 'v1.1-stage8',
  portrait,
  landscape,
  resolution,
  adaptiveResolution,
  defaults: {
    renderScale: defaults.renderScale,
    maxDevicePixelRatio: defaults.maxDevicePixelRatio,
    targetRenderFps: defaults.targetRenderFps
  }
}, null, 2));
