import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, listFighters } from '@kinetic/content';
import { ENGINE_VERSION } from '@kinetic/simulation';

const RELEASE_VERSION = '1.3.46-stage8.12';

function readPackageVersion(relativePath: string): string {
  const packageJson = JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  ) as { version?: string };
  return packageJson.version ?? '';
}

describe('Stage 8.12 release metadata', () => {
  it('keeps release-facing engine, content and package versions synchronized', () => {
    expect(ENGINE_VERSION).toBe(RELEASE_VERSION);
    expect(CONTENT_VERSION).toBe(RELEASE_VERSION);
    expect(readPackageVersion('../../package.json')).toBe(RELEASE_VERSION);
    expect(readPackageVersion('../../apps/game/package.json')).toBe(RELEASE_VERSION);
  });

  it('ships the expected 14-fighter built-in roster', () => {
    const fighterIds = listFighters().map((fighter) => fighter.id);

    expect(fighterIds).toHaveLength(14);
    expect(fighterIds).toEqual(expect.arrayContaining([
      'pyro-brawler',
      'bomber',
      'gunner',
      'rocket-vanguard',
      'solar-sentinel',
      'ballast',
      'blade-vanguard',
      'iron-lancer'
    ]));
  });
});
