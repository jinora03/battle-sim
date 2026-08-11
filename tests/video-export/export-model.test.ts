import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BattleDefinition } from '@kinetic/protocol';
import {
  createFighterFilenameSegment,
  createReplayExportFilenames,
  DEFAULT_REPLAY_VIDEO_EXPORT_SELECTIONS
} from '../../apps/game/src/hooks/replayVideoExportModel';

const matchup: BattleDefinition = {
  seed: 811_030,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'pyro-brawler', team: 1 },
    { fighterId: 'bomber', team: 2 }
  ]
};

describe('creator export model and preview contract', () => {
  it('uses the requested fresh export defaults', () => {
    expect(DEFAULT_REPLAY_VIDEO_EXPORT_SELECTIONS).toMatchObject({
      layout: 'vertical',
      quality: 'maximum',
      backgroundMusicEnabled: false,
      cameraMode: 'broadcast',
      preset: 'custom',
      introEnabled: false,
      highlightsEnabled: false
    });
  });

  it('includes fighter names in exported video and thumbnail filenames', () => {
    const thumbnailBlob = new Blob(['thumbnail']);
    const result = {
      audioCodec: 'opus',
      cameraMode: 'broadcast' as const,
      container: 'webm' as const,
      fps: 60 as const,
      layout: 'vertical' as const,
      resolution: '1080p' as const,
      thumbnailBlob
    };

    expect(createFighterFilenameSegment(matchup)).toBe('pyro-vs-bomber');
    expect(createReplayExportFilenames(matchup.seed, result, matchup)).toEqual({
      video: 'kinetic-battle-pyro-vs-bomber-811030-vertical-broadcast-1080p-60fps-audio.webm',
      thumbnail: 'kinetic-battle-pyro-vs-bomber-811030-vertical-broadcast-1080p-60fps-audio-thumbnail.png'
    });
  });

  it('keeps the full layout preview as an in-app modal contract', () => {
    // Until this repository adopts a DOM test environment, keep this one narrow
    // structural contract instead of asserting the component's implementation line-by-line.
    const panel = readFileSync(new URL('../../apps/game/src/features/battle/BattleVideoExport.tsx', import.meta.url), 'utf8');

    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).toContain('FULL FRAME PREVIEW');
    expect(panel).not.toContain('target="_blank"');
  });
});
