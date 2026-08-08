import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isDeveloperAccessCode } from '../apps/game/src/developerAccess';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('temporary developer access gate', () => {
  it('accepts only the temporary developer code', () => {
    expect(isDeveloperAccessCode('9725795')).toBe(true);
    expect(isDeveloperAccessCode(' 9725795 ')).toBe(true);
    expect(isDeveloperAccessCode('9725794')).toBe(false);
    expect(isDeveloperAccessCode('')).toBe(false);
  });

  it('keeps replay video export collapsed by default and gates opening it', () => {
    const source = read('apps/game/src/features/battle/BattleVideoExport.tsx');
    expect(source).toContain('<details className="panel-section battle-video-export">');
    expect(source).not.toContain('<details className="panel-section battle-video-export" open>');
    expect(source).toContain("requestDeveloperAccess('Replay video export')");
  });

  it('gates the profile developer unlock before changing progression', () => {
    const source = read('apps/game/src/ProfileView.tsx');
    expect(source).toContain("requestDeveloperAccess('unlock all fighters')");
    expect(source).toContain('onUnlockAll();');
  });
});
