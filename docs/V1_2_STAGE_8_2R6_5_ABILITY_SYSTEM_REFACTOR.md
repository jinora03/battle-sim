# Stage 8.2R6.5 — Ability System Refactor

## Goal

Extract ability activation, cast/channel lifecycle, collision windows, passive dispatch, and data-driven action execution from `packages/simulation/src/runner.ts` without changing simulation behavior, event ordering, or replay checksums.

## New modules

### `systems/AbilitySystem.ts`

Owns:

- ability activation validation
- cooldown start and cast creation
- cast ticking and resolution
- Solar Laser tracking, ramp damage, and caster locking
- collision-window arming and expiry
- collision-triggered ability resolution
- battle-start and primary-hit passive routing
- line-of-sight and direction helpers shared by primary attacks

### `systems/AbilityActionExecutor.ts`

Owns deterministic execution of data-driven actions:

- damage and status actions
- radial and directional actions
- explosion and target-centered explosion actions
- delayed and immediate projectile launch patterns
- self impulse, healing, and status removal
- passive condition checks and passive event emission

### `systems/AbilitySystemTypes.ts`

Contains the narrow interfaces between the extracted ability system and the runner's authoritative mutation methods. Damage, statuses, knockback, external impulses, and projectile state remain owned by their existing systems.

## Runner changes

`LocalSimulationRunner` now delegates:

- `activateAbility` commands
- active cast ticks
- armed ability expiry
- collision ability triggers
- passive triggers
- Solar Laser lock enforcement

The simulation tick order is unchanged.

## Explicitly unchanged

- primary weapon attack execution
- projectile physics and collision behavior
- damage calculation
- status application rules
- fighter collision resolution
- explosion and protected knockback behavior
- snapshots and replay formats
- content definitions and balance

## Size

- `runner.ts`: 1,437 → 940 lines
- `AbilitySystem.ts`: about 430 lines
- `AbilityActionExecutor.ts`: about 390 lines
- `AbilitySystemTypes.ts`: about 80 lines
