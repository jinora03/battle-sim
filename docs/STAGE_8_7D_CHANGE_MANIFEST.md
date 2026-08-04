# Stage 8.7D Change Manifest

## Release

- Version: `1.3.20-stage8.7d`
- Recommended branch: `polish/stage8.7d-readability-anti-stall-roster`
- Base: completed and hotfixed Stage 8.7C-3
- README: intentionally unchanged to avoid branch-specific documentation conflicts

## Production files

### `packages/visual-engine/src/vfx.ts`

- Expanded the reusable particle-shape union with streaks, arcs, broken ring fragments, flames, wedges, and ribbons.

### `packages/visual-engine/src/combatVfxProfiles.ts`

- Added `CombatVfxParticleStyle`.
- Added `resolveCombatVfxParticleStyle()`.
- Maps intent, palette, phase, and directional metadata to an appropriate primary/secondary shape vocabulary.

### `packages/renderer-pixi/src/effects/FxEngine.ts`

- Added reusable particle-shape drawing.
- Added particle spin state.
- Added profile-driven shaped burst, directional burst, and inward burst rendering.
- Added layered profile bloom.
- Added segmented/broken shockwave rendering.
- Replaced circle-only profile particles with intent-specific shapes while preserving legacy fallback effects.

### `packages/renderer-pixi/src/layeredVfx.ts`

- Added budgeted particle-shape drawing for low-quality and crowded battles.
- Added simplified layered bloom and broken shock rings.
- Uses the same intent-specific particle resolver as the full renderer.

### `packages/controllers/src/seededDecisionVariation.ts`

- Added `getAiCornerEscapeSign()` for deterministic lateral route selection.

### `packages/controllers/src/index.ts`

- Added ranged corner-pressure memory.
- Added pure `resolveAiCornerEscapeDirection()` helper.
- Added temporary deterministic corner-escape state for ranged/kiting AI.
- Preserved player-controller behavior.

### `apps/game/src/RosterView.tsx`

- Converted passive and approved-module sections to native collapsible disclosures.
- Modules begin collapsed and display a compatible count.
- Expanded modules render as compact chips.

### `apps/game/src/styles.css`

- Normalized fighter-card grid rows.
- Prevented neighboring cards from stretching to the height of the longest card.
- Added disclosure, chevron, module-chip, and mobile-reset styling.

## Version files

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `tests/content-and-modes.test.ts`

All compatibility markers were advanced from `1.3.19-stage8.7c3` to `1.3.20-stage8.7d`.

## Tests

### `tests/stage8-7d-readability-anti-stall-roster.test.ts`

Covers:

- intent-specific angular particle selection;
- full and budgeted renderer integration;
- deterministic inward corner escape;
- seeded side-route variation;
- AI corner-pressure state integration;
- collapsible and normalized roster layout;
- synchronized engine/content version markers.

## Deliberately unchanged

- Fighter and ability JSON
- Damage and health values
- Cooldowns and ranges
- Physics constants
- Status values
- Player controls
- README

## Determinism note

The corner escape is deterministic but changes AI movement under a newly handled condition. Therefore old Stage 8.7C-3 final checksums are not expected to remain identical for battles that trigger this behavior. Same-version, same-seed replay determinism remains the requirement.
