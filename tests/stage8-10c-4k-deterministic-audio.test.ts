import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  ReplayAudioSynthesizer,
  ReplayAudioTimeline,
  ReplayFrameStepper,
  WebmMuxer,
  createStage810cExportSettings,
  getBroadcastLayout
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81003,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

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
  return {
    replay: recorder.export(),
    endTick: snapshot.tick,
    checksum: checksumSnapshot(snapshot)
  };
}

const mediaPipeline = readFileSync(
  new URL('../packages/video-export/src/mediaPipeline.ts', import.meta.url),
  'utf8'
);

describe('Stage 8.10C 4K and deterministic audio', () => {
  it('creates exact vertical and landscape 4K presets with 30 and 60 FPS options', () => {
    const landscape = createStage810cExportSettings({}, {
      layout: 'landscape', resolution: '4k', fps: 60, quality: 'maximum', audio: true
    });
    const vertical = createStage810cExportSettings({}, {
      layout: 'vertical', resolution: '4k', fps: 30, quality: 'balanced', audio: false
    });
    expect(landscape).toMatchObject({
      width: 3840,
      height: 2160,
      fps: 60,
      resolution: '4k',
      quality: 'maximum',
      audio: { enabled: true, codec: 'opus', sampleRate: 48_000, channels: 2 }
    });
    expect(vertical).toMatchObject({
      width: 2160,
      height: 3840,
      fps: 30,
      resolution: '4k',
      audio: { enabled: false }
    });
    expect(getBroadcastLayout('landscape', 2).arena.width).toBe(getBroadcastLayout('landscape').arena.width * 2);
    expect(getBroadcastLayout('vertical', 2).safeArea.height).toBe(getBroadcastLayout('vertical').safeArea.height * 2);
  });

  it('replays the same 60 Hz simulation deterministically at either output frame rate', () => {
    const source = recordReplay();
    for (const fps of [30, 60] as const) {
      const stepper = new ReplayFrameStepper(source.replay, source.endTick, fps);
      let frames = 0;
      while (!stepper.done) {
        expect(stepper.next()).not.toBeNull();
        frames += 1;
      }
      expect(frames).toBe(Math.ceil(source.endTick * fps / 60));
      expect(stepper.currentTick).toBe(source.endTick);
      expect(checksumSnapshot(stepper.finalSnapshot())).toBe(source.checksum);
    }
  });

  it('builds replay-timestamped audio cues deterministically without duplicate cue IDs', () => {
    const events: SimulationEvent[] = [
      {
        type: 'abilityActivated', tick: 60, entityId: 1, abilityId: 'absolute-zero', slot: 'ultimate',
        position: { x: 190, y: 480 }, direction: { x: 1, y: 0 }, castTicks: 45
      },
      {
        type: 'abilityResolved', tick: 105, entityId: 1, abilityId: 'absolute-zero', slot: 'ultimate',
        position: { x: 310, y: 480 }, direction: { x: 1, y: 0 }
      },
      {
        type: 'blast', tick: 105, sourceId: 1, abilityId: 'absolute-zero', kind: 'wave',
        position: { x: 310, y: 480 }, radius: 260, force: 18, damage: 80, element: 'ice'
      },
      {
        type: 'damage', tick: 105, sourceId: 1, targetId: 2, amount: 110, element: 'ice', hpAfter: 90,
        position: { x: 500, y: 480 }
      },
      { type: 'death', tick: 180, entityId: 2, killerId: 1, position: { x: 520, y: 480 } },
      { type: 'battleEnded', tick: 180, winningTeam: 1, reason: 'elimination', winnerEntityIds: [1] }
    ];
    const first = new ReplayAudioTimeline(battle);
    const second = new ReplayAudioTimeline(battle);
    first.addEvents(events);
    first.addEvents(events);
    second.addEvents(events);
    const firstCues = first.finalize();
    const secondCues = second.finalize();
    expect(firstCues).toEqual(secondCues);
    expect(new Set(firstCues.map((cue) => cue.id)).size).toBe(firstCues.length);
    expect(firstCues.some((cue) => cue.id.includes('absolute-zero'))).toBe(true);
    expect(firstCues.some((cue) => cue.id.includes('hitmarker'))).toBe(true);
    expect(firstCues.some((cue) => cue.id.includes('result'))).toBe(true);

    const synthA = new ReplayAudioSynthesizer(firstCues);
    const synthB = new ReplayAudioSynthesizer(secondCues);
    expect(Array.from(synthA.renderInterleaved(0, 2048))).toEqual(Array.from(synthB.renderInterleaved(0, 2048)));
  });

  it('muxes an Opus audio track beside VP9 video samples', async () => {
    const muxer = new WebmMuxer({
      width: 1920,
      height: 1080,
      fps: 60,
      codec: 'vp9',
      maxEncodedBytes: 1024 * 1024,
      audio: { codec: 'opus', sampleRate: 48_000, channels: 2 }
    });
    muxer.addVideoSample({ timestampUs: 0, durationUs: 16_667, keyFrame: true, data: Uint8Array.of(1, 2, 3) });
    muxer.addAudioSample({ timestampUs: 0, durationUs: 20_000, data: Uint8Array.of(4, 5, 6) });
    const blob = muxer.finalize();
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain('V_VP9');
    expect(text).toContain('A_OPUS');
    expect(text).toContain('OpusHead');
  });

  it('keeps export audio offline and independent of render speed or the live battle clock', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const timeline = readFileSync(new URL('../packages/video-export/src/audioTimeline.ts', import.meta.url), 'utf8');
    const synthesis = readFileSync(new URL('../packages/video-export/src/audioSynthesis.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    expect(exporter).toContain("report('audio'");
    expect(exporter).toContain('audioTimeline.addEvents(frame.events)');
    expect(exporter).toContain('new ReplayAudioSynthesizer(');
    expect(mediaPipeline).toContain('this.muxer.addAudioSample(sample)');
    expect(timeline).toContain('input.tick / 60');
    expect(synthesis).toContain('deterministicNoise(');
    expect(synthesis).not.toContain('Math.random(');
    expect(exporter).not.toContain('AudioContext.currentTime');
    expect(exporter).not.toContain('captureStream(');
    expect(panel).toContain('<option value="4k">4K</option>');
    expect(panel).toContain('<option value={30}>30 FPS</option>');
    expect(panel).toContain('Deterministic');
  });
});
