import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

describe('Stage 8.8C configured match intro', () => {
  it('uses configured modules, fighter identity and the authoritative primary attack', () => {
    const introSource = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const workspaceSource = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');

    expect(introSource).toContain('getPrimaryAttack');
    expect(introSource).toContain('getFighterModule');
    expect(introSource).toContain("' · Tuned Version'");
    expect(introSource).toContain('battle-intro-identity');
    expect(introSource).toContain('battle-intro-weapon-name');
    expect(workspaceSource).toContain('moduleIdsA={introSetup.moduleIdsA}');
    expect(workspaceSource).toContain('moduleIdsB={introSetup.moduleIdsB}');
  });

  it('removes generic team labels, dotted targeting rings and decorative side capsules', () => {
    const introSource = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/60-battle-intro.css', import.meta.url), 'utf8');

    expect(introSource).not.toContain("'Team 1'");
    expect(introSource).not.toContain("'Team 2'");
    expect(introSource).not.toContain('battle-intro-sight');
    expect(styles).not.toContain('.battle-intro-shell::before');
    expect(styles).not.toContain('.battle-intro-shell::after');
  });

  it('points authoritative weapon silhouettes toward the opposing fighter', () => {
    const introSource = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/60-battle-intro.css', import.meta.url), 'utf8');

    expect(introSource).toContain('form-${primary.form}');
    expect(introSource).toContain('shape-${visual.shape}');
    expect(styles).toContain('.battle-intro-fighter.side-a .battle-intro-weapon');
    expect(styles).toContain('.battle-intro-fighter.side-b .battle-intro-weapon');
    expect(styles).toContain('scaleX(-1)');
    expect(styles).toContain('.battle-intro-weapon.form-rifle');
    expect(styles).toContain('.battle-intro-weapon.form-launcher');
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toBe('1.3.23-stage8.8c');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
