# Stage 8.8E Change Manifest

## Added

- `apps/game/src/ui/FighterPortrait.tsx`
  - Shared data-driven fighter portrait for Creator, Battle Setup and Roster.
  - Renders body template, primary weapon and mounted module attachments.

- `tests/stage8-8e-workshop-preview.test.ts`
  - Kit-source compatibility and cross-fighter restriction coverage.
  - Shared portrait integration checks.
  - Workshop preview and version assertions.

- `docs/V1_3_STAGE_8_8E_WORKSHOP_PREVIEW.md`
- `docs/STAGE_8_8E_CHANGE_MANIFEST.md`

## Modified

- `apps/game/src/features/creator/DeveloperFighterWorkshop.tsx`
  - Reworked workshop source flow, compatibility UI, module editor and live preview.
  - Added structured statistics and loadout presentation.

- `apps/game/src/features/battle/BattleFighterPreview.tsx`
  - Uses the shared fighter portrait with selected battle modules.

- `apps/game/src/RosterView.tsx`
  - Uses the shared fighter portrait with authored default modules.

- `apps/game/src/app/AppController.tsx`
  - New prototypes use the Volt kit as their authored source.
  - Duplicated fighters retain kit provenance.
  - Imported/library recipes restore their kit source.
  - Test fights equip workshop default modules.

- `apps/game/src/styles/50-refine.css`
  - Shared portrait, weapon and attachment styling.
  - Workshop spacing, compact selects and redesigned preview card.

- `packages/content/src/schemas/fighterSchema.ts`
  - Adds optional `kitSourceFighterId`.

- `packages/content/src/loadouts/moduleCatalog.ts`
- `packages/content/src/loadouts/loadoutResolver.ts`
- `packages/content/src/registries/contentRegistry.ts`
  - Resolve inherited kit module compatibility.
  - Reject multiple default modules in one slot.

- `packages/creator/src/index.ts`
  - Validates sourced weapons, skills, passives and module catalogs.

- Version markers:
  - `package.json`
  - `package-lock.json`
  - `apps/game/package.json`
  - `packages/content/src/index.ts`
  - `packages/simulation/src/runner.ts`
  - `tests/content-and-modes.test.ts`

- `tests/stage8-8d-settings-metrics.test.ts`
  - Stops pinning a historical phase version while retaining engine/content alignment coverage.

## Intentionally unchanged

- Simulation rules and deterministic checksums.
- Fighter damage, cooldowns, movement, AI and balance.
- Arena Pixi renderer implementation.
- README, to avoid branch-drift patch failures.
