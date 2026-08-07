import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { getBroadcastLayout, type BroadcastLayoutDefinition } from './broadcastLayout';
import { BroadcastSceneTracker } from './broadcastScene';
import { drawBroadcastBackground } from './renderers/canvasPrimitives';
import { drawLandscapeBroadcast } from './renderers/landscapeBroadcastRenderer';
import { drawVerticalBroadcast } from './renderers/verticalBroadcastRenderer';
import type { ReplayVideoExportSettings } from './types';

export class BroadcastFrameRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly layout: BroadcastLayoutDefinition;

  private readonly context: CanvasRenderingContext2D;
  private readonly sceneTracker: BroadcastSceneTracker;
  private readonly compositionLayout: BroadcastLayoutDefinition;
  private readonly outputScale: number;

  constructor(settings: ReplayVideoExportSettings, battle: BattleDefinition) {
    this.outputScale = settings.resolution === '4k' ? 2 : 1;
    this.compositionLayout = getBroadcastLayout(settings.layout);
    this.layout = getBroadcastLayout(settings.layout, this.outputScale);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.layout.width;
    this.canvas.height = this.layout.height;
    this.canvas.dataset.broadcastLayout = this.layout.id;
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The browser could not create the broadcast composition canvas.');
    this.context = context;
    this.sceneTracker = new BroadcastSceneTracker(battle);
  }

  render(
    arenaCanvas: HTMLCanvasElement,
    snapshot: WorldSnapshot,
    events: readonly SimulationEvent[]
  ): HTMLCanvasElement {
    const scene = this.sceneTracker.update(snapshot, events);
    drawBroadcastBackground(this.context, this.canvas, this.layout);
    this.context.save();
    this.context.scale(this.outputScale, this.outputScale);
    if (this.compositionLayout.id === 'vertical') {
      drawVerticalBroadcast(this.context, this.compositionLayout, scene, arenaCanvas);
    } else {
      drawLandscapeBroadcast(this.context, this.compositionLayout, scene, arenaCanvas);
    }
    this.context.restore();
    return this.canvas;
  }

  destroy(): void {
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
