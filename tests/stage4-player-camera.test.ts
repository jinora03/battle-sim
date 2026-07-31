import { describe, expect, it } from 'vitest';
import { shouldShowTouchControls, type DeviceCapabilities } from '@kinetic/platform';
import { calculateArenaFit, calculateCameraTarget } from '../packages/renderer-pixi/src/camera';

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
  hardwareConcurrency: 6,
  deviceMemoryGb: 6,
  saveData: false,
  devicePixelRatio: 3
};

describe('v1.1 Stage 4 player controls and camera fit', () => {
  it('centers small, medium and large arenas in the viewport', () => {
    const arenaSizes: Array<readonly [number, number]> = [[720, 720], [1100, 760], [1800, 1050]];
    for (const [width, height] of arenaSizes) {
      const fit = calculateArenaFit(1280, 720, width, height);
      expect(fit.x + width * fit.scale / 2).toBeCloseTo(640, 5);
      expect(fit.y + height * fit.scale / 2).toBeCloseTo(360, 5);
      expect(fit.scale).toBeGreaterThan(0);
    }
  });

  it('keeps a followed player inside camera bounds', () => {
    const fit = calculateArenaFit(1000, 600, 1600, 900);
    const target = calculateCameraTarget({
      viewportWidth: 1000,
      viewportHeight: 600,
      arenaWidth: 1600,
      arenaHeight: 900,
      baseScale: fit.scale,
      focus: { x: 1550, y: 860 },
      follow: true,
      reducedMotion: false
    });
    expect(target.x).toBeLessThanOrEqual(12);
    expect(target.x).toBeGreaterThanOrEqual(1000 - 1600 * target.scale - 12);
    expect(target.y).toBeLessThanOrEqual(12);
    expect(target.y).toBeGreaterThanOrEqual(600 - 900 * target.scale - 12);
  });

  it('returns to exact centered fit when follow is disabled', () => {
    const fit = calculateArenaFit(900, 700, 1200, 800);
    const target = calculateCameraTarget({
      viewportWidth: 900,
      viewportHeight: 700,
      arenaWidth: 1200,
      arenaHeight: 800,
      baseScale: fit.scale,
      focus: { x: 100, y: 100 },
      follow: false,
      reducedMotion: false
    });
    expect(target).toEqual(fit);
  });

  it('shows touch controls automatically only on touch-first devices', () => {
    expect(shouldShowTouchControls('auto', desktop)).toBe(false);
    expect(shouldShowTouchControls('auto', phone)).toBe(true);
    expect(shouldShowTouchControls('always', desktop)).toBe(true);
    expect(shouldShowTouchControls('never', phone)).toBe(false);
  });
});
