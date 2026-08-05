import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';
import { resolveFreshRematchSeed } from '../apps/game/src/features/battle/battleUtils';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Stage 8.8F rematch and HUD cleanup', () => {
  it('guarantees that rematch receives a different valid seed', () => {
    expect(resolveFreshRematchSeed(42, 9001)).toBe(9001);
    expect(resolveFreshRematchSeed(42, 42)).toBe(43);
    expect(resolveFreshRematchSeed(0xffffffff, 0xffffffff)).toBe(1);
    expect(resolveFreshRematchSeed(0, 0)).toBe(2);
  });

  it('keeps exact-seed replay separate from the fresh-seed rematch action', () => {
    const controller = read('../apps/game/src/app/AppController.tsx');
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');

    expect(controller).toContain('const replaySameBattle = () =>');
    expect(controller).toContain('launchBattle(activeSeedRef.current, activeSetup)');
    expect(controller).toContain('const rematchBattle = () =>');
    expect(controller).toContain('resolveFreshRematchSeed(activeSeedRef.current, generateRandomSeed())');
    expect(workspace).toContain('onClick={replaySameBattle}>Replay same seed');
    expect(workspace).toContain('onClick={rematchBattle} title="Same matchup and loadout with a fresh seed">Rematch');
  });

  it('keeps the battle objective concise and delegates its spacing to a focused component', () => {
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');
    const objective = read('../apps/game/src/features/battle/BattleObjectiveHeader.tsx');

    expect(workspace).not.toContain('Win by elimination');
    expect(workspace).toContain('<BattleObjectiveHeader');
    expect(objective).toContain('{team.alive}/{team.total} alive');
    expect(objective).toContain('fighterAName');
    expect(objective).toContain('fighterBName');
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toBe('1.3.27-stage8.8g');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
