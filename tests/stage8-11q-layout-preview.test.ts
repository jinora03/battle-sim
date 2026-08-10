import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stage 8.11Q creator layout preview', () => {
  it('renders one real broadcast frame without invoking video/audio encoding', () => {
    const source = readFileSync(new URL('../packages/video-export/src/replayLayoutPreview.ts', import.meta.url), 'utf8');

    expect(source).toContain('new LocalSimulationRunner');
    expect(source).toContain('new BroadcastFrameRenderer');
    expect(source).toContain('new PixiBattleRenderer');
    expect(source).toContain('renderer.renderExportFrame(snapshot, [],');
    expect(source).toContain('broadcastRenderer.render(renderer.getCanvas(), snapshot, []');
    expect(source).toContain("canvas.toBlob");
    expect(source).not.toContain('createExportMediaPipeline');
    expect(source).not.toContain('renderRuntimeReplayAudio');
    expect(source).not.toContain('encodeVideo');
    expect(source).not.toContain('encodeAudio');
  });

  it('exposes an inline refreshable header crop in the export panel', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/77-video-export.css', import.meta.url), 'utf8');

    expect(panel).toContain('Preview layout');
    expect(panel).toContain('Refresh preview');
    expect(panel).toContain('Open full frame');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).not.toContain('target="_blank"');
    expect(panel).toContain('video-export-layout-preview-crop');
    expect(styles).toContain('aspect-ratio: 1080 / 340');
  });
});
