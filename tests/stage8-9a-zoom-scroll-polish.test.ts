import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyViewport } from '@kinetic/platform';

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Stage 8.9A zoom and horizontal-scroll polish', () => {
  it('does not mistake desktop browser zoom for a watch display', () => {
    expect(classifyViewport(450, 450, false, false).displayShape).toBe('rectangular');
    expect(classifyViewport(450, 450, false, true).displayShape).toBe('near-square');
    expect(classifyViewport(450, 450, true, false).displayShape).toBe('round');
  });

  it('uses real disclosure cards for trainer loadout and simulation controls', () => {
    const training = read('../apps/game/src/TrainingLabView.tsx');
    expect(training).toContain('training-setup-card training-settings-group');
    expect(training).toContain('training-options-card training-settings-group');
    expect(training).toContain('<DisclosureGroup eyebrow="Loadout" title="Trainer and targets" defaultOpen');
    expect(training).toContain('<DisclosureGroup eyebrow="Simulation controls" title="Rules and overlays" defaultOpen');
  });

  it('adds mouse-drag affordances to overflowing navigation and roster strips', () => {
    const neonUi = read('../apps/game/src/ui/NeonUI.tsx');
    const home = read('../apps/game/src/ReleaseHome.tsx');
    const hook = read('../apps/game/src/ui/useHorizontalDragScroll.ts');
    const styles = read('../apps/game/src/styles/76-zoom-scroll-polish.css');

    expect(neonUi).toContain('useHorizontalDragScroll<HTMLElement>()');
    expect(neonUi).toContain("'--ui-nav-count': items.length");
    expect(neonUi).not.toContain('ui-nav-scroll-hint');
    expect(styles).toContain('repeat(var(--ui-nav-count, 6), minmax(0, 1fr))');
    expect(home).toContain('useHorizontalDragScroll<HTMLDivElement>()');
    expect(hook).toContain("event.pointerType !== 'mouse'");
    expect(styles).toContain(".ui-app-navigation[data-overflow='true']");
    expect(styles).toContain(".roster-peek-strip[data-overflow='true']");
  });

  it('opens metrics by default without duplicating FPS in the header', () => {
    const metrics = read('../apps/game/src/features/battle/BattlePerformanceMetrics.tsx');
    expect(metrics).toContain('<details className="panel-section battle-debug-panel" open>');
    expect(metrics).not.toContain('<em>{diagnostics.performance.renderFps.toFixed(0)} FPS</em>');
    expect(metrics).toContain('<div className="debug-panel-fps-tile">');
  });

  it('labels and applies analog sensitivity while keeping controls compact', () => {
    const setup = read('../apps/game/src/features/battle/BattleSetupDrawer.tsx');
    const styles = read('../apps/game/src/styles/76-zoom-scroll-polish.css');
    expect(setup).toContain('Analog stick sensitivity');
    expect(setup).toContain('fullscreen-arena-button');
    expect(styles).not.toContain("input[type='range']::-webkit-slider-thumb");
    expect(styles).toContain('grid-template-columns: 112px minmax(0, 1fr)');
    expect(styles).toContain('.training-slot-scroll');
    expect(styles).toContain('.roster-peek-strip');
  });
});
