import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BroadcastFighterView } from '@kinetic/video-export';
import {
  BROADCAST_LAYOUTS,
  createStage810hExportSettings,
  getCreatorLayoutGeometry,
  resolveCreatorDisplayName,
  resolveCreatorFighterName,
  resolveCreatorLiveStatus,
  resolveMatchupHook
} from '@kinetic/video-export';

function fighter(overrides: Partial<BroadcastFighterView> = {}): BroadcastFighterView {
  return {
    entityId: 1,
    team: 1,
    fighterId: 'pyro-brawler',
    name: 'Pyro',
    identity: 'Fire · Heat Combo Bruiser',
    weaponName: 'Flame Jet',
    weaponId: 'flame-fists',
    visual: {
      shape: 'orb',
      bodyColor: 0,
      bodyDarkColor: 0,
      coreColor: 0,
      auraColor: 0,
      accentColor: 0,
      horns: false
    },
    memberCount: 1,
    hp: 900,
    maxHp: 1000,
    hpRatio: 0.9,
    alive: true,
    abilities: [
      { id: 'flame-fists', name: 'Flame Jet', slot: 'basic', phase: 'ready', readiness: 1 },
      { id: 'cinder-rush', name: 'Cinder Rush', slot: 'skill1', phase: 'casting', readiness: 0.4 },
      { id: 'inferno-drive', name: 'Inferno Drive', slot: 'ultimate', phase: 'cooldown', readiness: 0.72 }
    ],
    resource: { id: 'heat', name: 'Heat', value: 61, maximum: 100, ratio: 0.61 },
    statuses: [
      { id: 'burn', name: 'Burn', stacks: 2 },
      { id: 'frozen', name: 'Frozen', stacks: 1 }
    ],
    ...overrides
  };
}

const matchupFighter = (fighterId: string, name: string, identity: string) => ({ fighterId, name, identity });

describe('Stage 8.12A Shorts V2 arena-first presentation', () => {
  it('replaces the old vertical skill dashboard with a short live-status strip', () => {
    const vertical = BROADCAST_LAYOUTS.vertical;
    const geometry = getCreatorLayoutGeometry(vertical);
    expect(vertical.arena).toEqual({ x: 40, y: 330, width: 1000, height: 1150 });
    expect(vertical.arena.height / 1000).toBeCloseTo(1.15, 5);
    expect(geometry.id).toBe('vertical');
    if (geometry.id !== 'vertical') throw new Error('Expected vertical geometry.');
    expect(geometry.liveStatusPanels.left.height).toBe(118);
    expect(geometry.liveStatusPanels.left.y).toBeGreaterThan(vertical.arena.y + vertical.arena.height);

    const verticalRenderer = readFileSync(new URL('../packages/video-export/src/renderers/verticalBroadcastRenderer.ts', import.meta.url), 'utf8');
    const broadcastRenderer = readFileSync(new URL('../packages/video-export/src/broadcastRenderer.ts', import.meta.url), 'utf8');
    expect(verticalRenderer).toContain('drawVerticalLiveStatus(');
    expect(verticalRenderer).not.toContain('drawVerticalSkillsPanel(');
    expect(verticalRenderer).toContain('MATCHUP_OVERLAY_TICKS = 90');
    expect(verticalRenderer).toContain('MATCHUP_FADE_START_TICK = 60');
    expect(verticalRenderer).toContain('MATCHUP_OVERLAY_OFFSET_Y = 118');
    expect(verticalRenderer).toContain('smoothStep(fadeProgress)');
    expect(verticalRenderer).toContain('resolveMatchupHook(scene.left, scene.right)');
    expect(broadcastRenderer).toContain('? 1.15');
    expect(broadcastRenderer).toContain('applyVerticalFighterScale(');
    expect(broadcastRenderer).toContain('this.cameraMaxZoom / Math.max(1, frame.zoom)');
  });

  it('shows authoritative active action, one deterministic important status and one useful resource', () => {
    expect(resolveCreatorLiveStatus(fighter())).toEqual({
      action: 'Cinder Rush · ACTIVE',
      status: 'Frozen',
      resource: 'Heat 61%'
    });

    const noResource = resolveCreatorLiveStatus(fighter({
      resource: null,
      statuses: [],
      abilities: [
        { id: 'basic', name: 'Primary', slot: 'basic', phase: 'ready', readiness: 1 },
        { id: 'ultimate', name: 'Ultimate', slot: 'ultimate', phase: 'cooldown', readiness: 0.46 }
      ]
    }));
    expect(noResource).toEqual({ action: 'Ready', status: null, resource: 'Ult 46%' });
  });

  it('uses the final viewer-facing matchup vocabulary and preserves side order', () => {
    const pyro = matchupFighter('pyro-brawler', 'Pyro', 'Fire · Heat Combo Bruiser');
    const bomber = matchupFighter('bomber', 'Bomber', 'Neutral · Demolition');
    const gunner = matchupFighter('gunner', 'Gunner', 'Metal · Ranged Striker');
    const solar = matchupFighter('solar-sentinel', 'Solar Sentinel', 'Fire / Metal · Solar Guardian');
    const frost = matchupFighter('frost-warden', 'Frost Warden', 'Ice · Controller');
    const blade = matchupFighter('blade-vanguard', 'Blade Vanguard', 'Steel · Duelist');
    const lancer = matchupFighter('iron-lancer', 'Iron Lancer', 'Steel · Charger');

    expect(resolveMatchupHook(pyro, bomber)).toBe('FIRE vs BOMBS');
    expect(resolveMatchupHook(bomber, pyro)).toBe('BOMBS vs FIRE');
    expect(resolveMatchupHook(frost, bomber)).toBe('ICE vs BOMBS');
    expect(resolveMatchupHook(gunner, bomber)).toBe('GUNS vs BOMBS');
    expect(resolveMatchupHook(solar, gunner)).toBe('LASERS vs GUNS');
    expect(resolveMatchupHook(solar, bomber)).toBe('LASERS vs BOMBS');
    expect(resolveMatchupHook(blade, lancer)).toBe('SWORD vs SPEAR');
    expect(resolveMatchupHook(lancer, blade)).toBe('SPEAR vs SWORD');
  });


  it('uses simple creator display names without renaming authored fighter data', () => {
    expect(resolveCreatorFighterName(fighter())).toBe('Fire');
    expect(resolveCreatorDisplayName('bomber', 'Bomber')).toBe('Bomb');
    expect(resolveCreatorDisplayName('gunner', 'Gunner')).toBe('Gun');
    expect(resolveCreatorDisplayName('solar-sentinel', 'Solar Sentinel')).toBe('Laser');
    expect(resolveCreatorDisplayName('rocket-vanguard', 'Rocket Vanguard')).toBe('Missile');
    expect(resolveCreatorDisplayName('blade-vanguard', 'Blade Vanguard')).toBe('Sword');
    expect(resolveCreatorDisplayName('iron-lancer', 'Iron Lancer')).toBe('Spear');
    expect(resolveCreatorDisplayName('custom-fighter', 'Custom Fighter')).toBe('Custom Fighter');

    const team = fighter({ memberCount: 2, name: 'Team 1' });
    expect(resolveCreatorFighterName(team)).toBe('Team 1');
  });

  it('renders vertical header as centered fighter body/name plus a thin HP bar', () => {
    const hud = readFileSync(new URL('../packages/video-export/src/renderers/fighterHud.ts', import.meta.url), 'utf8');
    const start = hud.indexOf('export function drawVerticalFighterHeader');
    const end = hud.indexOf('function drawLandscapeWeaponBlock', start);
    const verticalHeader = hud.slice(start, end);
    expect(verticalHeader).toContain('drawBroadcastFighterBody(');
    expect(verticalHeader).toContain('resolveCreatorFighterName(fighter)');
    expect(verticalHeader).toContain('drawHpBar(');
    expect(verticalHeader).not.toContain('fighter.weaponName');
    expect(verticalHeader).not.toContain('fighter.identity');
  });

  it('keeps Shorts intro off by default but retains explicit manual intro support', () => {
    const shorts = createStage810hExportSettings({}, { preset: 'shorts' });
    const manualIntro = createStage810hExportSettings({}, { preset: 'shorts', intro: true });
    expect(shorts.creator.introSeconds).toBe(0);
    expect(manualIntro.creator.introSeconds).toBe(1.5);
  });

  it('leaves landscape geometry and live gameplay renderer outside the redesign', () => {
    expect(BROADCAST_LAYOUTS.landscape.arena).toEqual({ x: 350, y: 48, width: 1220, height: 984 });
    const liveRenderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    expect(liveRenderer).not.toContain('resolveCreatorLiveStatus');
    expect(liveRenderer).not.toContain('resolveMatchupHook');
  });
});
