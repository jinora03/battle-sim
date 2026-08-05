# Stage 8.8F Change Manifest

Version: `1.3.26-stage8.8f`

## Production files

- `apps/game/src/features/battle/battleUtils.ts`
  - Adds `resolveFreshRematchSeed` to normalize and guarantee a seed different from the completed battle.
- `apps/game/src/app/AppController.tsx`
  - Adds a dedicated fresh-seed `rematchBattle` action while preserving exact-seed replay.
- `apps/game/src/app/AppWorkspace.tsx`
  - Routes the result-overlay Rematch button to the fresh-seed action.
  - Renames the exact replay command to `Replay same seed`.
  - Removes the redundant elimination sentence from the objective bar.
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `package.json`
- `package-lock.json`
- `apps/game/package.json`
  - Align version markers to Stage 8.8F.

## Tests

- `tests/stage8-8f-final-ux.test.ts`
  - Covers seed collisions, rematch/replay separation, HUD text removal and version alignment.
- `tests/content-and-modes.test.ts`
- `tests/stage8-8e-workshop-preview.test.ts`
  - Advance exact release-version assertions.

## Documentation

- `docs/V1_3_STAGE_8_8F_FINAL_UX.md`
- `docs/STAGE_8_8F_CHANGE_MANIFEST.md`

## Explicitly unchanged

- Fighter and ability data
- Module selections and compatibility
- AI decision logic
- Damage, cooldowns and physics
- Replay serialization and checksum behavior
- Roster and workshop rendering
