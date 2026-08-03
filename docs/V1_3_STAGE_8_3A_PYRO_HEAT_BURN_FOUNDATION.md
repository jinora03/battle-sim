# Stage 8.3A — Pyro Heat and Burn Foundation

## Purpose

Stage 8.3A introduces a reusable deterministic combat-resource model and uses it for Pyro's Heat meter. It also turns Burn into a five-stack combo status so the Stage 8.3B kit can build and consume Burn without fighter-specific logic inside the simulation runner.

This stage is foundation work. It does not replace Pyro's existing abilities yet and does not change another fighter's stats, content, snapshot shape, events, or deterministic checksum.

## Combat resources

A fighter can now declare zero or more resources through `combatResources`:

- stable resource id and display name
- initial and maximum value
- deterministic delayed decay
- gain from damage of an optional element
- gain from newly applied status stacks
- optional per-event gain cap

Runtime state lives in `World`, while `CombatResourceSystem` owns gain and decay. The system ignores resource work for fighters that do not declare resources.

Ability data can prepare future resource-driven kits with:

- `SELF_RESOURCE_AT_LEAST`
- `MODIFY_RESOURCE_SELF`

Resource values are clamped to `[0, maximum]`, included in Pyro snapshots and checksums, and sorted by resource id.

## Pyro Heat

Pyro starts at 0 Heat and has a maximum of 100.

Heat gains:

- 0.35 Heat per point of fire damage, capped at 10 per damage event
- 5 Heat for each newly added Burn stack

Heat decay:

- begins 120 ticks after the most recent gain
- decays at 6 Heat per second
- does not decay during the delay window

Prevented Training Lab damage still reports real damage and therefore builds Heat, allowing the combo loop to be tested without damaging the dummy.

## Burn foundation

Burn now supports up to five stacks and refreshes duration when reapplied. Only newly added stacks grant the status-based Heat bonus; refreshing Burn at the five-stack cap does not grant another stack bonus.

Periodic Burn damage remains the existing fixed periodic effect in this phase. Stack consumption and stack-scaled payoff belong to Stage 8.3B.

## Presentation

`FighterResourceRing` renders the first declared resource as a segmented outer ring around the fighter:

- Heat uses an orange meter
- high resource values pulse gently
- player and AI radii remain readable beside the HP ring
- army LOD uses fewer segments
- the existing fighter-ring visibility setting controls both HP and resource rings

Fighters without resources do not receive an empty resource field or ring.

## Determinism and compatibility

- Engine/content version: `1.3.0-stage8.3a`
- Existing non-resource battle snapshots, event streams and checksums remain byte-for-byte identical.
- Pyro's checksum now includes Heat because Heat affects future combat decisions and ability results.
- Replay and public protocol schemas remain backward-tolerant because `EntitySnapshot.resources` is optional.

## Validation focus

- Heat content parsing and resource-definition validation
- initial snapshot state
- fire-damage and Burn-stack gains
- Heat and Burn caps
- delayed deterministic decay
- resource condition/action schema support
- same-command determinism
- non-resource before/after snapshot, event and checksum parity
- strict content/simulation/controller and Pixi renderer TypeScript compilation
