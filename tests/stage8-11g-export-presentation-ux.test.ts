import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { CinematicCameraTracker, createStage810hExportSettings } from '@kinetic/video-export';

const shakeBattle: BattleDefinition = {
  seed: 81107,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

const shakeCanvas = { width: 1360, height: 818 } as HTMLCanvasElement;

describe('Stage 8.11G export presentation and source clarity', () => {
  it('makes the creator intro more readable, centered and removes duplicate ghost portraits', () => {
    const liveIntro = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const cards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');

    expect(liveIntro).toContain("'Who will win?'");
    expect(cards).toContain("'WHO WILL WIN?'");
    expect(cards).toContain("layout.width * 0.235");
    expect(cards).toContain("layout.width * 0.765");
    expect(cards).toContain('vertical ? 61 : 66');
    expect(cards).toContain('vertical ? 78 : 82');
    expect(cards).not.toContain('ctx.filter = `blur(');
    expect(cards).not.toContain('ghost: boolean');
  });

  it('turns the result card into a larger victory presentation with the actual winner portrait', () => {
    const cards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');

    expect(cards).toContain("'VICTORY'");
    expect(cards).toContain('const width = 860;');
    expect(cards).toContain('const height = 760;');
    expect(cards).toContain('drawBroadcastFighterPortrait(ctx, winner');
    expect(cards).toContain('FINISHING MOMENT');
  });

  it('distinguishes the completed arena replay from a generated seed replay and blocks partial live exports', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(panel).toContain('Completed battle currently shown in the arena');
    expect(panel).toContain('Current arena battle is still recording');
    expect(panel).toContain('Export finished arena replay');
    expect(panel).toContain('Generate seed replay & export');
    expect(panel).toContain("start('current-replay')");
    expect(panel).toContain("start('setup-seed')");
    expect(hook).toContain('Finish the battle before queueing its replay.');
    expect(hook).toContain('Wait for the result before exporting this replay');
  });

  it('allows a completed queue item to be downloaded while the next item is rendering', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    expect(panel).toContain('<button type="button" onClick={() => downloadQueueItem(item.id)}>Download</button>');
    expect(panel).not.toContain('onClick={() => downloadQueueItem(item.id)} disabled={running}');
  });

  it('uses the live renderer shake strength deterministically in both export camera modes', () => {
    const camera = readFileSync(new URL('../packages/video-export/src/cinematicCamera.ts', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(renderer).toContain('getLastPresentationShakePixels()');
    expect(renderer).toContain('this.camera.addShake(this.lastPresentationShake);');
    expect(camera).toContain('presentationShake?: number;');
    expect(camera).toContain('Math.pow(0.82, 60 / this.frameRate)');
    expect(camera).toContain('deterministicSigned(');
    expect(camera).not.toContain('blastEnergy');
    expect(camera).not.toContain('* 0.015 * this.shakeEnergy');
    expect(camera).not.toContain('Math.random(');
    expect(panel).toContain('label="Camera shake"');
    expect(panel).toContain('label="Screen flashes"');

    const enabled = createStage810hExportSettings({ cameraShake: false, screenFlash: false }, {
      camera: 'broadcast'
    });
    expect(enabled.camera.shakeEnabled).toBe(true);
    expect(enabled.presentation.cameraShake).toBe(false);
    expect(enabled.presentation.screenFlash).toBe(true);

    const disabled = createStage810hExportSettings({}, {
      camera: 'broadcast',
      cameraShake: false,
      screenFlash: false
    });
    expect(disabled.camera.shakeEnabled).toBe(false);
    expect(disabled.presentation.screenFlash).toBe(false);

    const snapshot = new LocalSimulationRunner(shakeBattle).getSnapshot();
    const first = new CinematicCameraTracker(shakeBattle, enabled.camera, enabled.fps);
    const second = new CinematicCameraTracker(shakeBattle, enabled.camera, enabled.fps);
    const firstFrame = first.update(shakeCanvas, snapshot, [], { presentationShake: 10 });
    const secondFrame = second.update(shakeCanvas, snapshot, [], { presentationShake: 10 });
    expect(firstFrame).toEqual(secondFrame);
    expect(firstFrame.zoom).toBeGreaterThan(1);
    expect(firstFrame.source.width).toBeLessThan(shakeCanvas.width);

    const disabledTracker = new CinematicCameraTracker(shakeBattle, disabled.camera, disabled.fps);
    const stableFrame = disabledTracker.update(shakeCanvas, snapshot, [], { presentationShake: 10 });
    expect(stableFrame.zoom).toBe(1);
    expect(stableFrame.source).toEqual({ x: 0, y: 0, width: shakeCanvas.width, height: shakeCanvas.height });
  });
});
