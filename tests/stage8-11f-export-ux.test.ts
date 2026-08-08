import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createCinematicHighlightPlan,
  createStage810hExportSettings,
  type CinematicHighlightCandidate
} from '@kinetic/video-export';

describe('Stage 8.11F creator export UX and intro parity', () => {
  it('lets cinematic highlights be disabled without disabling cinematic camera framing', () => {
    const enabled = createStage810hExportSettings({}, {
      camera: 'cinematic',
      highlights: true,
      fps: 60
    });
    const disabled = createStage810hExportSettings({}, {
      camera: 'cinematic',
      highlights: false,
      fps: 60
    });

    expect(enabled.camera.mode).toBe('cinematic');
    expect(enabled.camera.highlightSlowMotionSeconds).toBeGreaterThan(0);
    expect(enabled.camera.maxHighlightSlowMotionMoments).toBeGreaterThan(0);
    expect(disabled.camera.mode).toBe('cinematic');
    expect(disabled.camera.highlightSlowMotionSeconds).toBe(0);
    expect(disabled.camera.maxHighlightSlowMotionMoments).toBe(0);

    const candidates: CinematicHighlightCandidate[] = [
      { tick: 180, kind: 'ultimate', score: 900, position: { x: 360, y: 480 } }
    ];
    expect(createCinematicHighlightPlan(candidates, 900, disabled.camera, disabled.fps).moments).toEqual([]);
  });

  it('keeps highlights unavailable in arena-wide camera mode even when requested', () => {
    const settings = createStage810hExportSettings({}, {
      camera: 'broadcast',
      highlights: true
    });
    expect(settings.camera.mode).toBe('broadcast');
    expect(settings.camera.highlightSlowMotionSeconds).toBe(0);
    expect(settings.camera.maxHighlightSlowMotionMoments).toBe(0);
  });

  it('reports encoder flush/finalization separately from rendering and browser download handoff', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const types = readFileSync(new URL('../packages/video-export/src/types.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(types).toContain("'finalizing'");
    expect(types).toContain("'downloading'");
    expect(exporter).toContain('Video encoder flush failed while finalizing the exported video.');
    expect(exporter).toContain('Audio encoder flush failed while finalizing deterministic replay audio.');
    expect(exporter).toContain('Container finalization failed.');
    expect(panel).toContain('Flushing encoder buffers…');
    expect(panel).toContain('Sending to browser…');
  });

  it('keeps a completed single export available for manual or automatic download', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(hook).toContain("AUTO_DOWNLOAD_STORAGE_KEY = 'kinetic.replay-video.auto-download.v1'");
    expect(hook).toContain("status: 'ready'");
    expect(hook).toContain("phase: 'downloading'");
    expect(hook).toContain('directFilesRef.current = files');
    expect(hook).toContain('downloadLatestThumbnail');
    expect(hook).toContain('60_000');
    expect(panel).toContain('Auto download');
    expect(panel).toContain('Download video');
    expect(panel).toContain('Download thumbnail');
    expect(panel).toContain('Queue downloads always stay manual');
  });

  it('uses the normal battle Match Prepared / VS presentation as the export intro visual source', () => {
    const liveIntro = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const liveCss = readFileSync(new URL('../apps/game/src/styles/60-battle-intro.css', import.meta.url), 'utf8');
    const exportIntro = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');

    expect(liveIntro).toContain("'Match prepared'");
    expect(liveIntro).toContain('battle-intro-versus');
    expect(liveCss).toContain('battle-intro-enter-left');
    expect(liveCss).toContain('battle-intro-versus-pop');

    expect(exportIntro).toContain("'MATCH PREPARED'");
    expect(exportIntro).toContain("'VS'");
    expect(exportIntro).toContain("'BATTLE START'");
    expect(exportIntro).toContain('fighterProgress');
    expect(exportIntro).toContain('versusProgress');
    expect(exportIntro).toContain('drawIntroPortrait');
    expect(exportIntro).toContain('drawBroadcastFighterPortrait');
  });

  it('keeps the export intro deterministic and driven only by fixed frame progress', () => {
    const exportIntro = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');
    expect(exportIntro).toContain('progress: number');
    expect(exportIntro).toContain('Math.sin(progress * Math.PI');
    expect(exportIntro).not.toContain('Math.random(');
    expect(exportIntro).not.toContain('Date.now(');
  });
});
