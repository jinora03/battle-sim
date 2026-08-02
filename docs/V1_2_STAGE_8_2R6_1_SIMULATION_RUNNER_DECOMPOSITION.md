# Stage 8.2R6.1 — Simulation Runner Decomposition

## Goal

Reduce the responsibilities owned directly by `LocalSimulationRunner` without changing simulation results, replay checksums, battle rules, fighter behavior, or public APIs.

This first simulation refactor intentionally extracts only low-risk orchestration responsibilities. Collision, projectile, ability, and knockback mechanics remain in `runner.ts` for later isolated phases.

## Extracted systems

### `systems/CommandSystem.ts`

Owns deterministic command ordering and dispatch:

- stable entity/type ordering;
- movement and stop commands;
- primary-attack commands;
- legacy `basic` ability migration;
- delegation to runner-owned movement and activation behavior.

The system reuses its command-ordering buffer instead of allocating a copied array every tick.

### `systems/StatusSystem.ts`

Owns status countdown and periodic damage scheduling:

- stable active-entity iteration when periodic damage can kill;
- status duration countdown;
- periodic pulse countdown;
- expired-status removal;
- delegation to the runner's authoritative damage path.

### `systems/BattleResultSystem.ts`

Owns mode-specific victory evaluation:

- elimination and draw detection;
- boss-raid outcomes;
- survival outcomes;
- timeout team ranking;
- training victory suppression.

It returns a battle-end decision and does not mutate runner presentation or combat state. `LocalSimulationRunner` remains responsible for finalizing the result, clearing active actions, stabilizing entities, and emitting `battleEnded`.

## Preserved boundaries

The following remain unchanged:

- `SimulationRunner` and `LocalSimulationRunner` public APIs;
- simulation tick order;
- command ordering rules;
- status and damage behavior;
- battle-result reasons and winner selection;
- content and replay schemas;
- engine/content version strings;
- collision, projectile, ability, and knockback implementation.

## Validation

The refactored simulation was compared byte-for-byte against the deployed R5 baseline across deterministic scenarios for:

- duel;
- boss raid;
- survival;
- status/periodic-processing training flow.

Final checksums, ticks, results, entity state, event counts, and final events matched in every scenario.
