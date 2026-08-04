import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createDefaultAppSettings,
  normalizeAppSettings,
  type DeviceCapabilities
} from '@kinetic/platform';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const touchPhone: DeviceCapabilities = {
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

describe('Stage 8.8A mobile controls and renderer stability', () => {
  it('defaults shared player control preferences to mouse steering with camera follow disabled', () => {
    const defaults = createDefaultAppSettings(touchPhone);
    expect(defaults.schemaVersion).toBe(10);
    expect(defaults.movementMode).toBe('mouse');
    expect(defaults.cameraFollow).toBe(false);
    expect(defaults.touchControlOpacity).toBe(0.75);

    expect(normalizeAppSettings({ touchControlOpacity: 0.1 }, touchPhone).touchControlOpacity).toBe(0.3);
    expect(normalizeAppSettings({ touchControlOpacity: 1.5 }, touchPhone).touchControlOpacity).toBe(1);
  });

  it('removes the duplicate desktop command panel on touch-first devices while retaining the compact dock', () => {
    const source = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');
    expect(source).toContain("deviceCapabilities.touchFirst ? 'mobile-commandless' : ''");
    expect(source).toContain('!deviceCapabilities.touchFirst && (');
    expect(source).toContain('deviceCapabilities.touchFirst && (');
    expect(source).toContain('className="mobile-battle-dock"');
    expect(source).toContain("'--touch-control-opacity': settings.touchControlOpacity");
  });

  it('shares mouse steering and approved trainer modules with Ability Lab', () => {
    const viewSource = readFileSync(new URL('../apps/game/src/TrainingLabView.tsx', import.meta.url), 'utf8');
    const runtimeSource = readFileSync(new URL('../apps/game/src/runtime/TrainingRuntime.ts', import.meta.url), 'utf8');
    expect(viewSource).toContain('<option value="mouse">Mouse move + aim</option>');
    expect(viewSource).toContain('TrainingModuleSelectors');
    expect(viewSource).toContain('setPlayerMouseDriveFromClient');
    expect(runtimeSource).toContain('trainerModuleIds: string[]');
    expect(runtimeSource).toContain('loadout: { moduleIds: [...this.setup.trainerModuleIds] }');
  });

  it('recovers renderer sizing after mobile viewport and orientation changes', () => {
    const lifecycleSource = readFileSync(new URL('../packages/renderer-pixi/src/runtime/RendererLifecycle.ts', import.meta.url), 'utf8');
    const hookSource = readFileSync(new URL('../apps/game/src/hooks/useBattleRuntime.ts', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles.css', import.meta.url), 'utf8');
    expect(lifecycleSource).toContain('refreshLayout(): void');
    expect(lifecycleSource).toContain('this.resizeObserver.observe(host);');
    expect(lifecycleSource).toContain('this.ensureCanvasMounted();');
    expect(hookSource).toContain("window.visualViewport?.addEventListener('resize', refresh");
    expect(styles).toContain("html[data-short-landscape='true'][data-touch-first='true'] body { overflow-x: hidden; overflow-y: auto; }");
    expect(styles).toContain('.battle-stage.mobile-commandless');
    expect(styles).toContain('var(--touch-control-opacity, .75)');
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.21-stage8.8a');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
