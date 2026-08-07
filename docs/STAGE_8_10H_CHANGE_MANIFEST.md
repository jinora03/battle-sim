# Stage 8.10H Change Manifest

## New files

- `packages/video-export/src/mp4Codecs.ts` — H.264/AAC WebCodecs capability probing and encoders.
- `packages/video-export/src/mp4Muxer.ts` — bounded-memory fragmented MP4 packaging.
- `packages/video-export/src/mediaPipeline.ts` — shared MP4/WebM export-container abstraction and Auto fallback.
- `tests/stage8-10h-mp4-format-fallback.test.ts` — format, muxer, fallback, UI and fixed-frame regression coverage.
- `docs/V1_3_STAGE_8_10H_MP4_FORMAT_FALLBACK.md`

## Modified files

- `packages/video-export/src/types.ts`
- `packages/video-export/src/settings.ts`
- `packages/video-export/src/webCodecs.ts`
- `packages/video-export/src/webCodecsAudio.ts`
- `packages/video-export/src/replayVideoExporter.ts`
- `packages/video-export/src/index.ts`
- `apps/game/src/hooks/useReplayVideoExport.ts`
- `apps/game/src/features/battle/BattleVideoExport.tsx`
- `apps/game/src/features/battle/replayExportHistory.ts`
- project version marker files

## Gameplay impact

None. The change is isolated to video-export encoding, container selection, UI capability messaging, download naming and export-history metadata.
