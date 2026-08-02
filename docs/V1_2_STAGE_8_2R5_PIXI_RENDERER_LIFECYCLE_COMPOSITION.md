# Stage 8.2R5 — Pixi Renderer Lifecycle and Composition

## Purpose

Stage 8.2R5 turns `packages/renderer-pixi/src/index.ts` into a small public facade while preserving the renderer API and presentation behavior established through Stage 8.2R4.

This is a structural refactor only. It does not intentionally change simulation, fighter balance, content, replay data, settings schema, arena art, camera behavior, effects, attachments, health rings, damage numbers, or targeting visuals.

## Result

`packages/renderer-pixi/src/index.ts` is reduced from roughly 1,016 lines to roughly 460 lines.

The facade continues to expose the same operations:

- `init`
- `attachHost`
- `setActive`
- `setArena`
- `setSettings`
- `setPerformanceScale`
- player aim/preview methods
- training debug configuration
- `render`
- `reset`
- `destroy`
- `getDiagnostics`

## Extracted responsibilities

### `runtime/RendererLifecycle.ts`

Owns Pixi application and DOM lifecycle details:

- asynchronous `Application.init()`
- host attachment and canvas remounting
- active/inactive canvas behavior
- resize observation and no-op resize guards
- device-resolution synchronization
- viewport/orientation listeners
- safe destruction during asynchronous initialization

### `runtime/RendererContextRecovery.ts`

Owns WebGL context-loss and context-restoration listeners.

### `runtime/RendererSettingsController.ts`

Owns immutable presentation-setting snapshots, settings change classification, adaptive performance scale, and effective canvas-resolution calculation.

### `runtime/PixiStageComposition.ts`

Owns the Pixi container hierarchy and the one-time composition of arena, fighters, effects, telegraphs, targeting, training debug, and screen-space layers.

### `diagnostics/RenderDiagnosticsTracker.ts`

Owns the diagnostics value and public snapshot copies while preserving the existing `RenderDiagnostics` export.

### `projectiles/ProjectileLayer.ts`

Owns pooled projectile graphics and the existing projectile drawing rules.

### `effects/FighterTrailLayer.ts`

Owns normal trails, protected knockback trails, event-driven trail lifetime, and trail cleanup.

### `effects/ScreenFlashLayer.ts`

Owns screen-flash intensity, decay, and drawing.

### `debug/TrainingDebugLayer.ts`

Owns training ranges, hitboxes, projectile paths, and the existing `TrainingDebugOptions` export.

### `targeting/PlayerTargetingLayer.ts`

Owns mouse/touch targeting graphics, range previews, crosshair drawing, and player hitmarker presentation.

## Lifecycle safety

The pre-initialization camera-follow regression guard remains in the public facade:

- settings can synchronize before `Application.init()` resolves;
- `app.screen` is read only when `RendererLifecycle.initialized` is true;
- the camera snap request is still retained for the first valid layout.

The public facade retains the idempotent `initPromise` guard, while the lifecycle module owns Pixi and DOM details.

## Test ownership update

The viewport/renderer no-op resize architecture assertion now reads `runtime/RendererLifecycle.ts`, where the unchanged `if (!sizeChanged && !resolutionChanged) return` guard lives.

No expectation or threshold was weakened.
