import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import {
  CreatorReplayAnalyzer,
  calculateCreatorIntroFrameCount,
  createStage810eExportSettings,
  getCreatorExportPreset,
  listCreatorExportPresets
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81005,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

function completedSnapshot(): WorldSnapshot {
  const initial = new LocalSimulationRunner(battle).getSnapshot();
  return {
    ...initial,
    tick: 180,
    battleEnded: true,
    winningTeam: 1,
    result: {
      reason: 'elimination',
      winningTeam: 1,
      winnerEntityIds: [initial.entities[0]!.id],
      endedAtTick: 180
    },
    entities: initial.entities.map((entity, index) => ({
      ...entity,
      alive: index === 0,
      hp: index === 0 ? entity.maxHp * 0.42 : 0
    }))
  };
}

describe('Stage 8.10E creator polish', () => {
  it('provides reusable YouTube, Shorts, 4K master and quick-draft presets', () => {
    expect(listCreatorExportPresets().map((preset) => preset.id)).toEqual([
      'youtube', 'shorts', 'master', 'quick'
    ]);
    expect(getCreatorExportPreset('shorts')).toMatchObject({
      layout: 'vertical', resolution: '1080p', fps: 60, quality: 'high', audio: true
    });
    expect(getCreatorExportPreset('master')).toMatchObject({
      layout: 'landscape', resolution: '4k', fps: 60, quality: 'maximum'
    });
  });

  it('creates creator settings with intro, captions, summary hold and thumbnail selection', () => {
    const shorts = createStage810eExportSettings({}, { preset: 'shorts' });
    expect(shorts).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 60,
      resultHoldSeconds: 2.8,
      creator: {
        preset: 'shorts',
        introSeconds: 1.4,
        captionsEnabled: true,
        thumbnailEnabled: true
      }
    });
    expect(calculateCreatorIntroFrameCount(shorts)).toBe(84);

    const custom = createStage810eExportSettings({}, {
      preset: 'custom', layout: 'landscape', resolution: '4k', fps: 30,
      intro: false, captions: false, thumbnail: false
    });
    expect(custom).toMatchObject({
      width: 3840,
      height: 2160,
      fps: 30,
      creator: {
        preset: 'custom', introSeconds: 0, captionsEnabled: false, thumbnailEnabled: false
      }
    });
  });

  it('derives deterministic winner, largest-hit, top-ability and highlight metadata from replay events', () => {
    const snapshot = completedSnapshot();
    const source = snapshot.entities[0]!;
    const target = snapshot.entities[1]!;
    const events: SimulationEvent[] = [
      {
        type: 'abilityActivated', tick: 100, entityId: source.id, abilityId: 'absolute-zero', slot: 'ultimate',
        position: { x: source.x, y: source.y }, direction: { x: 1, y: 0 }, castTicks: 45
      },
      {
        type: 'damage', tick: 145, sourceId: source.id, targetId: target.id, amount: 240,
        element: 'ice', hpAfter: 0, position: { x: target.x, y: target.y }
      },
      {
        type: 'death', tick: 145, entityId: target.id, killerId: source.id,
        position: { x: target.x, y: target.y }
      }
    ];
    const first = new CreatorReplayAnalyzer(battle);
    const second = new CreatorReplayAnalyzer(battle);
    expect(first.update(snapshot, events)).toBe(true);
    second.update(snapshot, events);
    const firstSummary = first.finalize(snapshot);
    const secondSummary = second.finalize(snapshot);

    expect(firstSummary).toEqual(secondSummary);
    expect(firstSummary).toMatchObject({
      winnerName: 'Frost Warden',
      winningTeam: 1,
      durationSeconds: 3,
      largestHit: { amount: 240, abilityName: 'Absolute Zero' },
      topAbility: { abilityId: 'absolute-zero', abilityName: 'Absolute Zero', totalDamage: 240 },
      highlight: { kind: 'knockout', tick: 145 }
    });
    expect(firstSummary.remainingHpRatio).toBeCloseTo(0.42, 4);
  });

  it('keeps creator analysis, cards, thumbnail encoding and history outside simulation state', () => {
    const analyzer = readFileSync(new URL('../packages/video-export/src/creatorHighlights.ts', import.meta.url), 'utf8');
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const cards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');
    const history = readFileSync(new URL('../apps/game/src/features/battle/replayExportHistory.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(analyzer).toContain('Replay-only creator analysis');
    expect(analyzer).not.toContain('Math.random(');
    expect(exporter).toContain('new CreatorReplayAnalyzer(');
    expect(exporter).toContain('captureCreatorThumbnail(');
    expect(exporter).toContain("kind: 'intro'");
    expect(exporter).toContain("kind: 'summary'");
    expect(exporter).toContain('startOffsetSeconds: introFrames / settings.fps');
    expect(cards).toContain('MOST DAMAGING ABILITY');
    expect(history).toContain('localStorage');
    expect(panel).toContain('Creator preset');
    expect(panel).toContain('Export history');
  });
});
