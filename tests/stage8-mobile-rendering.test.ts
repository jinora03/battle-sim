import { describe, expect, it } from 'vitest';
import {
  classifyViewport,
  createDefaultAppSettings,
  normalizeAppSettings,
  resolveCanvasResolution,
  toPresentationSettings,
  type DeviceCapabilities
} from '@kinetic/platform';

const phone: DeviceCapabilities = {
  mobile: true,
  coarsePointer: true,
  anyCoarsePointer: true,
  hoverCapable: false,
  touchPoints: 5,
  touchFirst: true,
  reducedMotion: false,
  hardwareConcurrency: 6,
  deviceMemoryGb: 6,
  saveData: false,
  devicePixelRatio: 3
};

describe('v1.1 Stage 8 mobile rendering policy', () => {
  it('classifies portrait, compact and short-landscape viewports deterministically', () => {
    expect(classifyViewport(390, 844)).toEqual({
      orientation: 'portrait',
      viewportClass: 'compact',
      displayShape: 'rectangular',
      compact: true,
      shortLandscape: false
    });
    expect(classifyViewport(844, 390)).toEqual({
      orientation: 'landscape',
      viewportClass: 'medium',
      displayShape: 'rectangular',
      compact: true,
      shortLandscape: true
    });
    expect(classifyViewport(1440, 900)).toEqual({
      orientation: 'landscape',
      viewportClass: 'wide',
      displayShape: 'rectangular',
      compact: false,
      shortLandscape: false
    });
  });

  it('caps device pixel ratio and applies internal render scaling', () => {
    const resolved = resolveCanvasResolution({
      devicePixelRatio: 3,
      maxDevicePixelRatio: 1.75,
      renderScale: 0.9,
      adaptiveScale: 1
    });
    expect(resolved.cappedDevicePixelRatio).toBe(1.75);
    expect(resolved.effectiveResolution).toBe(1.58);
  });

  it('reduces internal resolution under adaptive pressure without collapsing below the safety floor', () => {
    const reduced = resolveCanvasResolution({
      devicePixelRatio: 2,
      maxDevicePixelRatio: 2,
      renderScale: 0.72,
      adaptiveScale: 0.55
    });
    expect(reduced.effectiveResolution).toBeGreaterThanOrEqual(0.65);
    expect(reduced.effectiveResolution).toBeLessThan(1);
  });

  it('migrates v4 settings and forwards render scale into presentation settings', () => {
    const migrated = normalizeAppSettings({
      schemaVersion: 4,
      qualityPreset: 'custom',
      maxDevicePixelRatio: 2,
      targetRenderFps: 30,
      effects: true
    }, phone);
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.renderScale).toBeGreaterThanOrEqual(0.5);
    const presentation = toPresentationSettings(migrated);
    expect(presentation.renderScale).toBe(migrated.renderScale);
    expect(presentation.targetRenderFps).toBe(30);
  });

  it('uses a lower-resolution automatic profile for touch-first mobile devices', () => {
    const defaults = createDefaultAppSettings(phone);
    expect(defaults.qualityPreset).toBe('auto');
    expect(defaults.renderScale).toBeLessThanOrEqual(0.9);
    expect(defaults.maxDevicePixelRatio).toBeLessThan(phone.devicePixelRatio);
    expect(defaults.movementMode).toBe('mouse');
    expect(defaults.cameraFollow).toBe(false);
    expect(defaults.touchControlOpacity).toBe(0.75);
  });
});
