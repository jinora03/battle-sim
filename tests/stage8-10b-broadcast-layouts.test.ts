import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import {
  BroadcastSceneTracker,
  BROADCAST_LAYOUTS,
  createStage810bExportSettings,
  getBroadcastLayout
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81002,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

describe('Stage 8.10B broadcast layouts', () => {
  it('defines viewport-independent 1080p landscape and vertical compositions', () => {
    expect(BROADCAST_LAYOUTS.landscape).toMatchObject({
      id: 'landscape',
      aspectLabel: '16:9',
      width: 1920,
      height: 1080
    });
    expect(BROADCAST_LAYOUTS.vertical).toMatchObject({
      id: 'vertical',
      aspectLabel: '9:16',
      width: 1080,
      height: 1920
    });
    expect(BROADCAST_LAYOUTS.landscape.arena.width / BROADCAST_LAYOUTS.landscape.width).toBeGreaterThan(0.65);
    expect(BROADCAST_LAYOUTS.vertical.arena.width).toBe(BROADCAST_LAYOUTS.vertical.arena.height);
    expect(BROADCAST_LAYOUTS.vertical.safeArea.x + BROADCAST_LAYOUTS.vertical.safeArea.width).toBeLessThanOrEqual(948);
    expect(BROADCAST_LAYOUTS.vertical.safeArea.y + BROADCAST_LAYOUTS.vertical.safeArea.height).toBeLessThan(1800);
  });

  it('creates matching fixed-frame export settings for either broadcast orientation', () => {
    const landscape = createStage810bExportSettings({}, 'landscape');
    const vertical = createStage810bExportSettings({}, 'vertical');
    expect(landscape).toMatchObject({ layout: 'landscape', width: 1920, height: 1080, fps: 60 });
    expect(vertical).toMatchObject({ layout: 'vertical', width: 1080, height: 1920, fps: 60, resultHoldSeconds: 2 });
    expect(getBroadcastLayout(landscape.layout)).toBe(BROADCAST_LAYOUTS.landscape);
    expect(getBroadcastLayout(vertical.layout)).toBe(BROADCAST_LAYOUTS.vertical);
    expect(landscape.presentation.audio).toBe(false);
    expect(vertical.presentation.audio).toBe(false);
  });

  it('builds replay-derived fighter, timer, HP and ability callout data without application UI state', () => {
    const runner = new LocalSimulationRunner(battle);
    const snapshot = runner.getSnapshot();
    const frost = snapshot.entities.find((entity) => entity.fighterId === 'frost-warden');
    expect(frost).toBeDefined();
    const events: SimulationEvent[] = [{
      type: 'abilityActivated',
      tick: snapshot.tick,
      entityId: frost!.id,
      abilityId: 'glacier-charge',
      slot: 'skill1',
      position: { x: frost!.x, y: frost!.y },
      direction: { x: 1, y: 0 },
      castTicks: 30
    }];
    const tracker = new BroadcastSceneTracker(battle);
    const scene = tracker.update(snapshot, events);
    expect(scene.modeName).toBe('Duel');
    expect(scene.roundLabel).toBe('Round 1');
    expect(scene.timerLabel).toBe('0:00');
    expect(scene.left.name).toBe('Frost Warden');
    expect(scene.right.name).toBe('Rocket Vanguard');
    expect(scene.left.hpRatio).toBe(1);
    expect(scene.right.hpRatio).toBe(1);
    expect(scene.abilityCallout).toMatchObject({
      eyebrow: 'Frost Warden activated',
      title: 'Glacier Charge'
    });

    const completed = tracker.update({
      ...snapshot,
      tick: snapshot.tick + 1,
      entities: snapshot.entities.filter((entity) => entity.team === 1),
      battleEnded: true,
      winningTeam: 1,
      result: {
        reason: 'elimination',
        winningTeam: 1,
        winnerEntityIds: [frost!.id],
        endedAtTick: snapshot.tick + 1
      }
    }, []);
    expect(completed.right).toMatchObject({ name: 'Rocket Vanguard', hp: 0, alive: false });
    expect(completed.right.maxHp).toBe(scene.right.maxHp);
    expect(completed.resultCallout).toMatchObject({ eyebrow: 'Winner', title: 'Frost Warden' });
  });

  it('composites the arena into broadcast-only vertical and landscape canvases', () => {
    const renderer = [
      '../packages/video-export/src/broadcastRenderer.ts',
      '../packages/video-export/src/renderers/fighterHud.ts',
      '../packages/video-export/src/renderers/landscapeBroadcastRenderer.ts',
      '../packages/video-export/src/renderers/verticalBroadcastRenderer.ts'
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    expect(renderer).toContain('drawVerticalBroadcast(');
    expect(renderer).toContain('drawLandscapeBroadcast(');
    expect(renderer).toContain('ABILITY READINESS');
    expect(renderer).not.toContain('CURRENT ABILITY');
    expect(renderer).not.toContain('BATTLE EVENT');
    expect(renderer).toContain('drawResult(');
    expect(exporter).toContain('broadcastRenderer.render(renderer.getCanvas()');
    expect(exporter).toContain('await encodeFrame(broadcastCanvas');
    expect(exporter).toContain('resultHoldFrames');
    expect(exporter).not.toContain('captureStream(');
    expect(exporter).not.toContain('MediaRecorder');
    expect(panel).toContain("['landscape', 'vertical']");
    expect(panel).toContain('16:9 YouTube');
    expect(panel).toContain('9:16 Shorts');
  });
});
