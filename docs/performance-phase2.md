# Stage 7.4 Performance Phase 2 — AI workload scaling

This pass targets the AI hot path while preserving the deterministic command/simulation architecture.

## What changed

- AI attack selection is deterministically staggered by entity ID.
- 49–100 fighter battles evaluate attacks every 5 ticks instead of every tick.
- Steering reactions use an 8-tick minimum cadence in 49–100 fighter battles.
- Projectile-leading aim is refreshed every 2 ticks for 49–100 fighters.
- Cluster-density analysis is cached for 20 ticks in 49–100 fighter battles.
- AI lookup maps, team arrays, target-load maps and cluster-density maps are reused rather than recreated every tick.
- Ability target selection no longer allocates a filtered enemy array for every skill evaluation.
- Detailed AI candidate/debug objects are only produced while the Developer metrics panel is open.

Physics, damage, cooldowns and simulation ticks remain at 60 Hz. AI movement commands are still emitted every tick so replay compatibility is preserved in this phase.

## 50v50 comparison

Use the same seed, fighters and arena as the Phase 1 profile. Compare:

- AI ms
- Simulation total and p95
- AI attack checks/tick
- AI steering refreshes/tick
- Dropped simulation ticks
- Replay commands
- Render p95

For 100 active AI fighters, attack checks should normally be spread across five ticks instead of all fighters evaluating on the same tick.

## Next phase

If AI time is now acceptable but replay commands and memory continue growing quickly, Phase 3 should compress unchanged movement commands while preserving deterministic replay behavior. If simulation core remains dominant, the next work should isolate snapshot construction and spatial AI queries.
