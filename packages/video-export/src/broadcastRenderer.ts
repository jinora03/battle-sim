import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { getBroadcastLayout, type BroadcastLayoutDefinition } from './broadcastLayout';
import {
  CinematicCameraTracker,
  type CinematicCameraRenderOptions
} from './cinematicCamera';
import { BroadcastSceneTracker } from './broadcastScene';
import { drawBroadcastBackground } from './renderers/canvasPrimitives';
import { drawLandscapeBroadcast } from './renderers/landscapeBroadcastRenderer';
import { drawVerticalBroadcast } from './renderers/verticalBroadcastRenderer';
import { drawCreatorCard, type CreatorCardRenderOptions } from './renderers/creatorCards';
import type { ReplayVideoExportSettings } from './types';

export interface BroadcastRenderOptions extends CinematicCameraRenderOptions {
  showResult?: boolean;
  showCaptions?: boolean;
  creatorCard?: CreatorCardRenderOptions;
}

export class BroadcastFrameRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly layout: BroadcastLayoutDefinition;

  private readonly context: CanvasRenderingContext2D;
  private readonly sceneTracker: BroadcastSceneTracker;
  private readonly compositionLayout: BroadcastLayoutDefinition;
  private readonly outputScale: number;
  private readonly cameraTracker: CinematicCameraTracker;

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
    this.cameraTracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
  }

  render(
    arenaCanvas: HTMLCanvasElement,
    snapshot: WorldSnapshot,
    events: readonly SimulationEvent[],
    options: BroadcastRenderOptions = {}
  ): HTMLCanvasElement {
    const trackedScene = this.sceneTracker.update(snapshot, events);
    const creatorSummaryVisible = options.creatorCard?.kind === 'summary';
    const scene = {
      ...trackedScene,
      ...((options.showResult === false || creatorSummaryVisible) ? { resultCallout: null } : {}),
      ...(options.showCaptions === false ? { abilityCallout: null, eventCallout: null } : {})
    };
    const cameraFrame = this.cameraTracker.update(arenaCanvas, snapshot, events, options);
    drawBroadcastBackground(this.context, this.canvas, this.layout);
    this.context.save();
    this.context.scale(this.outputScale, this.outputScale);
    if (this.compositionLayout.id === 'vertical') {
      drawVerticalBroadcast(this.context, this.compositionLayout, scene, arenaCanvas, cameraFrame);
    } else {
      drawLandscapeBroadcast(this.context, this.compositionLayout, scene, arenaCanvas, cameraFrame);
    }
    if (options.creatorCard) {
      drawCreatorCard(this.context, this.compositionLayout, scene, options.creatorCard);
    }
    this.context.restore();
    return this.canvas;
  }

  destroy(): void {
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
