import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import {
  createSeedBatch,
  generateSeedReplay,
  rankBattleSeeds
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81120,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    {
      fighterId: 'pyro-brawler',
      team: 1,
      controller: 'ai',
      x: 320,
      y: 480,
      statScale: { hp: 0.08, damage: 1.4 }
    },
    {
      fighterId: 'solar-sentinel',
      team: 2,
      controller: 'ai',
      x: 400,
      y: 480,
      statScale: { hp: 0.08, damage: 1.4 }
    }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 600 }
};

describe('Stage 8.11B batch simulation and battle ranking', () => {
  it('builds a bounded deterministic consecutive seed batch', () => {
    expect(createSeedBatch(81120, 3)).toEqual([81120, 81121, 81122]);
    expect(createSeedBatch(0xffffffff, 3)).toEqual([0xffffffff, 0, 1]);
    expect(createSeedBatch(50, 100)).toHaveLength(50);
  });

  it('ranks the same setup and seed range identically on repeated scans', async () => {
    const first = await rankBattleSeeds(battle, { count: 3, yieldIntervalTicks: 1000 });
    const second = await rankBattleSeeds(battle, { count: 3, yieldIntervalTicks: 1000 });

    expect(second).toEqual(first);
    expect(first).toHaveLength(3);
    expect(first.map((result) => result.rank)).toEqual([1, 2, 3]);
    expect(first[0]!.score).toBeGreaterThanOrEqual(first[1]!.score);
    expect(first[1]!.score).toBeGreaterThanOrEqual(first[2]!.score);
  }, 20_000);

  it('does not mutate the configured battle while scanning candidate seeds', async () => {
    const before = structuredClone(battle);
    await rankBattleSeeds(battle, { count: 2, yieldIntervalTicks: 1000 });
    expect(battle).toEqual(before);
  });

  it('keeps the batch search lightweight by skipping replay recording and video encoding', () => {
    const ranking = readFileSync(new URL('../packages/video-export/src/seedBattleRanking.ts', import.meta.url), 'utf8');
    const generator = readFileSync(new URL('../packages/video-export/src/seedReplayGenerator.ts', import.meta.url), 'utf8');

    expect(ranking).toContain('recordReplay: false');
    expect(ranking).not.toContain('ReplayVideoExporter');
    expect(ranking).not.toContain('VideoEncoder');
    expect(ranking).not.toContain('MediaRecorder');
    expect(generator).toContain('const recorder = recordReplay ? new ReplayRecorder(workingBattle) : null;');
  });

  it('can regenerate a completed ranked seed through the normal 8.11A replay path', async () => {
    const ranked = await rankBattleSeeds(battle, { count: 2, yieldIntervalTicks: 1000 });
    const completed = ranked.find((result) => result.battleEnded);
    expect(completed).toBeTruthy();

    const replay = await generateSeedReplay(
      { ...battle, seed: completed!.seed },
      { yieldIntervalTicks: 1000 }
    );
    expect(replay.checksum).toBe(completed!.checksum);
    expect(replay.endTick).toBe(completed!.endTick);
  }, 10_000);

  it('supports cancellation without starting video work', async () => {
    const abort = new AbortController();
    await expect(rankBattleSeeds(battle, {
      count: 10,
      signal: abort.signal,
      yieldIntervalTicks: 1000,
      onProgress: (progress) => {
        if (progress.phase === 'searching') abort.abort();
      }
    })).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('adds compact creator controls for searching and selecting ranked seeds', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(hook).toContain('rankBattleSeeds(configuredBattle');
    expect(hook).toContain('if (results[0]) setGenerationSeedTextState(String(results[0].seed));');
    expect(panel).toContain('Find best seeds');
    expect(panel).toContain('<option value={10}>10 seeds</option>');
    expect(panel).toContain('<option value={25}>25 seeds</option>');
    expect(panel).toContain('<option value={50}>50 seeds</option>');
    expect(panel).toContain('batchResults.slice(0, 5)');
  });
});
