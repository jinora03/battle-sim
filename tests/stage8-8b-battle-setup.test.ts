import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, getFighter, getFighterModule } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';
import { DEFAULT_BATTLE_SETUP } from '../apps/game/src/runtime/BattleSetup';

describe('Stage 8.8B battle setup UX', () => {
  it('uses the requested Gunner tuned loadout against standard Bomber in the small arena', () => {
    const expectedModules = ['shoulder-missile-pod', 'deflector-plate', 'recoil-thrusters', 'targeting-drone'];

    expect(DEFAULT_BATTLE_SETUP).toMatchObject({
      fighterAId: 'gunner',
      fighterBId: 'bomber',
      arenaId: 'iron-pit',
      modeId: 'duel',
      controllerA: 'player',
      controllerB: 'ai',
      teamSizeA: 1,
      teamSizeB: 1
    });
    expect(DEFAULT_BATTLE_SETUP.moduleIdsA).toEqual(expectedModules);
    expect(DEFAULT_BATTLE_SETUP.moduleIdsB).toEqual([]);

    for (const moduleId of expectedModules) {
      expect(getFighterModule(moduleId).compatibleFighterIds).toContain('gunner');
    }
    expect(getFighter('gunner').moduleSlots).toBeDefined();
  });

  it('collapses each module slot and summarizes the active selection', () => {
    const moduleSource = readFileSync(new URL('../apps/game/src/features/battle/FighterModuleSelectors.tsx', import.meta.url), 'utf8');

    expect(moduleSource).toContain('<details className={`fighter-module-field');
    expect(moduleSource).toContain("selectedModule?.name ?? 'Standard configuration'");
    expect(moduleSource).toContain('fighter-module-field-content');
  });

  it('shows a body-only fighter preview with passive and skills beneath both selectors', () => {
    const drawerSource = readFileSync(new URL('../apps/game/src/features/battle/BattleSetupDrawer.tsx', import.meta.url), 'utf8');
    const previewSource = readFileSync(new URL('../apps/game/src/features/battle/BattleFighterPreview.tsx', import.meta.url), 'utf8');

    expect(drawerSource.match(/<BattleFighterPreview/g)?.length).toBe(2);
    expect(previewSource).toContain('getPrimaryAttack');
    expect(previewSource).toContain('getPassive');
    expect(previewSource).toContain('getSkillPresentation');
    expect(previewSource).toContain('<FighterPortrait');
    expect(previewSource).not.toContain('Tuned Version');
    expect(previewSource).not.toContain('modules.map');
  });

  it('moves the configured-battle action into Battle Setup', () => {
    const drawerSource = readFileSync(new URL('../apps/game/src/features/battle/BattleSetupDrawer.tsx', import.meta.url), 'utf8');
    const workspaceSource = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');

    expect(drawerSource).toContain('battle-setup-start-zone-top');
    expect(drawerSource.indexOf('battle-setup-start-zone-top')).toBeLessThan(drawerSource.indexOf('htmlFor="fighter-a"'));
    expect(drawerSource).toContain('onStartConfiguredBattle');
    expect(workspaceSource).toContain('onStartConfiguredBattle={startConfiguredBattle}');
    expect(workspaceSource).not.toContain('className="battle-start-button"');
  });

  it('keeps content and engine versions aligned', () => {
    expect(CONTENT_VERSION).toMatch(/^1\.3\.\d+-stage8\./);
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
