# Stage 8.8D Change Manifest

## Modified

- `apps/game/src/features/battle/BattleSetupDrawer.tsx`
  - groups presentation settings by purpose
  - moves touch-specific options into Player Controls
- `apps/game/src/app/AppWorkspace.tsx`
  - groups developer metrics into six diagnostic domains
  - nests AI decision samples in the Controllers group
- `apps/game/src/ui/FormControls.tsx`
  - adds the reusable stateful `DisclosureGroup`
- `apps/game/src/styles/50-refine.css`
  - adds responsive disclosure, settings-group and metric-group styling
- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `tests/content-and-modes.test.ts`
- `tests/stage8-8c-match-intro.test.ts`
  - keeps the historical compatibility check release-independent

## Added

- `tests/stage8-8d-settings-metrics.test.ts`
- `docs/V1_3_STAGE_8_8D_SETTINGS_METRICS.md`
- `docs/STAGE_8_8D_CHANGE_MANIFEST.md`

## Not changed

- setting schema or persisted setting keys
- simulation, AI, physics or combat balance
- replay data or deterministic outcomes
- README
