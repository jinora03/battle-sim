# v1.1 Stage 1 — UI and Responsive Layout

This stage implements the first section of the v1.1 polish specification. It deliberately changes the application shell and UI state management without changing deterministic simulation, physics, AI, combat, abilities, arena rules, replay input, or checksums.

## Scope completed

### Notifications

- Progression notifications now have explicit durations.
- Routine battle/info notices disappear after roughly 3.8 seconds.
- Achievements and challenges remain longer; fighter unlocks and level-ups remain longest.
- Low-priority battle notices are suppressed at compact mobile widths.
- Each notification has an accessible individual dismiss button.
- Profile notice history remains persistent independently from temporary toast visibility.

### Skill activity

The former full-width cast banner stack was removed from the arena.

Active casts now feed a compact activity rail above the arena. Repeated uses of the same skill are grouped, with ultimate skills sorted first. Large battles display a small number of grouped entries rather than one notification per fighter.

The underlying fighter-level telegraphs, skill icons and animation presentation remain unchanged.

### Accurate game-mode descriptions

Game-mode definitions now include:

- `description`
- `formatLabel`

Duel explicitly declares `1v1 only`, while its actual rule remains `minUnits: 2` and `maxUnits: 2`. Every mode has a player-facing capacity label derived from its real configured limits.

### Arena visibility

The objective label and progress bar moved into a dedicated bar above the arena.

Performance information no longer renders as an overlay. It lives in a collapsed developer panel below the arena and is hidden by default unless the saved developer-metrics setting is enabled.

Skill cast notifications also moved outside the arena. Essential touch controls remain inside the arena because they are direct gameplay input.

### Battle hierarchy

The Battle Lab now follows this flow:

1. Edit the configuration in Battle Setup.
2. Use the action bar directly above the arena.
3. Watch the unobstructed battle.
4. Review fighter/team state and optional activity panels.
5. Start a new battle or replay the exact same battle.

Changing a setup field no longer restarts the running battle immediately. The app holds two configurations:

- `setup`: the editable next-battle configuration
- `activeSetup`: the configuration used by the currently running battle

The primary action indicates when configuration changes are ready to start.

### Primary actions

The arena action bar includes:

- Start new/configured battle
- New random battle
- Replay same battle
- Jump to Battle Setup

`New random battle` selects a new available matchup and compatible arena while generating a new seed. `Replay same battle` preserves the active setup and seed.

### Developer information

Architecture proof, arena activity, achievements and performance metrics are no longer a permanent third column. They are separate expandable panels below the primary gameplay surface.

### Responsive layout

The same interface adapts rather than switching to an incomplete mobile-only implementation:

- Desktop uses a setup column and a large arena column.
- Narrow layouts place the arena first and configuration below it.
- Setup, controls and quality settings use accessible native expandable panels.
- Essential objective, battle actions, fighter health/team state and touch controls remain available.
- Low-priority developer information is collapsed rather than removed.
- Mobile action buttons use a touch-friendly grid.
- Skill activity becomes a horizontally scrollable compact rail.
- Portrait and short landscape layouts use dedicated arena sizing rules and safe-area insets.

## Architecture added

### UI presentation model

`apps/game/src/ui/presentation.ts` contains pure UI policy functions for:

- notice duration and compact-screen suppression
- game-mode capacity formatting
- active-skill grouping and prioritization

These functions are independently testable and contain no React, Pixi or simulation dependencies.

### Active versus configured battle

The application shell now explicitly separates editable setup state from active runtime state. This makes the UI predictable and gives future result/rematch/setup flows a clean boundary without changing `BattleRuntime`.

### Mode presentation metadata

Game-mode display metadata lives with mode content definitions rather than being hardcoded in React. Simulation continues to use the same min/max/victory fields.

## Important files changed

- `apps/game/src/App.tsx`
- `apps/game/src/styles.css`
- `apps/game/src/ui/presentation.ts`
- `apps/game/src/ReleaseHome.tsx`
- `packages/content/src/schemas.ts`
- `packages/content/src/data/modes/*.json`
- `tests/content-and-modes.test.ts`
- `tests/ui-stage1.test.ts`
- `scripts/lint.mjs`
- `package.json`
- `README.md`

## Intentionally not included yet

The following belong to later v1.1 stages and are not silently bundled into this stage:

- proper end-of-match winner flow
- removal of passive collision damage
- action-priority AI rewrite
- full weapon/attack architecture
- Player Mode camera-centering corrections
- touch-controller device visibility policy
- Training Mode
- layered VFX rewrite
- large-battle profiling and optimization
- real-device mobile rendering pass
