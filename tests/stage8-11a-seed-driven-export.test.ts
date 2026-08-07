import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { AiController, PlayerController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  ReplayFrameStepper,
  createStage810hExportSettings,
  generateSeedReplay,
  type ReplayExportSource
} from '@kinetic/video-export';
import { createDefaultBattleSetup } from '../apps/game/src/runtime/BattleSetup';
import { createBattleDefinition } from '../apps/game/src/runtime/createBattleDefinition';

const battle: BattleDefinition = {
  seed: 81101,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'player', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 360 }
};

let generated: ReplayExportSource;

beforeAll(async () => {
  generated = await generateSeedReplay(battle, { yieldIntervalTicks: 1000 });
});

function runUntouchedLivePipeline(definition: BattleDefinition): ReplayExportSource {
  const runner = new LocalSimulationRunner(structuredClone(definition));
  const ai = new AiController(false);
  const player = new PlayerController();
  const recorder = new ReplayRecorder(definition);
  const initial = runner.getRuntimeSnapshot();
  player.setControlledEntities(initial.entities.filter((entity) => entity.controller === 'player').map((entity) => entity.id));

  while (!runner.getRuntimeSnapshot().battleEnded) {
    const snapshot = runner.getRuntimeSnapshot();
    const commands = ai.commandsForTick(snapshot);
    commands.push(...player.commandsForTick(snapshot));
    recorder.record(snapshot.tick, commands);
    runner.step(commands);
  }

  const final = runner.getSnapshot();
  return {
    replay: recorder.export(),
    endTick: final.tick,
    checksum: checksumSnapshot(final),
    battleEnded: final.battleEnded
  };
}

function replayChecksum(source: ReplayExportSource): string {
  const stepper = new ReplayFrameStepper(source.replay, source.endTick, 60);
  while (!stepper.done) stepper.next();
  return checksumSnapshot(stepper.finalSnapshot());
}

describe('Stage 8.11A seed-driven export', () => {
  it('generates a replay without Pixi, React, live canvas, camera, or AudioContext dependencies', async () => {
    const generator = readFileSync(new URL('../packages/video-export/src/seedReplayGenerator.ts', import.meta.url), 'utf8');
    expect(generator).toContain('new LocalSimulationRunner');
    expect(generator).toContain('new ReplayRecorder');
    expect(generator).not.toContain('@kinetic/renderer-pixi');
    expect(generator).not.toMatch(/from\s+['"]react['"]/);
    expect(generator).not.toContain('@kinetic/audio');
    expect(generator).not.toMatch(/\bnew\s+AudioContext\b|\b(?:window|globalThis)\.AudioContext\b/);
    expect(generated.endTick).toBeGreaterThan(0);
  });

  it('matches the final checksum from the normal untouched controller/simulation pipeline', () => {
    const live = runUntouchedLivePipeline(battle);
    expect(generated.endTick).toBe(live.endTick);
    expect(generated.checksum).toBe(live.checksum);
    expect(generated.replay).toEqual(live.replay);
  });

  it('reuses the same generated replay deterministically across multiple playback passes', () => {
    expect(replayChecksum(generated)).toBe(generated.checksum);
    expect(replayChecksum(generated)).toBe(generated.checksum);
  });

  it('keeps export settings outside replay generation and checksum state', () => {
    const vertical = createStage810hExportSettings({}, { layout: 'vertical', format: 'mp4', resolution: '1080p', fps: 60 });
    const landscape = createStage810hExportSettings({}, { layout: 'landscape', format: 'webm', resolution: '4k', fps: 30 });
    expect(vertical).not.toEqual(landscape);
    expect(replayChecksum(generated)).toBe(generated.checksum);
  });

  it('cancels headless simulation cleanly', async () => {
    const abort = new AbortController();
    await expect(generateSeedReplay({ ...battle, seed: 81102, rules: { ...battle.rules, maxBattleTicks: 900 } }, {
      signal: abort.signal,
      yieldIntervalTicks: 1000,
      onProgress: (progress) => {
        if (progress.phase === 'simulating' && progress.simulatedTicks >= 30) abort.abort();
      }
    })).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('respects the explicit simulation safety limit and aborts non-terminated runs', async () => {
    await expect(generateSeedReplay({ ...battle, seed: 81103 }, {
      maxTicks: 5,
      yieldIntervalTicks: 1000
    })).rejects.toMatchObject({ code: 'max-ticks' });
  });

  it('rejects invalid battle configuration with a clear error', async () => {
    await expect(generateSeedReplay({ ...battle, participants: [] })).rejects.toMatchObject({ code: 'invalid-battle' });
  });

  it('produces the normal replay source accepted by the existing replay frame/export pipeline', () => {
    const stepper = new ReplayFrameStepper(generated.replay, generated.endTick, 60);
    expect(stepper.totalFrames).toBe(generated.endTick);
    while (!stepper.done) stepper.next();
    expect(checksumSnapshot(stepper.finalSnapshot())).toBe(generated.checksum);
  });

  it('changes only the seed when the same current setup is regenerated with another seed', () => {
    const setup = createDefaultBattleSetup();
    const setupBefore = structuredClone(setup);
    const first = createBattleDefinition(setup, 81104);
    const second = createBattleDefinition(setup, 81105);
    const { seed: firstSeed, ...firstWithoutSeed } = first;
    const { seed: secondSeed, ...secondWithoutSeed } = second;
    expect(firstSeed).not.toBe(secondSeed);
    expect(firstWithoutSeed).toEqual(secondWithoutSeed);
    expect(setup).toEqual(setupBefore);
  });

  it('keeps Current Replay export while adding cached setup+seed generation to the creator hook', () => {
    const runtime = readFileSync(new URL('../apps/game/src/runtime/BattleRuntime.ts', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    expect(runtime).toContain('return createBattleDefinition(this.setup, seed)');
    expect(hook).toContain('runtime.createReplayExportSource()');
    expect(hook).toContain('generateSeedReplay(configuredBattle');
    expect(hook).toContain("cached?.key === configuredBattleKey");
    expect(panel).toContain('Current replay');
    expect(panel).toContain('Setup + seed');
    expect(panel).toContain('Randomize');
    expect(panel).toContain('Reuse current');
  });
});
