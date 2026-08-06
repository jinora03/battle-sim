import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '@kinetic/content';
import { createDefaultAppSettings, normalizeAppSettings, type DeviceCapabilities } from '@kinetic/platform';
import { ENGINE_VERSION } from '@kinetic/simulation';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const touchDevice: DeviceCapabilities = {
  mobile: true,
  coarsePointer: true,
  anyCoarsePointer: true,
  hoverCapable: false,
  touchPoints: 5,
  touchFirst: true,
  reducedMotion: false,
  hardwareConcurrency: 6,
  deviceMemoryGb: 6,
  saveData: false,
  devicePixelRatio: 3
};

describe('Stage 8.8G UI polish', () => {
  it('uses one body-only portrait across setup, intro, roster and creator surfaces', () => {
    const portrait = read('../apps/game/src/ui/FighterPortrait.tsx');
    const intro = read('../apps/game/src/BattleIntroOverlay.tsx');
    const setup = read('../apps/game/src/features/battle/BattleFighterPreview.tsx');
    const roster = read('../apps/game/src/RosterView.tsx');
    const creator = read('../apps/game/src/features/creator/DeveloperFighterWorkshop.tsx');

    expect(portrait).toContain('body-only');
    expect(portrait).not.toContain('getPrimaryAttack');
    expect(portrait).not.toContain('listMountedAttachments');
    expect(portrait).not.toContain('fighter.physics.radius');
    expect(portrait).toContain('data-fighter-id');
    expect(intro).toContain('<FighterPortrait');
    expect(setup).toContain('<FighterPortrait');
    expect(setup).toContain('size="medium"');
    expect(roster).toContain('<FighterPortrait');
    expect(creator).toContain('<FighterPortrait');
  });

  it('keeps preview scale, matchup spacing and narrow roster cards stable', () => {
    const previewStyles = read('../apps/game/src/styles/70-fighter-previews.css');
    const statusStyles = read('../apps/game/src/styles/71-battle-status.css');
    const introStyles = read('../apps/game/src/styles/60-battle-intro.css');
    const objective = read('../apps/game/src/features/battle/BattleObjectiveHeader.tsx');

    expect(previewStyles).toContain('.battle-fighter-preview-portrait .shared-fighter-portrait');
    expect(previewStyles).toContain('--portrait-size: 96px');
    expect(previewStyles).toContain('@media (max-width: 760px)');
    expect(previewStyles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(introStyles).not.toContain('--intro-size-scale');
    expect(objective).toContain('className="objective-matchup"');
    expect(objective).toContain('? fighterAName');
    expect(objective).toContain('? fighterBName');
    expect(previewStyles).toContain('.battle-fighter-preview-skills');
    expect(previewStyles).toContain('display: flex');
    expect(previewStyles).toContain('.battle-fighter-preview-portrait .shared-portrait-aura');
    expect(previewStyles).toContain('display: none');
    expect(statusStyles).toContain('.objective-matchup');
    expect(statusStyles).toContain('.battle-setup-start-button');
    expect(statusStyles).toContain('.settings-reset-button');
  });

  it('keeps mobile actions inside their owning battle and lab surfaces', () => {
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');
    const lab = read('../apps/game/src/TrainingLabView.tsx');
    const controls = read('../apps/game/src/features/training/TrainingControlDeck.tsx');

    expect(workspace).not.toContain('mobile-battle-dock');
    expect(lab).not.toContain('training-mobile-dock');
    expect(lab).not.toContain('training-touch-pad');
    expect(lab).toContain('<TrainingControlDeck');
    expect(controls).toContain('training-direction-pad');
    expect(controls).toContain('training-slot-scroll');
  });

  it('moves the new-battle action ahead of Team 1 and removes release diagnostics', () => {
    const drawer = read('../apps/game/src/features/battle/BattleSetupDrawer.tsx');
    const workspace = read('../apps/game/src/app/AppWorkspace.tsx');

    expect(drawer.indexOf('battle-setup-start-zone-top')).toBeLessThan(drawer.indexOf('htmlFor="fighter-a"'));
    expect(drawer).toContain('Touch steering sensitivity');
    expect(workspace).not.toContain('battle-debug-panel');
    expect(workspace).not.toContain('Export replay JSON');
  });

  it('persists and clamps touch steering sensitivity', () => {
    const defaults = createDefaultAppSettings(touchDevice);
    expect(defaults.schemaVersion).toBe(11);
    expect(defaults.touchSteeringSensitivity).toBe(1);
    expect(normalizeAppSettings({ touchSteeringSensitivity: 0 }, touchDevice).touchSteeringSensitivity).toBe(0.6);
    expect(normalizeAppSettings({ touchSteeringSensitivity: 9 }, touchDevice).touchSteeringSensitivity).toBe(1.6);
  });

  it('keeps engine and content markers aligned for the polish release', () => {
    expect(CONTENT_VERSION).toBe('1.3.27-stage8.8g');
    expect(CONTENT_VERSION).toBe(ENGINE_VERSION);
  });
});
