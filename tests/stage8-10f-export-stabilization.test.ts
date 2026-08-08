import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { AiController } from '@kinetic/controllers';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  BroadcastSceneTracker,
  ReplayAudioSynthesizer,
  ReplayAudioTimeline,
  BROADCAST_LAYOUTS
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81006,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'gunner', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'bomber', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

describe('Stage 8.10F export stabilization and broadcast cleanup', () => {
  it('keeps the vertical preset true 9:16 with a large arena and no timer or battle-event strip', () => {
    expect(BROADCAST_LAYOUTS.vertical).toMatchObject({ width: 1080, height: 1920, aspectLabel: '9:16' });
    expect(BROADCAST_LAYOUTS.vertical.arena.width).toBe(BROADCAST_LAYOUTS.vertical.arena.height);
    expect(BROADCAST_LAYOUTS.vertical.arena.x + BROADCAST_LAYOUTS.vertical.arena.width / 2).toBe(540);

    const vertical = readFileSync(new URL('../packages/video-export/src/renderers/verticalBroadcastRenderer.ts', import.meta.url), 'utf8');
    expect(vertical).toContain("drawText(ctx, 'VS'");
    expect(vertical).toContain('drawVerticalFighterHeader(');
    expect(vertical).toContain('drawArenaFrame(');
    expect(vertical).not.toContain('KINETIC BATTLE');
    expect(vertical).not.toContain('timerLabel');
    expect(vertical).not.toContain('eventCallout');
    expect(vertical).toContain('scene.modeName');
    expect(vertical).toContain('scene.arenaName');
    expect(vertical).toContain('drawVerticalSkillsPanel(');
  });

  it('keeps the landscape side cards without permanent header, footer or accent rails', () => {
    const landscape = readFileSync(new URL('../packages/video-export/src/renderers/landscapeBroadcastRenderer.ts', import.meta.url), 'utf8');
    const hud = readFileSync(new URL('../packages/video-export/src/renderers/fighterHud.ts', import.meta.url), 'utf8');
    expect(landscape).toContain('drawLandscapeFighterPanel(');
    expect(landscape).toContain('drawArenaFrame(');
    expect(landscape).not.toContain('KINETIC BATTLE');
    expect(landscape).not.toContain('timerLabel');
    expect(landscape).not.toContain('drawCallout(');
    expect(hud).toContain('ABILITY READINESS');
    expect(hud).toContain('drawLandscapeResource(');
    expect(hud).not.toContain('fillRect(alignRight');
  });

  it('uses the battle-intro fighter identity and standardized visual recipe in the export intro', () => {
    const runner = new LocalSimulationRunner(battle);
    const scene = new BroadcastSceneTracker(battle).update(runner.getSnapshot(), []);
    expect(scene.left).toMatchObject({ name: 'Gunner', identity: 'Metal · Ranged Striker' });
    expect(scene.right).toMatchObject({ name: 'Bomber', identity: 'Neutral · Demolition' });
    expect(scene.left.visual.accentColor).toBeTypeOf('number');
    expect(scene.right.visual.shape).toBe('bomber');

    const cards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');
    const portrait = readFileSync(new URL('../packages/video-export/src/renderers/fighterPortrait.ts', import.meta.url), 'utf8');
    expect(cards).toContain('WHO WILL WIN?');
    expect(cards).toContain('drawBroadcastFighterPortrait(');
    expect(cards).not.toContain('scene.objectiveLabel.toUpperCase()');
    expect(portrait).toContain('drawBroadcastFighterPortrait');
  });

  it('softens and prioritizes deterministic export audio instead of stacking harsh detail over hero impacts', () => {
    const events: SimulationEvent[] = [
      {
        type: 'abilityActivated', tick: 60, entityId: 1, abilityId: 'kill-zone', slot: 'ultimate',
        position: { x: 190, y: 480 }, direction: { x: 1, y: 0 }, castTicks: 30
      },
      {
        type: 'abilityResolved', tick: 90, entityId: 1, abilityId: 'kill-zone', slot: 'ultimate',
        position: { x: 310, y: 480 }, direction: { x: 1, y: 0 }
      },
      {
        type: 'blast', tick: 90, sourceId: 1, abilityId: 'kill-zone', kind: 'wave',
        position: { x: 310, y: 480 }, radius: 240, force: 18, damage: 90, element: 'metal'
      },
      {
        type: 'damage', tick: 90, sourceId: 1, targetId: 2, amount: 120, element: 'metal', hpAfter: 120,
        position: { x: 520, y: 480 }
      }
    ];
    const timeline = new ReplayAudioTimeline(battle);
    timeline.addEvents(events);
    const cues = timeline.finalize();
    const hitmarker = cues.find((cue) => cue.id.includes('hitmarker'));
    const blast = cues.find((cue) => cue.id.includes(':blast:') && cue.priority === 'hero');
    expect(hitmarker).toMatchObject({ priority: 'detail' });
    expect(hitmarker!.gain).toBeLessThan(0.02);
    expect(blast).toBeDefined();

    const first = new ReplayAudioSynthesizer(cues);
    const second = new ReplayAudioSynthesizer(cues);
    const firstPcm = first.renderInterleaved(0, 96_000);
    const secondPcm = second.renderInterleaved(0, 96_000);
    expect(Array.from(firstPcm)).toEqual(Array.from(secondPcm));
    const peak = firstPcm.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
    expect(peak).toBeLessThan(0.8);

    const synthesis = readFileSync(new URL('../packages/video-export/src/audioSynthesis.ts', import.meta.url), 'utf8');
    const runtimeAudio = readFileSync(new URL('../packages/video-export/src/runtimeReplayAudio.ts', import.meta.url), 'utf8');
    const audioEngine = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(synthesis).toContain('LOW_PASS_HZ');
    expect(synthesis).toContain('PRIORITY_GAIN');
    expect(synthesis).not.toContain('Math.random(');
    expect(runtimeAudio).toContain('new BattleAudioEngine({');
    expect(runtimeAudio).toContain('OfflineAudioContext');
    expect(runtimeAudio).toContain('engine.consumeAtTime(');
    expect(audioEngine).toContain('consumeAtTime(');
    expect(audioEngine).toContain('deterministicSeed');
  });

  it('restores and remounts the live battle renderer after every export lifecycle', () => {
    const runtime = readFileSync(new URL('../apps/game/src/runtime/BattleRuntime.ts', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');
    expect(runtime).toContain('restoreRendererAfterVideoExport(): Promise<void>');
    expect(runtime).toContain('previousRenderer.destroy()');
    expect(runtime).toContain('const replacement = new PixiBattleRenderer()');
    expect(runtime).toContain('await replacement.init(this.host');
    expect(hook).toContain('await runtime.restoreRendererAfterVideoExport();');
  });

  it('does not change fixed-seed simulation outcomes', () => {
    const run = () => {
      const runner = new LocalSimulationRunner(battle);
      const ai = new AiController(false);
      for (let tick = 0; tick < 240 && !runner.getSnapshot().battleEnded; tick += 1) {
        const snapshot = runner.getRuntimeSnapshot();
        runner.step(ai.commandsForTick(snapshot));
      }
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(run()).toBe(run());
  });
});
