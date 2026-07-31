# Stage 7.4 Performance Phase 4 — Replay Compression

Phase 4 removes the largest remaining replay-memory multiplier without changing simulation commands or battle outcomes.

## What changed

- Replay schema 2 stores non-movement actions as ordinary frames.
- Identical per-tick movement commands are encoded as inclusive tick runs.
- Compression is exact: no direction quantization or tolerance is used.
- The replay controller reconstructs movement commands while playing and does not expand the runs into a full in-memory command list.
- Replay schema 1 remains readable.
- Developer metrics now show logical commands, stored commands, and the reduction percentage.

## Why it is safe

The live simulation still receives every original AI/player command. Compression happens only after commands are generated, inside the recorder. During playback, the controller emits the same movement command on every tick covered by a run.

## Expected result

After Phase 2, large-battle AI directions commonly remain unchanged for several ticks. A 50v50 battle therefore stores one movement run for several hundred identical per-tick commands instead of cloning each command object independently.
