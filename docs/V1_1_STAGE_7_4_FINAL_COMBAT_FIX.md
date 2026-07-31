# v1.1 Stage 7.4 — Final Combat Feedback Fix

## Rocket barrage freeze

Rocket presentation now treats the full causal chain as one real-time barrage:

- missile flight
- direct projectile impact
- explosion damage and knockback
- later fighter collisions
- wall or obstacle impacts
- deaths caused after the launch

Hit-stop is cleared while missile projectiles are active and remains suppressed for missile-launched fighters for 72 simulation ticks. High-volume missile event batches also cap duplicate damage, hit, blast, and knockback VFX while preserving the simulation events themselves.

## Gunner reference match

The Automatic Rifle now uses the burst audio extracted from the user-provided reference video:

- `packages/audio/src/assets/gunner-reference-burst.wav`

Synthetic rifle cracks, generic hitmarkers, and duplicate legacy rifle effects are disabled for this weapon so they do not alter the supplied sound. The visual pass uses centered cyan-white muzzle pulses, short projectile streaks, three fast source-to-impact streaks, cyan sparks, and the large cyan/yellow radial impact ring shown in the reference.

## Ability Lab parity

Ability Lab and Battle use the same renderer and audio paths. Invulnerable training targets still emit `damage` events marked `prevented`, and those events now receive the same visual hit response as normal damage. Training audio also passes the controlled fighter as the focused entity, so the Gunner reference burst and other focused feedback are selected consistently.

## Install-free validation performed

- project lint
- TypeScript checking of modified simulation/content/audio/renderer/runtime files
- TypeScript checking of Stage 5 and Stage 7.4 regression tests
- causal missile tracker runtime check with multiple missile hits
- reference WAV format/integrity check

No dependency installation was performed and `node_modules` is not included.
