# Stage 8.2R6.3 — Snapshot, Movement, and Cooldown Refactor

## Goal

Continue decomposing `packages/simulation/src/runner.ts` without changing
simulation order, battle results, snapshots, replay checksums, or public APIs.

## Extracted systems

### `snapshots/SnapshotSystem.ts`

Owns immutable and allocation-stable runtime snapshot assembly:

- entity/world snapshot delegation
- obstacle and projectile snapshots
- boss, survival, and elimination objective snapshots
- runtime metrics copying
- immutable snapshot caching and invalidation

### `systems/MovementSystem.ts`

Owns:

- movement-command acceleration
- explicit facing preservation
- cast and primary-attack movement restrictions
- environmental steering, damping, and speed modifiers
- locomotion speed limiting
- independent external-impulse decay and integration

### `systems/CooldownSystem.ts`

Centralizes tick-based cooldown policy:

- primary and ability readiness checks
- cooldown scheduling
- loadout-based primary cooldown scaling
- training-mode cooldown disabling and clearing

## Invariants

This refactor intentionally does not change:

- tick order
- command ordering
- fighter, projectile, or obstacle collision behavior
- ability execution
- damage, explosions, or protected knockback
- fighter content or balance
- snapshot and replay formats
- `LocalSimulationRunner` public API

## Result

`runner.ts` is reduced from approximately 2,042 lines to 1,820 lines.

## Validation

Before-and-after deterministic comparisons were run for:

- AI duel
- boss raid
- elemental-foundry survival
- training cooldown enable/disable flow

For all scenarios, final checksum, tick, result, objective, metrics, entity state,
projectile state, and event counts matched exactly.
