import { getArena } from '@kinetic/content';
import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { getBroadcastLayout, type BroadcastLayoutDefinition } from './broadcastLayout';
import {
  CinematicCameraTracker,
  type BroadcastCameraFrame,
  type CinematicCameraRenderOptions
} from './cinematicCamera';
import { BroadcastSceneTracker, resolveBroadcastFighterName } from './broadcastScene';
import { resolveCreatorDisplayName } from './creatorMatchupHook';
import { drawBroadcastBackground } from './renderers/canvasPrimitives';
import { drawLandscapeBroadcast } from './renderers/landscapeBroadcastRenderer';
import { drawVerticalBroadcast } from './renderers/verticalBroadcastRenderer';
import { drawCreatorCard, type CreatorCardRenderOptions } from './renderers/creatorCards';
import { drawFighterNameplates, shouldShowFighterNameplates } from './renderers/fighterNameplates';
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
  private readonly arena: ReturnType<typeof getArena>;
  private readonly fighterNameplates: ReadonlyMap<string, string>;
  private readonly verticalFighterScaleTarget: number;
  private readonly cameraMaxZoom: number;

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
    this.arena = getArena(battle.arenaId);
    this.fighterNameplates = settings.creator.fighterNameplatesEnabled && shouldShowFighterNameplates(battle.participants.length)
      ? new Map(battle.participants.map((participant) => {
          const authoredName = resolveBroadcastFighterName(participant.fighterId);
          return [
            participant.fighterId,
            settings.layout === 'vertical'
              ? resolveCreatorDisplayName(participant.fighterId, authoredName)
              : authoredName
          ] as const;
        }))
      : new Map();
    this.verticalFighterScaleTarget = settings.layout === 'vertical'
      && settings.camera.mode === 'cinematic'
      && battle.participants.length <= 4
      ? 1.15
      : 1;
    this.cameraMaxZoom = settings.camera.maxZoom;
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
    const trackedCameraFrame = this.cameraTracker.update(arenaCanvas, snapshot, events, options);
    const cameraFrame = this.applyVerticalFighterScale(trackedCameraFrame, arenaCanvas);
    drawBroadcastBackground(this.context, this.canvas, this.layout);
    this.context.save();
    this.context.scale(this.outputScale, this.outputScale);
    if (this.compositionLayout.id === 'vertical') {
      drawVerticalBroadcast(this.context, this.compositionLayout, scene, arenaCanvas, cameraFrame);
    } else {
      drawLandscapeBroadcast(this.context, this.compositionLayout, scene, arenaCanvas, cameraFrame);
    }
    if (!scene.resultCallout) {
      drawFighterNameplates(
        this.context,
        snapshot,
        this.arena,
        arenaCanvas,
        this.compositionLayout.arena,
        cameraFrame,
        this.fighterNameplates,
        this.compositionLayout.id === 'vertical'
      );
    }
    if (options.creatorCard) {
      drawCreatorCard(this.context, this.compositionLayout, scene, options.creatorCard);
    }
    this.context.restore();
    return this.canvas;
  }

  private applyVerticalFighterScale(
    frame: BroadcastCameraFrame,
    arenaCanvas: HTMLCanvasElement
  ): BroadcastCameraFrame {
    if (this.verticalFighterScaleTarget <= 1 || frame.phase === 'intro' || frame.phase === 'result') return frame;

    // The taller vertical arena already increases apparent fighter size on
    // portrait-shaped arenas such as Iron Pit. Only add the remaining amount
    // needed to approach the 15% target on squarer arenas, and never exceed the
    // existing cinematic max zoom.
    const width = Math.max(1, arenaCanvas.width);
    const height = Math.max(1, arenaCanvas.height);
    const oldSquareFit = Math.min(width / Math.max(1, this.arena.width), width / Math.max(1, this.arena.height));
    const currentFit = Math.min(width / Math.max(1, this.arena.width), height / Math.max(1, this.arena.height));
    const layoutScaleGain = oldSquareFit > 0 ? Math.max(1, currentFit / oldSquareFit) : 1;
    const remainingScale = Math.max(1, this.verticalFighterScaleTarget / layoutScaleGain);
    const zoomHeadroom = Math.max(1, this.cameraMaxZoom / Math.max(1, frame.zoom));
    const scale = Math.min(remainingScale, zoomHeadroom);
    if (scale <= 1.001) return frame;

    const sourceWidth = frame.source.width / scale;
    const sourceHeight = frame.source.height / scale;
    const centerX = frame.source.x + frame.source.width / 2;
    const centerY = frame.source.y + frame.source.height / 2;
    const x = Math.min(width - sourceWidth, Math.max(0, centerX - sourceWidth / 2));
    const y = Math.min(height - sourceHeight, Math.max(0, centerY - sourceHeight / 2));
    return {
      ...frame,
      source: { x, y, width: sourceWidth, height: sourceHeight },
      zoom: frame.zoom * scale
    };
  }

  destroy(): void {
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
