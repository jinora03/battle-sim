# Stage 8.9A Change Manifest

## Platform

- Added `DisplayShape` and `ViewportMetrics.displayShape`.
- Extended `classifyViewport` with deterministic near-square detection and an optional round-display signal.
- Added `(shape: round)` to environment refresh subscriptions.
- Published the active shape through the app shell and `documentElement.dataset.displayShape`.

## UI styles

- Added `73-compact-shape-shell.css` for safe insets, navigation, drawers, and notifications.
- Added `74-compact-shape-battle.css` for the Battle renderer host, objective header, intro, and touch controls.
- Added `75-compact-shape-training.css` for Ability Lab renderer and control containment.

## Compatibility

- Bumped engine, content, root, app, and lockfile markers to `1.3.28-stage8.9a`.
- Added Stage 8.9A regression coverage for viewport classification and style ownership.
