# v1.1 Stage 8 — Mobile Rendering and Responsive Polish

Stage 8 is implemented directly on the complete Stage 5 project. It preserves the deterministic simulation, Stage 3 weapons, Stage 4 player/camera behavior, and Stage 5 Ability Lab while hardening the browser/mobile presentation boundary.

Stage 6 (layered VFX) and Stage 7 (large-battle performance) are not silently marked complete by this release. Stage 8 adds the mobile-resolution and lifecycle infrastructure they can later use.

## Goals

- Keep the arena sharp without blindly rendering at the full physical device-pixel ratio.
- Make portrait, landscape, short-landscape, fullscreen and standalone layouts predictable.
- Prevent resize feedback loops and stale canvas dimensions.
- Preserve the simulation tick rate and deterministic result while presentation quality adapts.
- Make graphics interruptions and runtime diagnostics visible instead of crashing the application.
- Reduce unnecessary work when the app, tab or active view is hidden.

## Viewport policy

`@kinetic/platform` now exposes viewport metrics independent from React and Pixi:

- `portrait` or `landscape`
- `compact`, `medium` or `wide`
- compact-screen detection
- short-landscape detection
- standalone/PWA detection
- fullscreen detection

The app mirrors the current policy to HTML data attributes and root classes. CSS can therefore respond to a stable viewport classification rather than duplicating device guesses throughout components.

## Internal render resolution

The canvas has two independent sizes:

1. **CSS size** — the number of layout pixels occupied by the arena.
2. **Internal pixel size** — the number of pixels rendered by Pixi.

The effective Pixi resolution is calculated from:

```text
min(device DPR, configured DPR cap)
× configured render scale
× adaptive presentation scale
```

The result is clamped to a safe range. This prevents a high-density phone from allocating an unnecessarily large framebuffer while still allowing capable devices to render sharply.

The settings schema is now version 5 and adds `renderScale`. Existing v1–v4 settings are normalized and migrated rather than discarded.

## Quality presets

- **Battery Saver** — 30 FPS target, lower render scale, lower DPR cap and simplified presentation.
- **Balanced** — mobile-friendly resolution with normal combat readability.
- **High Quality** — full render scale with a higher DPR cap and no automatic quality reduction.
- **Custom** — independently adjustable internal render scale, DPR cap, frame target and presentation toggles.

These settings affect presentation only. They do not alter simulation tick rate, AI, hit detection, cooldowns, damage, projectiles, RNG or winner calculation.

## Pixi canvas lifecycle

The renderer no longer depends on an implicit `resizeTo` lifecycle. It now:

- initializes from a measured host rectangle;
- owns one canvas and replaces stale host children during initialization;
- schedules resize work through one animation frame;
- coalesces `ResizeObserver`, `visualViewport`, window resize, orientation and fullscreen signals;
- ignores hidden or zero-sized host measurements;
- records successful resize passes;
- removes observers, listeners, pending animation frames and the canvas during destruction.

Camera fit is recalculated only after the renderer has a valid CSS size. Stage 4 camera, shake and world transforms remain separated.

## Context interruption handling

The canvas listens for WebGL context loss and restoration. Context loss is prevented from terminating the page, reflected in renderer diagnostics and shown as a recovery badge. Restoration queues a fresh measured resize.

This does not guarantee recovery from every browser/GPU failure, but it avoids the previous unhandled presentation path and gives the application a stable state from which to recover or show the existing renderer recovery UI.

## Runtime suspension

Battle Lab and Ability Lab can now suspend presentation work when:

- the document becomes hidden;
- the page is being hidden;
- another main application view is active.

Simulation advancement, AI command generation, renderer work and audio are paused through the runtime boundary and resume without resetting the battle. Manual pause remains a separate user-controlled state.

Training Runtime also honors the selected target render FPS and throttles React-facing diagnostic updates so a 60 Hz render loop does not force a full React update every frame.

## Responsive controls

Stage 8 adds layout policies for:

- compact portrait screens;
- touch-first portrait play;
- short mobile landscape;
- fullscreen safe areas;
- horizontal navigation/action overflow;
- arena-adjacent touch controls;
- compact debug readouts.

Existing Auto / Always show / Always hide touch-control behavior remains in place. Keyboard and pointer controls are unchanged.

## Diagnostics

The developer panel and optional arena badge now expose:

- effective Pixi resolution;
- physical device-pixel ratio;
- configured render scale;
- canvas CSS width and height;
- internal canvas pixel width and height;
- portrait/landscape state;
- viewport class;
- renderer resize count;
- graphics-context state;
- application React render count;
- existing FPS, simulation, rendering, particles and LOD data.

These values are intended for browser emulation and physical-device QA; they are not simulation inputs.

## Main implementation areas

- `packages/platform/src/index.ts`
- `packages/renderer-pixi/src/index.ts`
- `packages/visual-engine/src/index.ts`
- `apps/game/src/settings/SettingsStore.ts`
- `apps/game/src/runtime/BattleRuntime.ts`
- `apps/game/src/runtime/TrainingRuntime.ts`
- `apps/game/src/App.tsx`
- `apps/game/src/TrainingLabView.tsx`
- `apps/game/src/styles.css`
- `tests/stage8-mobile-rendering.test.ts`
- `validation/v1.1-stage8-platform.ts`

## Boundaries

Stage 8 does not claim:

- physical testing on every iOS or Android device;
- final App Store or Play Store certification;
- completion of Stage 6 VFX authoring;
- completion of Stage 7 large-battle profiling and optimization;
- recovery from every GPU driver failure;
- guaranteed high-quality 60 FPS rendering on all phones.

Use `docs/STAGE_8_DEVICE_QA.md` for the remaining browser-emulation and real-device checks.
