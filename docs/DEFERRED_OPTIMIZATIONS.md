# Deferred Optimizations

These ideas are useful, but implementing all of them before proving the combat feel would be premature.

## Upgrade after profiling

- Move additional hot component fields into tightly packed TypedArrays
- Pool high-frequency command/event temporary data
- Replace current spatial buckets with a zero-allocation flat-cell implementation
- Run simulation in a Web Worker through the same snapshot/command protocol
- Add visual LOD tiers for 100–1,000+ fighters
- Aggregate low-priority audio in large wars
- Add selective continuous collision detection for bullets, extreme dashes and very high velocities

## Exact cross-device determinism

If exact Android/iOS/browser replay parity becomes mandatory:

1. Define a numeric range contract for world positions, velocities and forces.
2. Replace float physics state with fixed-point/quantized integer math.
3. Pre-generate deterministic trig lookup data at build time rather than calling transcendental functions at runtime.
4. Keep stable collision-pair and event ordering.
5. Add tick checksums to replay regression tests.

The architecture already isolates this work inside the simulation package.
