# Stage 8.10A Change Manifest

## New package

- `packages/video-export/src/replayFrameStepper.ts` — fixed one-tick-per-frame replay stepping
- `packages/video-export/src/webCodecs.ts` — VP9/VP8 capability detection and frame encoding
- `packages/video-export/src/webmMuxer.ts` — bounded in-memory WebM packaging
- `packages/video-export/src/replayVideoExporter.ts` — renderer, encoder, progress, cancellation, checksum, and cleanup orchestration
- `packages/video-export/src/settings.ts` — Stage 8.10A preset and safeguards
- `packages/video-export/src/types.ts` — public export contracts

## Renderer integration

- fixed output dimensions independent of host viewport
- resolution override for one physical pixel per export pixel
- explicit export-frame rendering and canvas access
- normal interactive renderer behavior remains unchanged

## Game integration

- immutable replay export source from `BattleRuntime`
- browser capability detection
- export progress, ETA, cancellation, error state, and automatic download
- new replay-video panel before developer metrics

## Simulation scope

No fighter content, damage, cooldown, AI, movement, knockback, arena, or mode behavior is changed. Replay completion is verified against its captured simulation checksum.
