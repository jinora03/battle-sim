import { PixiBattleRenderer } from '@kinetic/renderer-pixi';
import { LocalSimulationRunner } from '@kinetic/simulation';
import type { BattleDefinition } from '@kinetic/protocol';
import { getBroadcastLayout } from './broadcastLayout';
import { BroadcastFrameRenderer } from './broadcastRenderer';
import type { ReplayVideoExportSettings } from './types';

/**
 * Render one real creator/export frame for layout inspection without invoking
 * WebCodecs, audio synthesis, replay stepping, muxing, or download handling.
 */
export async function renderReplayLayoutPreview(
  battle: BattleDefinition,
  settings: ReplayVideoExportSettings
): Promise<Blob> {
  // Layout geometry is authored at the 1080p composition size. Keeping the
  // preview at that scale makes it fast even when the selected export is 4K.
  const layout = getBroadcastLayout(settings.layout);
  const previewSettings: ReplayVideoExportSettings = {
    ...settings,
    resolution: '1080p',
    width: layout.width,
    height: layout.height
  };

  const runner = new LocalSimulationRunner(structuredClone(battle));
  const snapshot = runner.getSnapshot();
  const broadcastRenderer = new BroadcastFrameRenderer(previewSettings, battle);
  const arenaSize = broadcastRenderer.layout.arena;
  const host = createPreviewHost(arenaSize.width, arenaSize.height);
  const renderer = new PixiBattleRenderer();

  try {
    renderer.setFixedOutputSize(arenaSize.width, arenaSize.height);
    await renderer.init(host, battle.arenaId, previewSettings.presentation);
    renderer.setActive(true);
    renderer.renderExportFrame(snapshot, [], 1000 / previewSettings.fps);

    const canvas = broadcastRenderer.render(renderer.getCanvas(), snapshot, [], {
      showResult: false,
      showCaptions: false
    });
    return await canvasToPng(canvas);
  } finally {
    try { renderer.setActive(false); } catch { /* preview cleanup is best effort */ }
    try { renderer.destroy(); } catch { /* preview cleanup is best effort */ }
    try { broadcastRenderer.destroy(); } catch { /* preview cleanup is best effort */ }
    host.remove();
  }
}

function createPreviewHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div');
  host.dataset.videoExportPreviewHost = 'true';
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    opacity: '0',
    pointerEvents: 'none',
    contain: 'strict',
    overflow: 'hidden'
  });
  document.body.appendChild(host);
  return host;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('The browser could not create the layout preview image.'));
    }, 'image/png');
  });
}
