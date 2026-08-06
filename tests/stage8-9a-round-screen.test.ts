import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyViewport } from '@kinetic/platform';

describe('Stage 8.9A round-screen and near-square UI', () => {
  it('classifies watch-sized viewports without changing ordinary phone profiles', () => {
    expect(classifyViewport(450, 450)).toMatchObject({
      orientation: 'landscape',
      viewportClass: 'compact',
      displayShape: 'near-square',
      compact: true,
      shortLandscape: true
    });
    expect(classifyViewport(450, 450, true).displayShape).toBe('round');
    expect(classifyViewport(390, 844).displayShape).toBe('rectangular');
    expect(classifyViewport(844, 390).displayShape).toBe('rectangular');
  });

  it('limits near-square fallback detection to compact watch-class dimensions', () => {
    expect(classifyViewport(560, 500).displayShape).toBe('near-square');
    expect(classifyViewport(700, 700).displayShape).toBe('rectangular');
    expect(classifyViewport(520, 400).displayShape).toBe('rectangular');
  });

  it('publishes display shape through the existing environment lifecycle', () => {
    const controller = readFileSync(new URL('../apps/game/src/app/AppController.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');
    expect(controller).toContain("window.matchMedia?.('(shape: round)')");
    expect(controller).toContain('document.documentElement.dataset.displayShape = viewportMetrics.displayShape;');
    expect(workspace).toContain('display-${viewportMetrics.displayShape}');
  });

  it('keeps round-screen styles separated by shell, Battle, and Ability Lab ownership', () => {
    const main = readFileSync(new URL('../apps/game/src/main.tsx', import.meta.url), 'utf8');
    const shell = readFileSync(new URL('../apps/game/src/styles/73-compact-shape-shell.css', import.meta.url), 'utf8');
    const battle = readFileSync(new URL('../apps/game/src/styles/74-compact-shape-battle.css', import.meta.url), 'utf8');
    const training = readFileSync(new URL('../apps/game/src/styles/75-compact-shape-training.css', import.meta.url), 'utf8');

    expect(main).toContain("import './styles/73-compact-shape-shell.css';");
    expect(main).toContain("import './styles/74-compact-shape-battle.css';");
    expect(main).toContain("import './styles/75-compact-shape-training.css';");
    expect(shell).toContain('@media (shape: round)');
    expect(shell).toContain("html[data-display-shape='round']");
    expect(shell).toContain('.ui-mobile-drawer.open');
    expect(battle).toContain('aspect-ratio: 1;');
    expect(battle).toContain('.view-battle .arena-frame');
    expect(battle).toContain('.touch-skill-row');
    expect(training).toContain('.view-training .training-arena-frame');
    expect(training).toContain('.training-control-surface');
  });
});
