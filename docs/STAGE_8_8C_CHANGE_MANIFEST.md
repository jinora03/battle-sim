# Stage 8.8C Change Manifest

Version: `1.3.23-stage8.8c`

## Modified

- `apps/game/src/BattleIntroOverlay.tsx`
  - Adds configured module input, tuned naming, fighter identity, primary weapon labels, body-template classes, inward-facing weapon silhouettes, and module attachments.
- `apps/game/src/app/AppWorkspace.tsx`
  - Passes the active/configured module selections to the intro.
- `apps/game/src/styles/60-battle-intro.css`
  - Redesigns the responsive intro layout and removes generic capsules/dotted targeting circles.
- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `tests/content-and-modes.test.ts`
- `tests/stage8-8b-battle-setup.test.ts`
  - Stops pinning a historical UX test to one global content version.

## Added

- `tests/stage8-8c-match-intro.test.ts`
- `docs/V1_3_STAGE_8_8C_MATCH_INTRO.md`
- `docs/STAGE_8_8C_CHANGE_MANIFEST.md`

## Excluded

- `README.md`
- Gameplay and balance content
- Renderer simulation behavior
