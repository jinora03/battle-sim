# v1.1 Stage 7 — Large-Battle Performance and Runtime Stability

Stage 7 is implemented on top of the complete Stage 6 + Stage 8 project. It preserves the Stage 3 weapon system, Stage 4 controls/camera, Stage 5 Ability Lab, Stage 6 layered VFX and Stage 8 mobile rendering/lifecycle work.

The central rule remains unchanged: optimization may reduce presentation cost, but it must not simplify AI, physics, hit detection, damage, cooldowns, projectile behavior, RNG or winner calculation.

## Goals

- Measure simulation, rendering and total frame cost separately.
- Detect sustained slowdown instead of reacting to one isolated frame.
- Reduce allocation and snapshot churn during large battles.
- Bound collision and projectile searches with deterministic spatial queries.
- Reuse fighter render objects across battle restarts.
- Detect and safely recover invalid numeric state.
- Preserve readable fighter identity at low visual detail.
- Fix renderer lifecycle when navigating Battle → Ability Lab → Battle.

## Snapshot reuse

`LocalSimulationRunner.getSnapshot()` now caches one immutable snapshot until authoritative state advances. Repeated consumers in the same tick receive the same snapshot reference.

The battle runtime also retains the latest snapshot and passes it to AI, player controls, progression, audio, rendering and diagnostics instead of rebuilding it several times per frame.

The cache is invalidated by simulation steps and training-rule changes. It does not reuse stale gameplay state.

## Spatial broadphase improvements

The spatial hash now:

- preallocates bucket arrays
- clears only occupied buckets
- iterates candidate pairs without constructing a new pair list
- supports deterministic axis-aligned bounded queries
- reports occupied-cell and maximum-bucket diagnostics

Projectile/fighter and explosion/fighter checks use bounded AABB queries instead of scanning every active fighter. Candidate IDs are kept in stable order before authoritative collision resolution, preserving determinism.

## Allocation reduction

Stage 7 reduces recurring work by:

- maintaining an active entity ID view inside the world
- caching immutable snapshots between state changes
- reusing projectile candidate arrays
- storing a sorted obstacle list
- avoiding temporary box-collision arrays
- mutating one per-tick command list rather than spreading several temporary arrays
- retaining inactive fighter views for reuse

These changes do not alter content definitions or battle rules.

## Fighter-view pooling and low-detail identity

Inactive fighter views are hidden and prepared for reuse instead of being destroyed on every restart. Diagnostics expose created, reused, active and pooled view counts.

Army-level rendering still preserves:

- primary body color
- core/accent color
- basic silhouette
- equipped weapon silhouette

Rifles, throwables, continuous weapons and melee weapons remain visually distinguishable even after particles and minor detail are reduced.

## Performance profiler

The browser runtime records:

- average simulation time
- average render time
- average frame time
- p95 simulation time
- p95 render time
- p95 frame time
- rendered FPS
- simulation steps processed in the latest frame
- dropped simulation ticks
- sustained long-frame streak
- performance pressure: Healthy, Strained or Critical
- dominant bottleneck: Simulation, Rendering or Balanced

A compact arena badge appears only during sustained strain/critical pressure and explicitly states that visual quality is adapting while simulation remains unchanged.

## Presentation-only adaptive quality

Existing adaptive quality now uses the measured workload to lower renderer performance scale when pressure persists and recover it gradually after a long healthy period.

It may reduce:

- particles and residual effects
- trail density
- render resolution within configured limits
- high-detail fighter presentation

It never reduces:

- fixed simulation tick rate
- fighter or projectile count
- AI decisions
- collision checks
- damage/status processing
- match duration rules

## Numeric-state safety

The simulation verifies active fighter and projectile numeric state after each tick. Non-finite position, velocity, health, radius or mass values are recovered to bounded safe values; invalid projectiles are removed. Every recovery is counted in diagnostics.

Normal deterministic validation produced zero recoveries. The guard exists to prevent one malformed entity from poisoning a long-running mass battle.

## Battle → Ability Lab → Battle bug fix

The battle renderer now has an explicit active/inactive lifecycle.

When leaving Battle:

- its animation work is suspended
- the battle canvas is hidden but the runtime is retained

When returning:

- the Pixi canvas is reattached to the correct battle host if another view changed DOM children
- the canvas is made visible
- a forced host measurement and renderer resize are queued
- arena fitting and player-camera snap are recalculated

This fixes the reported case where the arena disappeared after visiting Ability Lab and returning to Battle.

## Main implementation areas

- `packages/simulation/src/spatialHash.ts`
- `packages/simulation/src/world.ts`
- `packages/simulation/src/runner.ts`
- `packages/protocol/src/index.ts`
- `packages/renderer-pixi/src/index.ts`
- `apps/game/src/runtime/performance.ts`
- `apps/game/src/runtime/BattleRuntime.ts`
- `apps/game/src/App.tsx`
- `tests/stage7-performance.test.ts`
- `validation/v1.1-stage7-performance.ts`

## Boundaries

Stage 7 does not move simulation into a Web Worker or convert all entity state to TypedArrays. Those remain future options if profiling on real target devices proves they are required. The current pass first removes obvious churn and adds measurements so future optimization can be evidence-driven.
