# v1.1 Stage 4 — Player Controls and Arena Alignment

Stage 4 preserves the complete Stage 3 weapon system and strengthens the player-mode presentation boundary.

## Camera and arena fitting

- The renderer observes the actual arena host rather than the browser window.
- Arena fitting is recalculated only when the host or arena changes.
- Small, medium and large arenas are centered from the same pure camera-fit calculation.
- Camera follow, camera shake and world drawing now use separate Pixi containers.
- World transforms are reset rather than accumulated across resize, fullscreen and arena changes.
- Player follow snaps to a valid clamped position after resize, then resumes smooth tracking.
- Turning camera follow off returns to the exact centered arena fit.
- Pointer-to-world aiming uses Pixi's inverse world transform, so aiming remains correct after zoom, follow, shake and resize.

## Player controls

- Keyboard movement remains WASD or arrow keys.
- Pointer movement aims player attacks.
- Skills remain available through 1–5 and Q/E/R/F.
- Touch controls default to `Auto`, which displays them only on touch-first devices.
- Hybrid/desktop devices with a normal fine pointer no longer show the mobile controls by default.
- Settings can force touch controls to always show or always hide.
- The existing large-touch-control option changes size without deciding visibility.
- A persistent player-control strip below the arena explains the active input mode and exposes camera-follow status.
- Touches on the movement/skill overlay no longer corrupt pointer aiming.

## Test-harness correction

The 20v20 determinism test now reuses one snapshot per tick and has a local 20-second timeout. This preserves the heavy scale regression without weakening timeouts for the rest of the suite.
