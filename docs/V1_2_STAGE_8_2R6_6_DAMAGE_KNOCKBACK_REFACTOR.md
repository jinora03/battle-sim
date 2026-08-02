# Stage 8.2R6.6 — Damage and Knockback System Refactor

## Goal

Continue decomposing `packages/simulation/src/runner.ts` without changing
combat results, replay checksums, protected wall-bounce guarantees, or public
simulation APIs.

## Extracted systems

### `systems/DamageSystem.ts`

Owns authoritative damage resolution:

- friendly-fire rejection
- source damage scaling
- elemental resistance and interaction multipliers
- incoming damage module multipliers
- training-mode damage prevention
- damage events
- death resolution and death events
- external-impulse cleanup on death

Battle rules and mutable training settings remain owned by
`LocalSimulationRunner` and are supplied through narrow callbacks.

### `systems/KnockbackSystem.ts`

Owns shared knockback and explosion impulse policy:

- damage-scaled explosion impulse calculation
- Mega Bomb's protected three-wall-bounce options
- point, source-to-target, and explicit-vector knockback
- deterministic fallback direction for zero-length vectors
- mass and module knockback scaling
- external impulse accumulation and speed limiting
- presentation `knockbackApplied` event thresholds
- external impulse removal

`ArenaCollisionSystem` still consumes protected wall bounces and remains the
authority for wall and obstacle collision behavior.

## Runner changes

`LocalSimulationRunner` now wires damage and knockback services into existing
status, arena, projectile, ability, and primary-weapon systems. The simulation
tick order and public API are unchanged.

Approximate size change:

- `runner.ts`: 940 lines → 778 lines
- `DamageSystem.ts`: 110 lines
- `KnockbackSystem.ts`: 241 lines

## Explicitly unchanged

- fighter and projectile collision algorithms
- projectile movement, ricochet, piercing, and homing
- ability execution order
- damage and knockback formulas
- Mega Bomb wall-bounce requirement
- status application behavior
- battle results and timeout behavior
- replay and snapshot schemas
- simulation event ordering

## Validation

The refactored implementation was compared byte-for-byte against the R6.5
baseline across deterministic scenarios covering:

- Gunner versus Pyro AI duel
- Solar Sentinel laser channel
- Rocket Vanguard ultimate
- Bomber Mega Bomb and protected wall bounces
- collision-triggered ability flow
- Gunner passive and Target Lock flow

Final checksums, ticks, results, entity states, projectile snapshots, and ordered
event streams matched exactly.
