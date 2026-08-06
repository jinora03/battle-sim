# Stage 8.8G UI Polish — Change Manifest

## Release markers

- Version: `1.3.27-stage8.8g`
- Suggested branch: `fix/8.8g-ui-polish`
- Scope: release UI, responsive layout, preview presentation, and input settings only
- Simulation behavior: unchanged

## User-facing changes

### Shared fighter presentation

- Reworked `FighterPortrait` into one reusable body-only preview renderer.
- Removed primary weapons and mounted modules from Battle Setup, match intro, Roster, and Creator preview art.
- Aligned preview body geometry with the Pixi fighter body language: circular shell, recipe colors, inner shape marks, core, aura, and horns.
- Replaced Bomber's dotted preview treatment with the same solid inner ring and vent language used by gameplay.

### Battle setup and status

- Moved `Start new battle` / `Start configured battle` ahead of Team 1 selection.
- Rebuilt the setup fighter summary around body, passive, and compact skill slots only.
- Added a focused `BattleObjectiveHeader` component for mode, matchup, team health, and alive-count spacing.
- Reduced module helper text and dropdown typography while preserving the full loadout editor.

### Mobile Battle and Ability Lab controls

- Removed the floating Fight-tab mobile action dock.
- Removed the duplicated Ability Lab Pause / Fire / Reset / Setup dock and separate arrow row.
- Added `TrainingControlDeck`, which combines a directional pad with the horizontally scrollable skill tray.
- Added stable skill-tray height, bottom padding, touch-size buttons, and scroll gutters.
- Added persisted `Touch steering sensitivity` and applied it to the analog movement response.

### Roster, Creator, and settings cleanup

- Replaced collapsing Roster identity/module blocks with a bounded passive card that remains readable on narrow screens.
- Simplified the Creator live preview to the fighter body, four skills, passive, and core stats.
- Removed the release-facing developer metrics/diagnostics card and its setting.
- Added consistent internal padding to Quality, Presentation, and Tools setting groups.

## Code organization

New focused components:

- `apps/game/src/features/battle/BattleObjectiveHeader.tsx`
- `apps/game/src/features/training/TrainingControlDeck.tsx`

New focused style layers:

- `apps/game/src/styles/70-fighter-previews.css`
- `apps/game/src/styles/71-battle-status.css`
- `apps/game/src/styles/72-mobile-controls.css`

The change intentionally avoids expanding `AppWorkspace.tsx`, `TrainingLabView.tsx`, or the existing broad style sheets with another large inline implementation.

## Settings migration

- `AppSettings.schemaVersion`: `10` → `11`
- Storage key: `kinetic.app-settings.v10` → `kinetic.app-settings.v11`
- Added `touchSteeringSensitivity`, normalized to `0.6–1.6`, default `1.0`.
- Removed the persisted `showPerformanceHud` release setting; older settings remain safely normalized during migration.

## Validation performed

- `node scripts/lint.mjs` — passed
- TypeScript/TSX syntax transpilation over all changed source and test files — passed
- PostCSS parsing for the three new style sheets — passed
- `git diff --check` — passed
- Patch application against clean commit `be56f01` — passed

A complete `npm ci` / `npm run check` could not be run in the assessment container because the configured package artifact endpoint returned `404` for `vite-8.1.5.tgz`. No dependency or lockfile workaround was applied.

## Follow-up refinement

- Standardized preview body scale across fighters; gameplay radius no longer changes UI portrait size.
- Reworked Battle Setup previews into a vertical composition with a dedicated body stage above passive and skills.
- Restored large body-only match-intro portraits and removed the obsolete intro weapon/attachment CSS path.
- Reflowed the objective header into a full-width matchup row with team lanes beneath it.
- Reduced module selector, `Start new battle`, and `Reset recommended settings` control sizing.
- Switched Roster cards to one-column composition at narrow widths so browser zoom and mobile layouts do not compress content into a thin strip.

- Replaced the compressed setup skill tiles with a single horizontally scrollable skill row.
- Replaced generic `Team 1` / `Team 2` lane labels with the corresponding fighter names.
- Removed the compact setup portrait aura so it cannot be mistaken for the reverted Stage 8.9 combat-bloom experiment; no combat VFX files were changed.
