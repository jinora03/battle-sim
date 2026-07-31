# v1.1 Stage 7.4 Pass 4 — UI Polish and Solar Sentinel Channel

This pass builds directly on the Stage 7.4 Pass 3 archive.

## Fight UI polish

- The battle command bar now contains actions only; the duplicated active-battle text block was removed.
- The main navigation tabs are shorter on desktop, tablet and mobile.
- The running/booting pill was removed from the hero header.
- Fight setup dropdown typography is smaller while preserving the existing input height.
- Advanced seed actions now sit below the seed field.
- The fullscreen arena action is full width under Quality & accessibility.
- Button tones are more visibly tied to function: green for start, purple for random, blue for utility/replay, amber for pause and red for destructive actions.

## Metrics containment

- The performance and simulation panel now strictly contains its grid and long values.
- Metric cards use smaller wrapping text and cannot increase the width of their parent panel.
- Horizontal overflow is hidden while the existing vertical panel scrolling remains available.

## Arena background

- Added a persistent `arenaBackground` setting, enabled by default.
- Added a `Neon arena background` toggle under Quality & accessibility.
- The Pixi arena renderer draws subtle theme-aware neon glows, grid lines and an inset accent border when enabled.
- Debug render mode keeps the original diagnostic background.

## Solar Sentinel ultimate

Solar Eye Beams is now a 210-tick sustained channel instead of a one-time directional hit.

- The Sentinel is anchored in place for the whole channel.
- Movement, primary attacks and other abilities are rejected until the channel ends.
- The beam automatically tracks its selected enemy and switches to the nearest hostile if that target dies.
- The Sentinel's facing follows the beam target every simulation tick.
- Damage pulses every 6 ticks after an 18-tick warmup.
- Damage ramps from 2.2 to 3.5 to 5.2 per pulse, similar to an Inferno-style sustained lock.
- The visible beam is rendered from the live casting snapshot, keeping both eye beams attached to the body while the target moves.
- The old detached five-second resolve beam was removed; resolution now produces only a compact release flare.

## Validation included

- Updated Stage 7.4 tests and validation assertions for the sustained Solar Sentinel channel.
- Corrected the stale validation assertion for Gunner's current 3.4 bullet damage.
- Project architecture lint passes.
- No dependencies or `node_modules` are included in the archive.
