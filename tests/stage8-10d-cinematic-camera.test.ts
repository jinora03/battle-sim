import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  CinematicCameraTracker,
  ReplayFrameStepper,
  calculateKnockoutSlowMotionFrameCount,
  createStage810dExportSettings
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81004,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

const arenaCanvas = { width: 1360, height: 818 } as HTMLCanvasElement;

function snapshotAtStart(): WorldSnapshot {
  return new LocalSimulationRunner(battle).getSnapshot();
}

function recordReplay(ticks = 240) {
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController(false);
  const recorder = new ReplayRecorder(battle);
  for (let index = 0; index < ticks && !runner.getSnapshot().battleEnded; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    const commands = ai.commandsForTick(snapshot);
    recorder.record(snapshot.tick, commands);
    runner.step(commands);
  }
  const snapshot = runner.getSnapshot();
  return { replay: recorder.export(), endTick: snapshot.tick, checksum: checksumSnapshot(snapshot) };
}

describe('Stage 8.10D cinematic replay camera', () => {
  it('provides cinematic and arena-wide export camera modes without changing video dimensions', () => {
    const cinematic = createStage810dExportSettings({}, {
      layout: 'landscape', resolution: '4k', fps: 60, camera: 'cinematic'
    });
    const broadcast = createStage810dExportSettings({}, {
      layout: 'vertical', resolution: '1080p', fps: 30, camera: 'broadcast'
    });
    expect(cinematic).toMatchObject({
      width: 3840,
      height: 2160,
      camera: { mode: 'cinematic', maxZoom: 1.28, knockoutSlowMotionSeconds: 0.45 },
      presentation: { cameraFollow: false, cameraShake: false, impactFreeze: true }
    });
    expect(broadcast).toMatchObject({
      width: 1080,
      height: 1920,
      camera: { mode: 'broadcast', maxZoom: 1, knockoutSlowMotionSeconds: 0 },
      presentation: { cameraFollow: false, cameraShake: false, impactFreeze: false }
    });
    expect(calculateKnockoutSlowMotionFrameCount(cinematic, true)).toBe(27);
    expect(calculateKnockoutSlowMotionFrameCount(broadcast, true)).toBe(0);
  });

  it('frames both fighters dynamically while preserving conservative zoom near walls and projectiles', () => {
    const settings = createStage810dExportSettings({}, { camera: 'cinematic', fps: 60 });
    const tracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const compact = tracker.update(arenaCanvas, snapshotAtStart(), []);
    expect(compact.zoom).toBeGreaterThan(1);
    expect(compact.zoom).toBeLessThanOrEqual(1.28);
    expect(compact.source.width).toBeLessThan(arenaCanvas.width);

    const start = snapshotAtStart();
    const wallSnapshot: WorldSnapshot = {
      ...start,
      entities: start.entities.map((entity, index) => ({
        ...entity,
        x: index === 0 ? 24 : 696,
        y: index === 0 ? 100 : 860
      })),
      projectiles: [{
        id: 91,
        sourceId: start.entities[0]!.id,
        team: 1,
        weaponId: 'rocket-salvo-missile',
        category: 'ranged',
        x: 705,
        y: 480,
        prevX: 690,
        prevY: 480,
        vx: 15,
        vy: 0,
        radius: 8,
        alive: true,
        fuseRemainingTicks: 30,
        arcHeight: 0,
        rotation: 0,
        targetId: start.entities[1]!.id,
        trailStyle: 'smoke'
      }]
    };
    const wallTracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const wallFrame = wallTracker.update(arenaCanvas, wallSnapshot, []);
    expect(wallFrame.zoom).toBeLessThanOrEqual(1.18);
    expect(wallFrame.source.x).toBeGreaterThanOrEqual(0);
    expect(wallFrame.source.y).toBeGreaterThanOrEqual(0);
    expect(wallFrame.source.x + wallFrame.source.width).toBeLessThanOrEqual(arenaCanvas.width);
    expect(wallFrame.source.y + wallFrame.source.height).toBeLessThanOrEqual(arenaCanvas.height);
  });

  it('uses deterministic ultimate anticipation, impact shake and knockout framing', () => {
    const settings = createStage810dExportSettings({}, { camera: 'cinematic', fps: 60 });
    const snapshot = snapshotAtStart();
    const actor = snapshot.entities[0]!;
    const ultimate: SimulationEvent = {
      type: 'abilityActivated',
      tick: snapshot.tick,
      entityId: actor.id,
      abilityId: 'absolute-zero',
      slot: 'ultimate',
      position: { x: actor.x, y: actor.y },
      direction: { x: 1, y: 0 },
      castTicks: 45
    };
    const blast: SimulationEvent = {
      type: 'blast',
      tick: snapshot.tick,
      sourceId: actor.id,
      abilityId: 'absolute-zero',
      kind: 'wave',
      position: { x: 360, y: 480 },
      radius: 260,
      force: 18,
      damage: 90,
      element: 'ice'
    };
    const death: SimulationEvent = {
      type: 'death',
      tick: snapshot.tick,
      entityId: snapshot.entities[1]!.id,
      killerId: actor.id,
      position: { x: snapshot.entities[1]!.x, y: snapshot.entities[1]!.y }
    };

    const first = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const second = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const firstFrames = [
      first.update(arenaCanvas, snapshot, [ultimate]),
      first.update(arenaCanvas, snapshot, [blast]),
      first.update(arenaCanvas, snapshot, [death], { phase: 'knockout', phaseProgress: 0.5 })
    ];
    const secondFrames = [
      second.update(arenaCanvas, snapshot, [ultimate]),
      second.update(arenaCanvas, snapshot, [blast]),
      second.update(arenaCanvas, snapshot, [death], { phase: 'knockout', phaseProgress: 0.5 })
    ];
    expect(firstFrames).toEqual(secondFrames);
    expect(firstFrames[0]!.zoom).toBeLessThanOrEqual(1.12);
    expect(firstFrames[0]!.emphasis).toBeGreaterThan(0.5);
    expect(firstFrames[2]!.phase).toBe('knockout');
    expect(firstFrames[2]!.emphasis).toBeGreaterThan(0.5);
  });

  it('keeps cinematic presentation outside simulation and preserves fixed-seed replay checksum', () => {
    const source = recordReplay();
    const settings = createStage810dExportSettings({}, { camera: 'cinematic', fps: 30 });
    const stepper = new ReplayFrameStepper(source.replay, source.endTick, settings.fps);
    while (!stepper.done) stepper.next();
    expect(checksumSnapshot(stepper.finalSnapshot())).toBe(source.checksum);

    const camera = readFileSync(new URL('../packages/video-export/src/cinematicCamera.ts', import.meta.url), 'utf8');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    expect(camera).toContain('Export-only camera tracker');
    expect(camera).toContain('deterministicSigned(');
    expect(camera).not.toContain('Math.random(');
    expect(exporter).toContain("phase: 'knockout'");
    expect(exporter).toContain("phase: 'result'");
    expect(exporter).toContain('resultDelaySeconds: knockoutSlowMotionFrames / settings.fps');
    expect(panel).toContain('<option value="cinematic">Cinematic</option>');
    expect(panel).toContain('<option value="broadcast">Arena-wide</option>');
  });
});
