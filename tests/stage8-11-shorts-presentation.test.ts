import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calculateCreatorIntroFrameCount,
  createStage810hExportSettings,
  projectFighterNameplate,
  resolveMatchupHook,
  shouldShowFighterNameplates,
  type BroadcastCameraFrame
} from '@kinetic/video-export';

const fighter = (fighterId: string, name: string, identity: string) => ({ fighterId, name, identity });

const cameraFrame: BroadcastCameraFrame = {
  source: { x: 50, y: 50, width: 100, height: 100 },
  zoom: 2,
  emphasis: 0,
  phase: 'battle'
};

describe('creator Shorts matchup intro and fighter nameplates', () => {
  it('resolves readable matchup hooks while preserving actual side order', () => {
    const pyro = fighter('pyro-brawler', 'Pyro', 'Fire · Heat Combo Bruiser');
    const water = fighter('water-shaper', 'Water Shaper', 'Water · Controller');
    const frost = fighter('frost-warden', 'Frost Warden', 'Ice · Controller');
    const mech = fighter('mech-bruiser', 'Mech Bruiser', 'Metal · Bruiser');
    const rocket = fighter('rocket-vanguard', 'Rocket Vanguard', 'Metal · Artillery');
    const gunner = fighter('gunner', 'Gunner', 'Metal · Ranged Striker');
    const bomber = fighter('bomber', 'Bomber', 'Neutral · Demolition');
    const ballast = fighter('ballast', 'Ballast', 'Void · Controller');
    const volt = fighter('volt-striker', 'Volt Striker', 'Electric · Striker');
    const thorn = fighter('thorn-colossus', 'Thorn Colossus', 'Nature · Juggernaut');

    expect(resolveMatchupHook(pyro, water)).toBe('FIRE vs WATER');
    expect(resolveMatchupHook(water, pyro)).toBe('WATER vs FIRE');
    expect(resolveMatchupHook(pyro, frost)).toBe('FIRE vs ICE');
    expect(resolveMatchupHook(pyro, mech)).toBe('FIRE vs STEEL');
    expect(resolveMatchupHook(rocket, gunner)).toBe('MISSILES vs BULLETS');
    expect(resolveMatchupHook(bomber, water)).toBe('EXPLOSIONS vs WATER');
    expect(resolveMatchupHook(bomber, ballast)).toBe('EXPLOSIONS vs MASS');
    expect(resolveMatchupHook(volt, thorn)).toBe('SPEED vs NATURE');
    expect(resolveMatchupHook(thorn, volt)).toBe('NATURE vs SPEED');
  });

  it('falls back safely for custom fighters', () => {
    expect(resolveMatchupHook(
      fighter('storm-sage', 'Storm Sage', 'Arcane · Controller'),
      fighter('custom-brute', 'Custom Brute', 'Arena fighter')
    )).toBe('ARCANE vs CUSTOM BRUTE');
  });

  it('uses a 1.5 second creator intro and preserves the disabled zero-frame path', () => {
    const sixty = createStage810hExportSettings({}, { preset: 'shorts', fps: 60 });
    const thirty = createStage810hExportSettings({}, { preset: 'shorts', fps: 30 });
    const disabled = createStage810hExportSettings({}, { preset: 'shorts', fps: 60, intro: false });
    const labelsOff = createStage810hExportSettings({}, { preset: 'shorts', fps: 60, fighterNameplates: false });

    expect(sixty.creator.introSeconds).toBe(1.5);
    expect(calculateCreatorIntroFrameCount(sixty)).toBe(90);
    expect(calculateCreatorIntroFrameCount(thirty)).toBe(45);
    expect(calculateCreatorIntroFrameCount(disabled)).toBe(0);
    expect(labelsOff.creator.fighterNameplatesEnabled).toBe(false);
  });

  it('positions a nameplate from fighter radius through the same camera crop', () => {
    const projection = projectFighterNameplate(
      { x: 50, y: 50, radius: 10 },
      { width: 100, height: 100 },
      { width: 200, height: 200 },
      { x: 40, y: 350, width: 1000, height: 1000 },
      cameraFrame
    );
    expect(projection.x).toBeCloseTo(540, 5);
    expect(projection.radiusPx).toBeCloseTo(156, 5);
    expect(projection.y).toBeCloseTo(694, 5);
    expect(projection.visible).toBe(true);

    const panned = projectFighterNameplate(
      { x: 50, y: 50, radius: 10 },
      { width: 100, height: 100 },
      { width: 200, height: 200 },
      { x: 40, y: 350, width: 1000, height: 1000 },
      { ...cameraFrame, source: { ...cameraFrame.source, x: 60 } }
    );
    expect(panned.x).toBeCloseTo(440, 5);
    expect(panned.y).toBeCloseTo(projection.y, 5);
  });

  it('shows normal floating names only for small battles', () => {
    expect(shouldShowFighterNameplates(1)).toBe(true);
    expect(shouldShowFighterNameplates(2)).toBe(true);
    expect(shouldShowFighterNameplates(4)).toBe(true);
    expect(shouldShowFighterNameplates(5)).toBe(false);
    expect(shouldShowFighterNameplates(20)).toBe(false);
  });


  it('keeps the export fighter-name toggle UI separate from live gameplay', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(panel).toContain('ToggleOption label=\"Fighter names\"');
    expect(panel).toContain("fighterNameplatesEnabled ? 'Small fights only' : 'Disabled'");
    expect(hook).toContain('fighterNameplatesEnabled');
    expect(hook).toContain('setFighterNameplatesEnabled');
  });

  it('keeps the feature in export/broadcast presentation and leaves live Pixi gameplay untouched', () => {
    const broadcast = readFileSync(new URL('../packages/video-export/src/broadcastRenderer.ts', import.meta.url), 'utf8');
    const liveRenderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    const creatorCards = readFileSync(new URL('../packages/video-export/src/renderers/creatorCards.ts', import.meta.url), 'utf8');

    expect(broadcast).toContain('drawFighterNameplates(');
    expect(creatorCards).toContain('resolveMatchupHook(scene.left, scene.right)');
    expect(creatorCards).toContain('vertical ? layout.height * 0.225 : layout.height * 0.19');
    expect(creatorCards).toContain('vertical ? 64 : 58');
    expect(creatorCards).toContain('vertical ? 56 : 60');
    expect(creatorCards).toContain('const headlineProgress = easeOutCubic(progress / 0.055);');
    expect(creatorCards).toContain('const startProgress = smoothStep((progress - 0.79) / 0.15);');
    expect(liveRenderer).not.toContain('drawFighterNameplates');
    expect(liveRenderer).not.toContain('resolveMatchupHook');
  });
});
