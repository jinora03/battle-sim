import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { resolveBattleAudioMix } from '@kinetic/audio';
import {
  ReplayFrameStepper,
  RuntimeReplayAudioTimeline
} from '@kinetic/video-export';

const duel: BattleDefinition = {
  seed: 81122,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'pyro-brawler', team: 1, controller: 'ai', x: 220, y: 470 },
    { fighterId: 'bomber', team: 2, controller: 'ai', x: 620, y: 470 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 120 }
};

function recordReplay(ticks = 6) {
  const runner = new LocalSimulationRunner(duel);
  const ai = new AiController(false);
  const recorder = new ReplayRecorder(duel);
  for (let index = 0; index < ticks && !runner.getRuntimeSnapshot().battleEnded; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    const commands = ai.commandsForTick(snapshot);
    recorder.record(snapshot.tick, commands);
    runner.step(commands);
  }
  return { replay: recorder.export(), endTick: runner.tick };
}

describe('Stage 8.11V export audio dynamic mix parity', () => {
  it('captures living entity count for every simulation tick even at 30 FPS export', () => {
    const source = recordReplay();
    const stepper = new ReplayFrameStepper(source.replay, source.endTick, 30);
    const first = stepper.next();

    expect(first).not.toBeNull();
    expect(first!.snapshot.tick).toBe(2);
    expect(first!.audioEntityCounts).toEqual([
      { tick: 1, entityCount: 2 },
      { tick: 2, entityCount: 2 }
    ]);
  });

  it('lets the export audio mix cross the same entity-count tiers as live audio', () => {
    const timeline = new RuntimeReplayAudioTimeline();
    timeline.setEntityCount(1, 48);
    timeline.setEntityCount(900, 16);
    timeline.setEntityCount(1800, 10);

    expect(resolveBattleAudioMix(timeline.entityCountAt(1, 48)).voiceLimit).toBe(14);
    expect(resolveBattleAudioMix(timeline.entityCountAt(900, 48)).voiceLimit).toBe(18);
    expect(resolveBattleAudioMix(timeline.entityCountAt(1800, 48)).voiceLimit).toBe(22);
  });

  it('feeds each replay tick count into runtime audio instead of freezing the initial count', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');

    expect(exporter).toContain('for (const sample of frame.audioEntityCounts)');
    expect(exporter).toContain('runtimeAudioTimeline.setEntityCount(sample.tick, sample.entityCount)');
    expect(runtime).toContain('options.timeline.entityCountAt(batch.tick, initialEntityCount)');
    expect(runtime).not.toContain('const entityCount = options.initialSnapshot.entities.length;');
  });
});
