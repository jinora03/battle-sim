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

  it('removes the redundant elimination sentence from the battle objective bar', () => {
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');

    expect(workspace).not.toContain('Win by elimination');
    expect(workspace).not.toContain('`${eliminationProgress.alive}/${eliminationProgress.total} alive');
    expect(workspace).toContain("diagnostics.battleEnded || activeMode?.victory !== 'LAST_TEAM_STANDING'");
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toBe('1.3.26-stage8.8f');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
