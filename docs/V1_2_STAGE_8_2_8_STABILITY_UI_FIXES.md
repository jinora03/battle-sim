# v1.2 Stage 8.2.8 — Stability and UI fixes

This patch stabilizes Gunner's Kill Zone activation and restores several requested application affordances before the Pyro identity phase.

## Gameplay

- Kill Zone no longer has a hidden three-stack Target Lock activation gate.
- Kill Zone is treated as a directional distributed-missile ultimate, so it can launch without a selected target, line of sight, or narrow aim alignment.
- Existing Target Lock stacks still improve Kill Zone missiles through the projectile's status interaction.
- Gunner AI remains combo-aware because the ranged-gunner AI profile still waits for three Target Lock stacks before choosing the ultimate.

## Interface

- Restores the Create Fighter navigation tab.
- Opens Quality & accessibility by default.
- Gives the empty AI decision state a stable full-width card and consistent spacing from replay export.
- Adds top spacing to the Open developer Fighter Workshop action.

## Regression coverage

`tests/stage8-2-8-ultimate-stability.test.ts` verifies:

- Gunner can activate and resolve Kill Zone with zero Target Lock stacks.
- Kill Zone launches all ten missiles.
- Every built-in fighter ultimate can activate and resolve in a deterministic training duel.
