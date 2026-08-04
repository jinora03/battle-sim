import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, getFighter, getFighterModule } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

describe('Stage 8.8B battle setup UX', () => {
  it('uses the requested Gunner tuned loadout against standard Bomber in the small arena', () => {
    const controllerSource = readFileSync(new URL('../apps/game/src/app/AppController.tsx', import.meta.url), 'utf8');
    const expectedModules = ['shoulder-missile-pod', 'deflector-plate', 'recoil-thrusters', 'targeting-drone'];

    expect(controllerSource).toContain("fighterAId: 'gunner'");
    expect(controllerSource).toContain("fighterBId: 'bomber'");
    expect(controllerSource).toContain("arenaId: 'iron-pit'");
    for (const moduleId of expectedModules) {
      expect(controllerSource).toContain(`'${moduleId}'`);
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

  it('shows module-aware fighter identity, weapon, passive and skills beneath both selectors', () => {
    const drawerSource = readFileSync(new URL('../apps/game/src/features/battle/BattleSetupDrawer.tsx', import.meta.url), 'utf8');
    const previewSource = readFileSync(new URL('../apps/game/src/features/battle/BattleFighterPreview.tsx', import.meta.url), 'utf8');

    expect(drawerSource.match(/<BattleFighterPreview/g)?.length).toBe(2);
    expect(previewSource).toContain('getPrimaryAttack');
    expect(previewSource).toContain('getPassive');
    expect(previewSource).toContain('getSkillPresentation');
    expect(previewSource).toContain("' · Tuned Version'");
    expect(previewSource).toContain('modules.map');
  });

  it('moves the configured-battle action into Battle Setup', () => {
    const drawerSource = readFileSync(new URL('../apps/game/src/features/battle/BattleSetupDrawer.tsx', import.meta.url), 'utf8');
    const workspaceSource = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');

    expect(drawerSource).toContain('battle-setup-start-zone');
    expect(drawerSource).toContain('onStartConfiguredBattle');
    expect(workspaceSource).toContain('onStartConfiguredBattle={startConfiguredBattle}');
    expect(workspaceSource).not.toContain('className="battle-start-button"');
  });

  it('keeps content and engine versions aligned', () => {
    expect(CONTENT_VERSION).toBe('1.3.22-stage8.8b');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
