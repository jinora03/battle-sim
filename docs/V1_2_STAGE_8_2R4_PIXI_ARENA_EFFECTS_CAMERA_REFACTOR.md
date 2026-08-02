# Stage 8.2R4 — Pixi Arena, Effects, Camera, and Event Routing Refactor

## Goal

Continue decomposing `packages/renderer-pixi/src/index.ts` without changing gameplay, balance, visual output, settings, replay data, or the `PixiBattleRenderer` public API.

## Extracted responsibilities

### `arena/ArenaView.ts`

Owns static arena art, environmental zones, debug grid rendering, destructible obstacle rendering, and obstacle cache invalidation.

### `camera/BattleCamera.ts`

Owns arena fitting, focused-fighter follow behavior, smooth camera movement, screen shake, and camera reset/snap state.

### `effects/FxEngine.ts`

Owns the pooled legacy particles, flashes, shockwaves, skill resolve effects, and reduced crowd feedback calculations.

### `effects/PresentationEventRouter.ts`

Owns mass-battle presentation budgeting, missile-cascade compaction, projectile visual selection, player-event prioritization, and per-fighter impact/damage feedback accumulation.

### `effects/SkillTelegraphRenderer.ts`

Owns cast telegraphs, ability labels, progress presentation, and telegraph cleanup.

## Facade impact

`packages/renderer-pixi/src/index.ts` remains the exported `PixiBattleRenderer` facade. It still owns Pixi application lifecycle, layer composition, fighter pooling, trails/projectiles, targeting/debug presentation, renderer resizing, diagnostics, and public methods.

The file was reduced from approximately 2,080 lines to approximately 1,016 lines.

## Behavior guarantees

- no simulation or content changes
- no fighter balance changes
- no settings schema changes
- no replay/checksum changes
- no intended visual changes
- no new runtime dependencies
- renderer startup and context recovery remain in the facade
- static obstacle caching still exits early when nothing changed

## Test adjustment

The existing architecture assertion for static obstacle caching now reads `arena/ArenaView.ts`, where that behavior lives after extraction. The assertion itself remains unchanged: the cache must still contain the early `if (!changed) return` guard.
