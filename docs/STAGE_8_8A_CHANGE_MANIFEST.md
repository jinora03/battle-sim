# Stage 8.8A Change Manifest

## Version

`1.3.21-stage8.8a`

## Modified files

### Mobile shell and settings

- `packages/platform/src/index.ts`
  - advances settings schema to 10
  - adds persisted touch-control opacity
  - changes recommended movement mode to Mouse move + aim
  - changes recommended camera-follow default to off
- `apps/game/src/settings/SettingsStore.ts`
  - advances storage key to v10 while retaining v9 migration
- `apps/game/src/features/battle/BattleSetupDrawer.tsx`
  - places Mouse move + aim first
  - adds Control opacity under Player Controls
- `apps/game/src/app/AppWorkspace.tsx`
  - removes the duplicate desktop command panel on touch-first devices
  - retains the compact mobile dock
  - forwards shared settings to Ability Lab
  - exposes touch-control opacity as a CSS variable
- `apps/game/src/styles.css`
  - applies shared control opacity
  - removes the blank command row in short landscape
  - allows short-landscape vertical recovery scrolling
  - styles Ability Lab module selectors

### Ability Lab parity

- `apps/game/src/TrainingLabView.tsx`
  - adds compatible trainer modules
  - adds shared movement-mode selection
  - adds Mouse move + aim steering
  - refreshes layout after viewport changes
- `apps/game/src/runtime/TrainingRuntime.ts`
  - includes trainer modules in the real participant loadout
  - adds battle-equivalent mouse steering
  - exposes renderer layout refresh

### Renderer stability

- `packages/renderer-pixi/src/runtime/RendererLifecycle.ts`
  - adds immediate and settled forced-layout refresh
  - remounts the canvas if a responsive transition detached it
  - adds a legacy ResizeObserver fallback
- `packages/renderer-pixi/src/index.ts`
  - exposes `refreshLayout()`
- `apps/game/src/runtime/BattleRuntime.ts`
  - exposes renderer layout refresh to the UI runtime
- `apps/game/src/hooks/useBattleRuntime.ts`
  - refreshes and retries on resize, orientation, and visual viewport changes
- `apps/game/src/app/AppController.tsx`
  - recalculates device/viewport classification immediately and after viewport settling

### Versioning and tests

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `tests/platform-settings.test.ts`
- `tests/stage8-mobile-rendering.test.ts`
- `tests/content-and-modes.test.ts`
- `tests/stage8-7d-readability-anti-stall-roster.test.ts`
- `tests/stage8-8a-mobile-stability.test.ts`

## Deliberately unchanged

- fighter and ability balance
- simulation RNG and replay format
- battle seeds and deterministic outcomes
- desktop battle-command layout
- README, to avoid branch-specific documentation conflicts
