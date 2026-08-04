# Kinetic Battle Engine v1.3.21 — Stage 8.8A Mobile Stability

Stage 8.8A begins the Battle UX and gameplay-accessibility polish track. It focuses on the mobile battle shell, shared player-control defaults, Ability Lab parity, and renderer recovery after orientation or browser-viewport changes.

## Mobile battle shell

Touch-first devices now use only the compact four-button dock below the arena:

- Random
- Pause / Resume
- Setup
- Fullscreen

The larger desktop battle-command panel is not rendered on touch-first devices, so mobile users no longer see duplicate battle actions or an empty reserved command row.

## Shared control defaults

New and reset settings now use:

- movement mode: `mouse` (`Mouse move + aim`)
- camera follow: disabled
- touch-control opacity: `0.75`

Touch-control opacity is adjustable from 30% to 100% inside Player Controls. The value is persisted through settings schema version 10 and shared by Battle and Ability Lab controls.

Existing explicit user preferences remain preserved during settings migration.

## Ability Lab parity

Ability Lab now supports:

- the same Mouse move + aim / WASD movement selector as Battle
- Mouse move + aim as the default for new settings
- compatible offense, defense, mobility, and utility modules for the trainer fighter
- battle-equivalent distance-based mouse steering
- immediate and settled renderer refreshes after viewport changes

Changing the trainer clears incompatible module selections before restarting the training battle.

## Mobile landscape recovery

The renderer lifecycle now exposes an explicit layout refresh that:

1. verifies the canvas is still mounted in the active host;
2. clears cached host dimensions;
3. forces an immediate resize pass;
4. repeats the forced pass after the mobile browser viewport settles.

Battle and Ability Lab listen to window resize, orientation change, and `visualViewport` resize events. Older mobile Chromium/WebView implementations that reject `ResizeObserver.observe(..., { box: 'content-box' })` fall back to the one-argument observer API.

Short mobile landscape layouts can scroll vertically rather than trapping the application in a clipped fixed-height body.

## Compatibility

- Content version: `1.3.21-stage8.8a`
- Engine version: `1.3.21-stage8.8a`
- Settings schema: `10`

No damage, cooldown, AI, physics, replay, seed, or deterministic simulation rules changed.

## Manual verification

1. Open Battle on a touch-first phone in portrait.
2. Confirm only the compact dock appears below the arena.
3. Rotate to landscape while the renderer is loading, while paused, and during active combat.
4. Confirm the canvas resizes and remains interactive after the browser toolbar settles.
5. Change Control opacity and confirm Battle and Ability Lab controls update.
6. Reset recommended settings and confirm Mouse move + aim and Camera follow off.
7. In Ability Lab, equip a compatible trainer module and confirm the restarted trainer uses the selected loadout.
