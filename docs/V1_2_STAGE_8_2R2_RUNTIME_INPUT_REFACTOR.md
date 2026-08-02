# Stage 8.2R2 — Battle Runtime and Input Refactor

## Goal

Move battle runtime lifecycle and player-input orchestration out of `App.tsx` without changing combat, rendering, replay, settings, or launch behavior.

## Extracted responsibilities

### `apps/game/src/hooks/useBattleRuntime.ts`

Owns the React integration boundary for `BattleRuntime`:

- runtime construction and destruction;
- renderer boot, visible-layout waiting, retry and recovery;
- inactive-tab and background pause behavior;
- presentation-settings propagation;
- audio unlock retries;
- aim-assist and pointer-aim configuration;
- intro timing and runtime pause state;
- achievement unlock synchronization;
- pending battle restart requests while the renderer is still booting;
- runtime diagnostics exposed back to the application shell.

The hook does not contain simulation rules. It delegates all gameplay execution to `BattleRuntime`.

### `apps/game/src/hooks/useBattleInput.ts`

Owns player input translation:

- keyboard movement state;
- keyboard ability shortcuts;
- analog movement and touch-facing behavior;
- pointer aiming and mouse-drive control;
- primary-fire pointer handling;
- movement cleanup when the window loses focus.

The hook only sends commands through the existing `BattleRuntime` public methods.

## Preserved behavior

- Fight-tab renderer boot and automatic recovery;
- manual Start Battle flow and optional intro;
- pause while hidden or outside the Fight tab;
- WASD, arrow-key, mouse-drive, pointer aim, and touch-stick behavior;
- Q/E/R/F and 1–5 ability shortcuts;
- runtime settings updates and audio unlock behavior;
- replay, checksums, battle definitions, skills, balance, and renderer output.

## Boundary rules

- `App.tsx` composes product state and UI.
- React hooks coordinate browser lifecycle and input.
- `BattleRuntime` remains the imperative application runtime.
- Simulation and renderer packages remain independent from React.

## Result

`App.tsx` decreases from roughly 1,544 lines after R1 to roughly 1,200 lines after R2. No public runtime API or serialized data format changes.
