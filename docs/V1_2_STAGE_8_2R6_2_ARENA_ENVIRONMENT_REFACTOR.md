# Stage 8.2R6.2 — Arena and Environment System Extraction

## Goal

Continue decomposing `packages/simulation/src/runner.ts` without changing simulation behavior, event order, battle results, or replay checksums.

This phase extracts arena-owned responsibilities while leaving abilities, projectiles, entity-to-entity collisions, explosions, damage formulas, and knockback creation in the runner.

## New systems

### `ArenaZoneSystem`

Owns:

- zone membership tracking
- `zoneEntered` and `zoneExited` event emission
- wind impulses
- lava and electric hazard timing
- hazard status application
- ice and water movement modifiers
- allocation-stable zone scratch buffers

### `ArenaCollisionSystem`

Owns:

- arena boundary resolution
- protected external-impulse wall-bounce accounting
- obstacle collision contacts
- obstacle contact damage
- destructible obstacle HP and destruction events
- obstacle line-of-sight checks
- immutable and pooled obstacle snapshots
- the stable ID-sorted runtime obstacle collection used by projectiles

### `SimulationSystemTypes`

Contains the shared `ExternalImpulseState` contract used by the runner and arena collision system. This avoids duplicating the protected-knockback state shape.

## Runner responsibility after extraction

`LocalSimulationRunner` still controls the authoritative tick sequence:

1. status processing
2. weapon and ability cast processing
3. command processing
4. zone processing
5. movement integration
6. broadphase rebuild
7. projectile processing
8. arena bounds
9. obstacle collisions
10. entity collisions
11. battle-result evaluation

The order is unchanged. The runner delegates arena work at the same points where the previous private methods ran.

## Compatibility guarantees

This refactor intentionally does not change:

- simulation public API
- tick ordering
- RNG usage
- event ordering
- fighter balance
- abilities or passives
- projectile behavior
- entity collision behavior
- damage and knockback formulas
- obstacle definitions
- snapshot/replay schemas
- settings or renderer code

## Validation

The refactored runner was compared with the Stage 8.2R6.1 baseline using deterministic scenarios for:

- duel
- boss raid
- survival in the elemental foundry
- status/training flow

The following matched exactly in every scenario:

- final snapshot checksum
- final tick
- winner and result reason
- fighter HP and positions
- active statuses
- event counts
- final tick events

The boss and survival scenarios exercised zone entry/exit, hazards, wall impacts, obstacle impacts, obstacle damage, and obstacle destruction.
