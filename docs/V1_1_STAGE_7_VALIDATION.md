# v1.1 Stage 7 Validation

## Completed in this artifact

- Repository architecture/style lint passed.
- Strict TypeScript validation passed for the simulation/content/controller packages.
- Strict TypeScript validation passed for the complete React/Pixi application using temporary external dependency declarations because the package registry was unavailable.
- An executable headless 20v20 benchmark ran twice from the emitted Stage 7 simulation.
- The performance-profiler policy ran independently.

Headless benchmark result:

```text
Kinetic Battle Engine v1.1 Stage 7 validation
PASS snapshot cache keeps one immutable snapshot until state advances
PASS deterministic spatial AABB query
PASS 20v20 determinism checksum=264e5aea tick=900
PASS broadphase maxCandidates=229 (< 780 all-pairs)
PASS broadphase occupiedCells=40 maxBucket=5
PASS projectile bounded checks=7921
PASS invalid numeric recoveries=0 during normal benchmark
PASS performance profiler pressure=critical bottleneck=render droppedTicks=3
```

Timing values are environment-specific; determinism and bounded-query assertions are the meaningful checks.

## Automated regression coverage

`tests/stage7-performance.test.ts` verifies:

- snapshots are reused until state advances
- stepping invalidates the snapshot cache
- spatial buckets can be reused
- deterministic bounded AABB queries work
- broadphase metrics are populated
- normal scenarios produce no invalid numeric states
- pressure classification distinguishes healthy and sustained slow frames
- bottleneck classification identifies simulation-heavy versus render-heavy workloads
- dropped simulation ticks are recorded

The existing 20v20 test continues to verify identical checksums and ending ticks for repeated seeded mass skirmishes.

## Local dependency-backed validation

Run on the target machine after installing dependencies:

```bash
npm install
npm run lint
npm run check
npm run dev
```

Manual checks:

1. Start a Battle, open Ability Lab, then return to Battle. The arena canvas must reappear and refit without restarting the match.
2. Repeat navigation several times; only one battle canvas should exist in the battle host.
3. Resize the window after returning; the arena must remain centered.
4. Run 20v20 and inspect Performance. Simulation/render/frame averages and p95 values should update.
5. Confirm broadphase cells, max bucket, projectile checks and fighter-view reuse counts are visible.
6. Restart the same large battle repeatedly and confirm reused fighter-view count rises without duplicate fighters.
7. Under sustained load, confirm the pressure badge appears and quality scale may fall.
8. Confirm fighter colors and weapon silhouettes remain readable at Army LOD.
9. Replay the same seed with the same commands and confirm the checksum remains unchanged.
10. Verify adaptive quality does not change simulation tick rate, fighter count, damage or winner.
