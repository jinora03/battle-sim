# v1.3.26 Stage 8.8F — Rematch and HUD Cleanup

Stage 8.8F closes the Stage 8.8 UX sequence with two small but important behavior and readability corrections.

## Fresh-seed rematch

The match-result **Rematch** action now preserves the current matchup, controllers, arena, mode and module loadouts while generating a fresh seed. The existing exact replay action remains separate and is labelled **Replay same seed**.

A small seed-normalization helper guarantees that Rematch cannot accidentally reuse the current seed, even if the random seed generator returns a collision.

## Objective-bar cleanup

The redundant `2/2 alive · Win by elimination` sentence is removed from last-team-standing battles. The team health lanes already communicate alive counts, so the duplicate sentence added visual noise without new information.

Result text remains visible after the battle ends, and non-elimination modes continue displaying their active-entity summary.

## Scope

This phase does not change combat setup, fighter balance, AI, physics, modules, replay determinism or simulation results. A rematch is intentionally a new deterministic run because it receives a new seed; **Replay same seed** remains the exact-repeat action.
