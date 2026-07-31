# Performance Phase 3 — Runtime snapshot reuse

Phase 3 removes the largest remaining per-tick snapshot allocation path from the live browser loop without changing the public deterministic snapshot contract.

## Previous behavior

After every simulation step, `BattleRuntime` called `runner.getSnapshot()`. A full immutable snapshot allocates:

- one entity object per living fighter
- one ability-state object per Basic/skill slot
- copied element, trait, status and active-zone arrays
- cast and weapon direction objects
- projectile and obstacle objects
- objective and metrics objects

That immutable API is useful for tests, checksums, exports and React diagnostics, but it is unnecessarily expensive as the internal 60 Hz hand-off between AI, renderer, audio and achievements.

## New data flow

```text
TypedArray simulation world
        ├── getRuntimeSnapshot() → pooled, mutable, synchronous live view
        │      AI · Player · Renderer · Audio · achievement checks
        │
        └── getSnapshot() → immutable cached snapshot
               diagnostics · checksum · tests · external consumers
```

`getRuntimeSnapshot()` reuses:

- the top-level `WorldSnapshot`
- entity objects
- ability-state objects and arrays
- status and active-zone arrays
- cast-direction and weapon-direction objects
- obstacle, projectile, objective and metrics objects

The immutable `getSnapshot()` behavior remains unchanged. It is now built only when diagnostics/checksum or another external consumer requests it.

## Safety rule

The runtime snapshot is an internal synchronous view. It is mutated by the next `getRuntimeSnapshot()` call and must not be retained as historical state. React diagnostics continue receiving an immutable snapshot, preventing state from changing behind React.

## Profiling

Open **Developer metrics** and compare `Runtime snapshot reuse` against the previous `Post simulation` and total simulation timing in 25v25 and 50v50 battles. Phase 3 should primarily reduce garbage-collection pressure and long-frame spikes; the average millisecond reduction can vary by browser.

The next phase addresses replay command compression. AI movement currently remains deterministic and is still emitted every tick.
