import { getFighter } from '@kinetic/content';
import type { BattleDefinition } from '@kinetic/protocol';
import type {
  BroadcastLayoutId,
  CreatorExportPresetId,
  ReplayVideoExportResult,
  VideoExportCameraMode,
  VideoExportFormat,
  VideoExportFrameRate,
  VideoExportQuality,
  VideoExportResolution
} from '@kinetic/video-export';

export interface ReplayVideoExportDefaultSelections {
  format: VideoExportFormat;
  layout: BroadcastLayoutId;
  resolution: VideoExportResolution;
  fps: VideoExportFrameRate;
  quality: VideoExportQuality;
  audioEnabled: boolean;
  backgroundMusicEnabled: boolean;
  backgroundMusicVolume: number;
  cameraMode: VideoExportCameraMode;
  cameraShakeEnabled: boolean;
  screenFlashEnabled: boolean;
  preset: CreatorExportPresetId;
  introEnabled: boolean;
  highlightsEnabled: boolean;
  captionsEnabled: boolean;
  thumbnailEnabled: boolean;
  fighterNameplatesEnabled: boolean;
}

/**
 * Fresh creator-export selections. Keep these independent from persisted or
 * runtime-derived values such as auto-download preference and generation seed.
 */
export const DEFAULT_REPLAY_VIDEO_EXPORT_SELECTIONS: Readonly<ReplayVideoExportDefaultSelections> = Object.freeze({
  format: 'auto',
  layout: 'vertical',
  resolution: '1080p',
  fps: 60,
  quality: 'maximum',
  audioEnabled: true,
  backgroundMusicEnabled: false,
  backgroundMusicVolume: 0.15,
  cameraMode: 'broadcast',
  cameraShakeEnabled: true,
  screenFlashEnabled: true,
  preset: 'custom',
  introEnabled: false,
  highlightsEnabled: false,
  captionsEnabled: true,
  thumbnailEnabled: false,
  fighterNameplatesEnabled: true
});

export interface ReplayExportFilenames {
  video: string;
  thumbnail: string | null;
}

/** Build creator export filenames from user-visible battle identity and result metadata. */
export function createReplayExportFilenames(
  seed: number,
  result: Pick<ReplayVideoExportResult,
    'audioCodec' | 'cameraMode' | 'container' | 'fps' | 'layout' | 'resolution' | 'thumbnailBlob'>,
  battle?: BattleDefinition
): ReplayExportFilenames {
  const audioSuffix = result.audioCodec ? '-audio' : '-silent';
  const fighterSegment = battle ? `${createFighterFilenameSegment(battle)}-` : '';
  const baseName = `kinetic-battle-${fighterSegment}${seed >>> 0}-${result.layout}-${result.cameraMode}-${result.resolution}-${result.fps}fps${audioSuffix}`;
  const extension = result.container === 'mp4' ? 'mp4' : 'webm';
  return {
    video: `${baseName}.${extension}`,
    thumbnail: result.thumbnailBlob ? `${baseName}-thumbnail.png` : null
  };
}

export function createFighterFilenameSegment(battle: BattleDefinition): string {
  const fighterIds: string[] = [];
  for (const participant of battle.participants) {
    if (!fighterIds.includes(participant.fighterId)) fighterIds.push(participant.fighterId);
    if (fighterIds.length >= 2) break;
  }

  const fighterNames = fighterIds.map((fighterId) => {
    let label = fighterId;
    try {
      label = getFighter(fighterId).name;
    } catch {
      // Keep the content id for custom or unavailable registry entries.
    }
    return toFilenameSlug(label);
  }).filter(Boolean);

  if (fighterNames.length >= 2) return `${fighterNames[0]}-vs-${fighterNames[1]}`;
  return fighterNames[0] ?? 'battle';
}

function toFilenameSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
