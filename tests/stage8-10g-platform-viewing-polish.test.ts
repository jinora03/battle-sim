import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import { AiController } from '@kinetic/controllers';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import { BroadcastSceneTracker, BROADCAST_LAYOUTS } from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81007,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'pyro-brawler', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'solar-sentinel', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

describe('Stage 8.10G platform viewing polish', () => {
  it('restores a fuller Shorts composition with a large arena, readable matchup cards and skills below', () => {
    const vertical = BROADCAST_LAYOUTS.vertical;
    expect(vertical).toMatchObject({ width: 1080, height: 1920, aspectLabel: '9:16' });
    expect(vertical.arena.width).toBe(vertical.arena.height);
    expect(vertical.arena.width).toBeGreaterThanOrEqual(980);
    expect(vertical.arena.y).toBeLessThan(400);
    expect(vertical.arena.y + vertical.arena.height).toBeLessThanOrEqual(1400);

    const source = readFileSync(new URL('../packages/video-export/src/renderers/verticalBroadcastRenderer.ts', import.meta.url), 'utf8');
    expect(source).toContain("{ x: 40, y: 112, width: 470, height: 200 }");
    expect(source).toContain("{ x: 570, y: 112, width: 470, height: 200 }");
    expect(source).toContain("drawText(ctx, 'VS', 540, 220");
    expect(source).toContain('scene.modeName');
    expect(source).toContain('scene.arenaName');
    expect(source).toContain('drawVerticalSkillsPanel(');
    expect(source).not.toContain('timerLabel');
    expect(source).not.toContain('eventCallout');
  });

  it('adds readable fighter identity and primary weapon metadata without restoring vertical dashboard clutter', () => {
    const runner = new LocalSimulationRunner(battle);
    const scene = new BroadcastSceneTracker(battle).update(runner.getSnapshot(), []);
    expect(scene.left).toMatchObject({
      name: 'Pyro',
      identity: 'Fire · Heat Combo Bruiser',
      weaponName: 'Flame Jet'
    });
    expect(scene.right).toMatchObject({
      name: 'Solar Sentinel',
      identity: 'Fire / Metal · Solar Guardian',
      weaponName: 'Solar Punch'
    });
    expect(scene.left.resource).toMatchObject({ id: 'heat', name: 'Heat', maximum: 100 });
    expect(scene.right.resource).toBeNull();

    const hud = readFileSync(new URL('../packages/video-export/src/renderers/fighterHud.ts', import.meta.url), 'utf8');
    expect(hud).toContain('fighter.identity');
    expect(hud).toContain('fighter.weaponName');
    expect(hud).toContain('if (fighter.resource)');
    expect(hud).toContain('drawLandscapeResource(');
  });

  it('widens landscape fighter rails for mobile YouTube playback while keeping the arena dominant', () => {
    const landscape = BROADCAST_LAYOUTS.landscape;
    expect(landscape.arena.width / landscape.width).toBeGreaterThan(0.65);
    const source = readFileSync(new URL('../packages/video-export/src/renderers/landscapeBroadcastRenderer.ts', import.meta.url), 'utf8');
    expect(source).toContain("{ x: 20, y: 64, width: 300, height: 952 }");
    expect(source).toContain("{ x: 1600, y: 64, width: 300, height: 952 }");
  });

  it('fixes manual letter spacing and prevents stacked result overlays from colliding', () => {
    const primitives = readFileSync(new URL('../packages/video-export/src/renderers/canvasPrimitives.ts', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../packages/video-export/src/broadcastRenderer.ts', import.meta.url), 'utf8');
    const cards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');
    expect(primitives).toContain("ctx.textAlign = 'left';");
    expect(primitives).toContain('const previousAlign = ctx.textAlign;');
    expect(renderer).toContain("const creatorSummaryVisible = options.creatorCard?.kind === 'summary';");
    expect(renderer).toContain('options.showResult === false || creatorSummaryVisible');
    expect(cards).toContain('drawVerticalSummary(');
    expect(cards).toContain('drawLandscapeSummary(');
    expect(cards).toContain('y + height - 82');
    expect(cards).toContain('y + height - 48');
  });

  it('retries transient renderer recovery without turning a completed download into a false export error', () => {
    const runtime = readFileSync(new URL('../apps/game/src/runtime/BattleRuntime.ts', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    expect(runtime).toContain('for (let attempt = 0; attempt < 3; attempt += 1)');
    expect(runtime).toContain('await waitForRendererCleanup(2);');
    expect(hook).toContain('let recoveryFailure: unknown = null;');
    expect(hook).toContain('Video exported, but the battle renderer could not recover');
    expect(exporter).toContain('Export cleanup must never turn an already encoded video into a false');
  });

  it('preserves fixed-seed simulation outcomes', () => {
    const run = () => {
      const runner = new LocalSimulationRunner(battle);
      const ai = new AiController(false);
      for (let tick = 0; tick < 240 && !runner.getSnapshot().battleEnded; tick += 1) {
        runner.step(ai.commandsForTick(runner.getRuntimeSnapshot()));
      }
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(run()).toBe(run());
  });
});
