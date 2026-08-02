import { Application, Container, Graphics } from 'pixi.js';
import type { ArenaView } from '../arena/ArenaView';
import type { BattleCamera } from '../camera/BattleCamera';

export interface StageCompositionLayers {
  trail: Container | Graphics;
  projectile: Container | Graphics;
  trainingDebug: Container | Graphics;
  playerTargeting: Container | Graphics;
  telegraphs: Container | Graphics;
  screenFlash: Container | Graphics;
}

export class PixiStageComposition {
  readonly arenaLayer = new Container();
  readonly groundFxLayer = new Container();
  readonly trailLayer = new Container();
  readonly projectileFxLayer = new Container();
  readonly projectileLayer = new Container();
  readonly telegraphLayer = new Container();
  readonly fighterFxLayer = new Container();
  readonly fighterLayer = new Container();
  readonly weaponFxLayer = new Container();
  readonly fxLayer = new Container();
  readonly trainingDebugLayer = new Container();
  readonly combatTextLayer = new Container();
  readonly foregroundLayer = new Container();
  readonly screenFxLayer = new Container();

  private mounted = false;

  mount(
    app: Application,
    camera: BattleCamera,
    arenaView: ArenaView,
    layers: StageCompositionLayers
  ): void {
    if (this.mounted) return;
    this.mounted = true;
    app.stage.addChild(camera.root, this.screenFxLayer);
    camera.worldRoot.addChild(
      this.arenaLayer,
      this.groundFxLayer,
      this.trailLayer,
      this.projectileFxLayer,
      this.projectileLayer,
      this.fighterFxLayer,
      this.fighterLayer,
      this.telegraphLayer,
      this.weaponFxLayer,
      this.fxLayer,
      this.trainingDebugLayer,
      this.combatTextLayer,
      this.foregroundLayer
    );
    this.arenaLayer.addChild(arenaView.container);
    this.trailLayer.addChild(layers.trail);
    this.projectileLayer.addChild(layers.projectile);
    this.trainingDebugLayer.addChild(layers.trainingDebug);
    this.foregroundLayer.addChild(layers.playerTargeting);
    this.telegraphLayer.addChild(layers.telegraphs);
    this.screenFxLayer.addChild(layers.screenFlash);
  }
}
