import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stage 8.11AC final creator polish', () => {
  it('uses the requested fresh export defaults', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(hook).toContain("useState<VideoExportQuality>('maximum')");
    expect(hook).toContain('const [backgroundMusicEnabled, setBackgroundMusicEnabledState] = useState(false);');
    expect(hook).toContain("useState<VideoExportCameraMode>('broadcast')");
    expect(hook).toContain("useState<CreatorExportPresetId>('custom')");
  });

  it('includes fighter names in exported video and thumbnail filenames', () => {
    const hook = readFileSync(new URL('../apps/game/src/hooks/useReplayVideoExport.ts', import.meta.url), 'utf8');

    expect(hook).toContain('createFighterFilenameSegment');
    expect(hook).toContain("return `${fighterNames[0]}-vs-${fighterNames[1]}`");
    expect(hook).toContain('`kinetic-battle-${fighterSegment}${seed >>> 0}-');
  });

  it('opens the full layout preview inside the app instead of a new browser page', () => {
    const panel = readFileSync(new URL('../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/77-video-export.css', import.meta.url), 'utf8');

    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).toContain('FULL FRAME PREVIEW');
    expect(panel).not.toContain('target="_blank"');
    expect(styles).toContain('.video-export-layout-preview-modal');
  });
});
