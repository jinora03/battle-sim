import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

describe('Stage 8.8C configured match intro', () => {
  it('uses the shared body-only portrait while retaining fighter identity', () => {
    const introSource = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const workspaceSource = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');

    expect(introSource).toContain('<FighterPortrait');
    expect(introSource).toContain('battle-intro-identity');
    expect(introSource).not.toContain('getPrimaryAttack');
    expect(introSource).not.toContain('getFighterModule');
    expect(introSource).not.toContain('Tuned Version');
    expect(workspaceSource).not.toContain('moduleIdsA={introSetup.moduleIdsA}');
    expect(workspaceSource).not.toContain('moduleIdsB={introSetup.moduleIdsB}');
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

  it('faces the shared portraits toward one another without rendering weapons', () => {
    const introSource = readFileSync(new URL('../apps/game/src/BattleIntroOverlay.tsx', import.meta.url), 'utf8');
    const portraitSource = readFileSync(new URL('../apps/game/src/ui/FighterPortrait.tsx', import.meta.url), 'utf8');

    expect(introSource).toContain("facing={side === 'a' ? 'right' : 'left'}");
    expect(portraitSource).toContain('facing-${facing}');
    expect(portraitSource).not.toContain('shared-portrait-weapon');
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toMatch(/^1\.3\.\d+-stage8\./);
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
