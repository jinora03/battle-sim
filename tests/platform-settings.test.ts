import { describe, expect, it } from 'vitest';
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

const budgetPhone: DeviceCapabilities = {
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

describe('v0.9 platform and settings', () => {
  it('recommends high quality on capable desktop hardware', () => {
    expect(recommendQualityPreset(desktop)).toBe('high');
  });

  it('recommends battery saver for constrained mobile hardware', () => {
    expect(recommendQualityPreset(budgetPhone)).toBe('battery');
  });

  it('applies presets without losing accessibility preferences', () => {
    const initial = { ...createDefaultAppSettings(desktop), highContrast: true, largeTouchControls: true };
    const next = applyQualityPreset(initial, 'battery', desktop);
    expect(next.targetRenderFps).toBe(30);
    expect(next.maxDevicePixelRatio).toBe(1.25);
    expect(next.renderScale).toBe(0.72);
    expect(next.highContrast).toBe(true);
    expect(next.largeTouchControls).toBe(true);
  });

  it('migrates partial legacy settings into the v9 schema', () => {
    const migrated = normalizeAppSettings({ effects: false, audio: true, renderProfile: 'minimal' }, desktop);
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.effects).toBe(false);
    expect(migrated.audio).toBe(true);
    expect(migrated.renderProfile).toBe('minimal');
    expect(migrated.arenaBackground).toBe(true);
    expect(migrated.particleScale).toBeGreaterThanOrEqual(0);
    expect(migrated.showMountedAttachments).toBe(true);
    expect(migrated.showFighterHealthRings).toBe(true);
    expect(migrated.showDamageNumbers).toBe(true);
    expect(migrated.showBattleIntros).toBe(true);
  });

  it('preserves disabled fighter readability overlays and forwards them to the renderer', () => {
    const migrated = normalizeAppSettings({
      schemaVersion: 6,
      showMountedAttachments: false,
      showFighterHealthRings: false,
      showDamageNumbers: false,
      showBattleIntros: false
    }, desktop);
    const presentation = toPresentationSettings(migrated);
    expect(migrated.showMountedAttachments).toBe(false);
    expect(migrated.showFighterHealthRings).toBe(false);
    expect(migrated.showDamageNumbers).toBe(false);
    expect(migrated.showBattleIntros).toBe(false);
    expect(presentation.showMountedAttachments).toBe(false);
    expect(presentation.showFighterHealthRings).toBe(false);
    expect(presentation.showDamageNumbers).toBe(false);
  });

  it('forces motion-heavy presentation features off in reduced-motion mode', () => {
    const settings = { ...createDefaultAppSettings(desktop), reducedMotion: true, cameraShake: true, impactFreeze: true, screenFlash: true };
    const presentation = toPresentationSettings(settings);
    expect(presentation.cameraShake).toBe(false);
    expect(presentation.impactFreeze).toBe(false);
    expect(presentation.screenFlash).toBe(false);
    expect(presentation.arenaBackground).toBe(settings.arenaBackground);
  });
});
