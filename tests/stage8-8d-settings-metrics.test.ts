import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Stage 8.8D settings and metrics organization', () => {
  it('groups settings by purpose while keeping touch controls with player input', () => {
    const source = read('../apps/game/src/features/battle/BattleSetupDrawer.tsx');

    for (const group of ['Rendering', 'Effects', 'Camera', 'Comfort', 'Audio']) {
      expect(source).toContain(`eyebrow="${group}"`);
    }
    expect(source.match(/id="touch-controls-mode"/g)?.length).toBe(1);
    expect(source.indexOf('id="touch-controls-mode"')).toBeLessThan(source.indexOf('className="panel-section collapsible-panel release-settings"'));
    expect(source).toContain('Reset recommended settings');
    expect(source).not.toContain('eyebrow="Developer"');
    expect(source).not.toContain('Developer Diagnostics');
  });

  it('removes the developer metrics card from the release workspace', () => {
    const source = read('../apps/game/src/app/AppWorkspace.tsx');

    expect(source).not.toContain('battle-debug-panel');
    expect(source).not.toContain('Performance & simulation metrics');
    expect(source).not.toContain('Export replay JSON');
    expect(source).toContain('battle-activity-panel');
  });

  it('uses reusable stateful disclosure groups instead of fragile static open attributes', () => {
    const source = read('../apps/game/src/ui/FormControls.tsx');
    const styles = read('../apps/game/src/styles/50-refine.css');

    expect(source).toContain('export function DisclosureGroup');
    expect(source).toContain('useState(defaultOpen)');
    expect(source).toContain('onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}');
    expect(styles).toContain('.settings-group-list');
    expect(styles).toContain('.disclosure-group-summary');
  });

  it('keeps content and engine compatibility markers aligned', () => {
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
    expect(CONTENT_VERSION).toMatch(/^1\.3\./);
  });
});
