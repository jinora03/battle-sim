# Kinetic Battle Engine v1.1 Stage 7.4 — Hotfix Revision

This revision finishes the Stage 7.4 items that were only partially implemented in the previous build.

## Renderer lifecycle

- Battle Lab and Ability Lab now remain mounted as separate, long-lived Pixi runtimes.
- Changing views suspends the inactive simulation/render loop instead of destroying and rebuilding its WebGL application.
- Each runtime keeps ownership of its own canvas, resize observer, ticker state and host reattachment path.
- Dormant workspaces are moved off-screen while remaining measurable, avoiding `display: none` canvas-size and WebGL lifecycle failures.
- Ability Lab keyboard controls are disabled while its view is inactive.

## Gunner / Automatic Rifle

The balance value remains unchanged at **3.6 damage per bullet**.

- Four-round burst, three-tick shot spacing, 25-tick cooldown and projectile speed 22 are preserved.
- Rifle recoil now pulses once for each shot in the burst instead of using one generic attack animation.
- Automatic-rifle bullets use a longer cyan tracer, bright core and clearer projectile silhouette.
- Each spawned rifle round receives a stronger muzzle flash and directional burst.
- Focused/player rifle audio retains a distinct procedural crack without duplicating the same shot cue.

## Rocket hit-stop stability

- Micro-missile blasts use zero presentation freeze.
- Missile-salvo blasts retain only a small bounded freeze.
- Missile `weaponHit` events no longer add a second generic hit-stop layer.
- `starburst-convergence` no longer receives the large generic mega-bomb ultimate freeze.
- Deaths occurring inside the same missile-cascade frame use a small capped freeze rather than repeatedly restoring the full death freeze.
- The policy is shared by hero and crowd rendering paths.

## Explosion knockback and bounce

- External impact velocity is tracked separately from normal locomotion.
- Fighter walking-speed limits no longer clamp explosion displacement.
- AI/replay `stop` commands stop locomotion without deleting active blast momentum.
- Blast impulse decays independently, with deterministic ice/water damping behavior.
- Arena-wall and obstacle collisions reflect the external impulse, producing visible bounce.
- Centered explosions retain deterministic fallback directions.
- Meaningful impacts emit `knockbackApplied` with direction, force, source and target data for diagnostics and VFX.

## Basic and skill hit feedback

- Every non-prevented `damage` event can now produce a target hit pulse, elemental flash and residual particles, including skills that do not emit `weaponHit`.
- Generic skill/basic damage receives element-aware procedural impact audio.
- Weapon hits still retain their specialized slash, projectile or heavy-impact presentation.
- Player hit markers and received-damage cues remain layered on top of the generic response.

## Regression coverage

`tests/stage7-4-combat-feedback-stability.test.ts` now checks:

- automatic-rifle damage and cadence values;
- missile blast, missile weapon-hit and missile-ultimate freeze policy;
- missile-cascade frame classification;
- explosion displacement while a stationary target receives a `stop` command every tick;
- `knockbackApplied` emission and subsequent wall impact.

## Validation performed for this archive

No package installation was performed. The archive contains no `node_modules` directory.

- TypeScript static passes completed for the simulation/content/protocol core, audio and combat-feedback policy, full Pixi renderer with local declaration stubs, and the Ability Lab runtime/view lifecycle.
- A compiled simulation harness confirmed the Automatic Rifle values and measured 71 world units of explosion displacement against continuous `stop` commands, including a `knockbackApplied` event and wall impact.
- Full `npm run check` was not run because dependencies were intentionally not installed. Run `npm install` and then `npm run check` locally.
