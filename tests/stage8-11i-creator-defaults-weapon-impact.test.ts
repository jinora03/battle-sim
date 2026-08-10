import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SimulationEvent } from '@kinetic/protocol';
import {
  CINEMATIC_HIGHLIGHT_MERGE_TICKS,
  CINEMATIC_HIGHLIGHT_PLAYBACK_RATE,
  coalesceImpactCandidates,
  createCinematicHighlightPlan,
  createStage810hExportSettings,
  resolveWeaponPreviewDefinition,
  scoreCreatorHighlightEvent
} from '@kinetic/video-export';

describe('creator defaults, weapon HUD and impact-based highlights', () => {
  it('uses the new fresh creator defaults without changing unrelated export quality settings', () => {
    const settings = createStage810hExportSettings();

    expect(settings).toMatchObject({
      layout: 'vertical',
      resolution: '1080p',
      fps: 60,
      quality: 'high',
      format: 'auto',
      camera: { mode: 'cinematic', shakeEnabled: true },
      audio: { enabled: true },
      creator: {
        preset: 'youtube',
        introSeconds: 0,
        thumbnailEnabled: false,
        captionsEnabled: true,
        fighterNameplatesEnabled: true
      },
      presentation: { screenFlash: true }
    });
    expect(settings.camera.maxHighlightSlowMotionMoments).toBe(0);
    expect(settings.camera.highlightSlowMotionSeconds).toBe(0);
  });

  it('keeps fresh UI defaults aligned and preserves explicit auto-download storage', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(hook).toContain("useState<BroadcastLayoutId>('vertical')");
    expect(hook).toContain("useState<CreatorExportPresetId>('custom')");
    expect(hook).toContain('const [introEnabled, setIntroEnabledState] = useState(false);');
    expect(hook).toContain('const [highlightsEnabled, setHighlightsEnabledState] = useState(false);');
    expect(hook).toContain('const [thumbnailEnabled, setThumbnailEnabledState] = useState(false);');
    expect(hook).toContain("window.localStorage.getItem(AUTO_DOWNLOAD_STORAGE_KEY) === 'on'");
    expect(hook).toContain("window.localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, enabled ? 'on' : 'off')");
  });

  it('resolves actual KBE primary-attack visuals for Pyro and Bomber with safe fallback', () => {
    expect(resolveWeaponPreviewDefinition('flame-fists')).toMatchObject({
      id: 'flame-fists',
      name: 'Flame Jet',
      form: 'fire'
    });
    expect(resolveWeaponPreviewDefinition('demolition-bomb')).toMatchObject({
      id: 'demolition-bomb',
      name: 'Impact Bomb',
      form: 'launcher'
    });
    expect(resolveWeaponPreviewDefinition('not-a-real-weapon')).toBeNull();

    const hud = readFileSync(new URL('../packages/video-export/src/renderers/fighterHud.ts', import.meta.url), 'utf8');
    const vertical = readFileSync(new URL('../packages/video-export/src/renderers/verticalBroadcastRenderer.ts', import.meta.url), 'utf8');
    const preview = readFileSync(new URL('../packages/video-export/src/renderers/weaponPreview.ts', import.meta.url), 'utf8');
    expect(hud).toContain('drawVerticalWeaponBlock(');
    expect(hud).toContain('drawLandscapeWeaponBlock(');
    expect(hud).toContain('const previewSize = 92;');
    expect(hud).toContain('const previewSize = 46;');
    expect(hud).toContain('const weaponColumnWidth = fighter.memberCount > 1 ? 0 : 168;');
    expect(hud).toContain('rect.y + 150');
    expect(hud).toContain('const labelY = rect.y + 138;');
    expect(hud).toContain('previewSize, accent, 0.88');
    expect(hud).toContain('rect.y + 74');
    expect(hud).toContain('rect.y + 120');
    expect(hud).toContain('const weaponColumnWidth = 168;');
    expect(hud).toContain('rect.x + padding + weaponColumnWidth / 2');
    expect(hud).toContain('rect.x + rect.width - padding - weaponColumnWidth / 2');
    expect(preview).toContain('contentScale = 0.78');
    expect(preview).toContain('ctx.scale(contentScale, contentScale);');
    expect(hud).toContain('drawWeaponPreview(');
    expect(hud).not.toContain('drawWeaponRow(');
    expect(hud).not.toContain("drawText(ctx, 'WEAPON'");
    expect(vertical).toContain('{ x: 16, y: 112, width: 492, height: 200 }');
    expect(vertical).toContain('{ x: 572, y: 112, width: 492, height: 200 }');
    expect(vertical).toContain("drawText(ctx, 'VS', 540, 212");
    expect(preview).toContain("visualId.includes('rocket')");
    expect(preview).toContain("form === 'fire'");
    expect(preview).toContain("form === 'rifle'");
    expect(preview).toContain('previewCanvasCache');
    expect(preview).not.toContain('new Image(');
    expect(preview).not.toContain('fetch(');
  });

  it('does not score ultimate activation and scores only confirmed positive damage as an impact', () => {
    const ultimate: SimulationEvent = {
      type: 'abilityActivated', tick: 100, entityId: 1, abilityId: 'inferno-drive', slot: 'ultimate',
      position: { x: 200, y: 300 }, direction: { x: 1, y: 0 }, castTicks: 45
    };
    const prevented: SimulationEvent = {
      type: 'damage', tick: 120, sourceId: 1, targetId: 2, amount: 120, element: 'fire', hpAfter: 500,
      prevented: true, position: { x: 400, y: 300 }
    };
    const hit: SimulationEvent = {
      ...prevented, tick: 140, prevented: false, amount: 180, hpAfter: 320
    };

    expect(scoreCreatorHighlightEvent(ultimate)).toBeNull();
    expect(scoreCreatorHighlightEvent(prevented)).toBeNull();
    expect(scoreCreatorHighlightEvent(hit)).toMatchObject({ tick: 140, kind: 'heavy-hit' });
  });

  it('merges simultaneous impacts and uses a single 0.5x slow-motion moment', () => {
    const settings = createStage810hExportSettings({}, { highlights: true, camera: 'cinematic' });
    const merged = coalesceImpactCandidates([
      { tick: 200, kind: 'heavy-hit', score: 820, position: { x: 240, y: 480 } },
      { tick: 214, kind: 'heavy-hit', score: 980, position: { x: 600, y: 480 } },
      { tick: 219, kind: 'heavy-hit', score: 760, position: { x: 580, y: 475 } }
    ]);

    expect(CINEMATIC_HIGHLIGHT_MERGE_TICKS).toBe(18);
    expect(CINEMATIC_HIGHLIGHT_PLAYBACK_RATE).toBe(0.5);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.tick).toBe(214);

    const plan = createCinematicHighlightPlan(merged, 900, settings.camera, settings.fps);
    expect(plan.moments).toHaveLength(1);
    expect(plan.moments[0]?.slowMotionStartTick).not.toBeNull();
    expect(plan.moments[0]?.slowMotionEndTick).not.toBeNull();
  });
});
