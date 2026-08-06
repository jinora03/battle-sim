import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUICK_BATTLES } from '../apps/game/src/features/home/quickBattles';
import { DEFAULT_BATTLE_SETUP } from '../apps/game/src/runtime/BattleSetup';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Stage 8.9A mobile follow-up polish', () => {
  it('shares the recommended Gunner versus Bomber setup with the first quick battle', () => {
    const firstQuickBattle = QUICK_BATTLES[0];

    expect(firstQuickBattle).toBeDefined();
    expect(firstQuickBattle).toMatchObject({
      fighterAId: DEFAULT_BATTLE_SETUP.fighterAId,
      fighterBId: DEFAULT_BATTLE_SETUP.fighterBId,
      arenaId: DEFAULT_BATTLE_SETUP.arenaId,
      modeId: DEFAULT_BATTLE_SETUP.modeId,
      teamSizeA: DEFAULT_BATTLE_SETUP.teamSizeA,
      teamSizeB: DEFAULT_BATTLE_SETUP.teamSizeB,
      controllerA: DEFAULT_BATTLE_SETUP.controllerA,
      controllerB: DEFAULT_BATTLE_SETUP.controllerB
    });
    expect(firstQuickBattle?.moduleIdsA).toEqual(DEFAULT_BATTLE_SETUP.moduleIdsA);
    expect(firstQuickBattle?.moduleIdsB).toEqual(DEFAULT_BATTLE_SETUP.moduleIdsB);
  });

  it('pauses the active battle while the mobile setup drawer owns the screen', () => {
    const controller = read('../apps/game/src/app/AppController.tsx');
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');

    expect(controller).toContain("if (battleLaunchPhase === 'running' && !diagnostics.battleEnded) setPausedByUser(true);");
    expect(controller).toContain('const closeBattleSetup = () =>');
    expect(workspace).toContain('deviceCapabilities.touchFirst && !battleDrawerOpen');
    expect(workspace).toContain('onClose={closeBattleSetup}');
    expect(workspace).toContain('onClick={replaySameBattle}>Replay</NeonButton>');
  });

  it('contains roster portraits and presents a polished landscape hint', () => {
    const previewStyles = read('../apps/game/src/styles/70-fighter-previews.css');
    const mobileStyles = read('../apps/game/src/styles/72-mobile-controls.css');
    const hint = read('../apps/game/src/features/battle/LandscapeHint.tsx');

    expect(previewStyles).toContain('.release-fighter-portrait {');
    expect(previewStyles).toContain('contain: paint;');
    expect(previewStyles).toContain('--portrait-size: 94px');
    expect(hint).toContain('More room in landscape');
    expect(mobileStyles).toContain('.landscape-hint-copy');
    expect(mobileStyles).toContain('.landscape-hint-phone');
  });
});
