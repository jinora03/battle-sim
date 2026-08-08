import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  CinematicCameraTracker,
  ReplayAudioTimeline,
  ReplayFrameStepper,
  buildCinematicHighlightPlan,
  cinematicHighlightOffsetSecondsAtTick,
  createCinematicHighlightPlan,
  createStage810hExportSettings,
  getCinematicHighlightFocus,
  runHeadlessSeedSimulation,
  scoreCreatorHighlightEvent
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81130,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'pyro-brawler', team: 1, controller: 'ai', x: 280, y: 480 },
    { fighterId: 'solar-sentinel', team: 2, controller: 'ai', x: 440, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 900 }
};

const arenaCanvas = { width: 1360, height: 818 } as HTMLCanvasElement;

describe('Stage 8.11C cinematic highlight system', () => {
  it('shares deterministic creator highlight scoring between metadata and cinematic planning', () => {
    const ultimate: SimulationEvent = {
      type: 'abilityActivated',
      tick: 120,
      entityId: 1,
      abilityId: 'inferno-drive',
      slot: 'ultimate',
      position: { x: 320, y: 480 },
      direction: { x: 1, y: 0 },
      castTicks: 45
    };
    const heavyHit: SimulationEvent = {
      type: 'damage',
      tick: 180,
      sourceId: 1,
      targetId: 2,
      amount: 180,
      element: 'fire',
      hpAfter: 420,
      position: { x: 420, y: 480 }
    };
    const knockout: SimulationEvent = {
      ...heavyHit,
      tick: 240,
      hpAfter: 0
    };

    expect(scoreCreatorHighlightEvent(ultimate)).toMatchObject({ kind: 'ultimate', score: 805 });
    expect(scoreCreatorHighlightEvent(heavyHit)).toMatchObject({ kind: 'heavy-hit', score: 816 });
    expect(scoreCreatorHighlightEvent(knockout)).toMatchObject({ kind: 'knockout', score: 1466 });
  });

  it('selects only spaced major moments, keeps knockout treatment separate and caps slow motion', () => {
    const settings = createStage810hExportSettings({}, { camera: 'cinematic', fps: 60 });
    const plan = createCinematicHighlightPlan([
      { tick: 100, kind: 'ultimate', score: 810, position: { x: 250, y: 420 } },
      { tick: 140, kind: 'heavy-hit', score: 980, position: { x: 360, y: 480 } },
      { tick: 420, kind: 'heavy-hit', score: 900, position: { x: 470, y: 500 } },
      { tick: 950, kind: 'heavy-hit', score: 1_100, position: { x: 500, y: 520 } }
    ], 1000, settings.camera, settings.fps);

    expect(plan.moments.map((moment) => moment.tick)).toEqual([140, 420]);
    expect(plan.moments).toHaveLength(2);
    expect(plan.moments.every((moment) => moment.kind !== 'knockout')).toBe(true);
    expect(plan.moments.filter((moment) => moment.slowMotionStartTick !== null)).toHaveLength(2);
    expect(plan.extraFrames).toBeGreaterThan(0);
    expect(plan.addedSeconds).toBeLessThanOrEqual(0.75);
  });

  it('maps inserted highlight frames into replay audio time without shifting the triggering frame early', () => {
    const settings = createStage810hExportSettings({}, { camera: 'cinematic', fps: 30 });
    const plan = createCinematicHighlightPlan([
      { tick: 120, kind: 'heavy-hit', score: 980, position: { x: 360, y: 480 } }
    ], 600, settings.camera, settings.fps);
    const moment = plan.moments[0]!;
    expect(moment.slowMotionStartTick).not.toBeNull();
    expect(cinematicHighlightOffsetSecondsAtTick(plan, moment.slowMotionStartTick!)).toBe(0);
    expect(cinematicHighlightOffsetSecondsAtTick(plan, moment.slowMotionStartTick! + 2)).toBeCloseTo(1 / 30, 6);
    expect(cinematicHighlightOffsetSecondsAtTick(plan, moment.slowMotionEndTick! + 1)).toBeCloseTo(plan.addedSeconds, 6);

    const timeline = new ReplayAudioTimeline(battle, {
      presentationOffsetSecondsAtTick: (tick) => cinematicHighlightOffsetSecondsAtTick(plan, tick)
    });
    timeline.addEvents([{
      type: 'death', tick: moment.slowMotionEndTick! + 1, entityId: 2,
      killerId: 1, position: { x: 440, y: 480 }
    }]);
    const cue = timeline.finalize().find((entry) => entry.id.includes(':death:'));
    expect(cue?.startsAtSeconds).toBeCloseTo((moment.slowMotionEndTick! + 1) / 60 + plan.addedSeconds, 6);
  });

  it('feeds scored highlight focus into deterministic camera emphasis', () => {
    const settings = createStage810hExportSettings({}, { camera: 'cinematic', fps: 60 });
    const snapshot = new LocalSimulationRunner(battle).getSnapshot();
    const actor = snapshot.entities[0]!;
    const plan = createCinematicHighlightPlan([
      { tick: 120, kind: 'heavy-hit', score: 980, position: { x: actor.x, y: actor.y } }
    ], 600, settings.camera, settings.fps);
    const focus = getCinematicHighlightFocus(plan, 120);
    expect(focus).toBeTruthy();

    const baselineTracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const highlightedTracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    const baseline = baselineTracker.update(arenaCanvas, snapshot, []);
    const highlighted = highlightedTracker.update(arenaCanvas, snapshot, [], { highlight: focus });
    expect(highlighted.emphasis).toBeGreaterThan(baseline.emphasis);

    const repeatedTracker = new CinematicCameraTracker(battle, settings.camera, settings.fps);
    expect(repeatedTracker.update(arenaCanvas, snapshot, [], { highlight: focus })).toEqual(highlighted);
  });

  it('analyzes replay highlights in an isolated prepass without changing the replay checksum', async () => {
    const simulation = await runHeadlessSeedSimulation(battle, {
      recordReplay: true,
      requireBattleEnd: false,
      maxTicks: 240,
      yieldIntervalTicks: 1000
    });
    expect(simulation.replay).toBeTruthy();
    const source = {
      replay: simulation.replay!,
      endTick: simulation.endTick,
      checksum: simulation.checksum,
      battleEnded: simulation.battleEnded
    };
    const settings = createStage810hExportSettings({}, { camera: 'cinematic', fps: 60 });
    const firstPlan = await buildCinematicHighlightPlan(source, settings.camera, settings.fps);
    const secondPlan = await buildCinematicHighlightPlan(source, settings.camera, settings.fps);
    expect(secondPlan).toEqual(firstPlan);

    const stepper = new ReplayFrameStepper(source.replay, source.endTick, 60);
    while (!stepper.done) stepper.next();
    expect(checksumSnapshot(stepper.finalSnapshot())).toBe(source.checksum);
  }, 10_000);

  it('keeps selective slow motion bounded and presentation-only in the exporter', () => {
    const planner = readFileSync(new URL('../packages/video-export/src/cinematicHighlights.ts', import.meta.url), 'utf8');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const audio = readFileSync(new URL('../packages/video-export/src/audioTimeline.ts', import.meta.url), 'utf8');
    const runtimeAudio = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');

    expect(planner).toContain('Replay-only prepass');
    expect(planner).toContain('MIN_MOMENT_SPACING_TICKS');
    expect(planner).not.toContain('Math.random(');
    expect(exporter).toContain('highlightPlan.extraFrames');
    expect(exporter).toContain('isCinematicHighlightSlowMotionFrame(highlightPlan');
    expect(exporter).toContain("phase: 'knockout'");
    expect(audio).toContain('presentationOffsetSecondsAtTick');
    expect(runtimeAudio).toContain('presentationOffsetSecondsAtTick');
  });
});
