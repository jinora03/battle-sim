# Kinetic Battle Engine v1.1 — Stage 7.5 Final Performance Architecture

Stage 7.5 combines the remaining stability, performance, audio and match-header work into one release.

## Simulation and AI

- Area-target scoring now reuses team-grouped hostile lists, so 50v50 decisions no longer rescan the allied half of the battle for every candidate.
- Cluster-density queries share the same deterministic hostile-query context.
- Final team, range, distance and ID tie-break checks remain exact, preserving selected actions and replay command order.
- AI command storage is reused per tick, and workload diagnostics now expose hostile-query counts and candidate checks.

## Main thread and rendering

- Runtime render-event collection and recent-activity pruning avoid repeated frame arrays and filter/slice allocations.
- Static obstacles are redrawn only when arena, profile, alive state or HP changes.
- Trail rendering reuses its entity lookup map.
- The existing mass-battle presentation budgets and adaptive quality policy remain active.

## Renderer startup stability

- Runtime and renderer startup are idempotent.
- The Battle view waits for a connected, visibly sized arena host before Pixi initialization.
- Switching tabs during initialization no longer creates a second renderer boot.
- Startup failure exposes an in-place Retry renderer action instead of requiring a page reload.
- Destroy-during-initialization is handled without mounting a stale canvas.

## Match header and progress

- Mode/objective and fighter matchup text are aligned to the left.
- Last-team-standing modes show a live HP lane and alive/total count for every team.
- Team maximum HP is captured at battle creation, so a defeated fighter does not incorrectly shrink the denominator.

## Audio

- AI-vs-AI damage emits a dedicated lower-pitched hit-confirmation cue.
- The strongest confirmed AI hit is aggregated per simulation batch and rate-limited by battle size.
- Player hitmarker and damage-received cues remain separate.
- Disabled/unavailable audio skips event sorting and filtering work.

## Validation target

Run on a normal development machine with dependencies installed:

```bash
npm run check
```

Recommended manual regression:

1. Reload the site and immediately enter Fight.
2. Switch away and back while “Preparing battle renderer…” is visible.
3. Start 1v1, 20v20 and 50v50 AI battles.
4. Confirm the two team progress lanes update and retain their original maximum HP.
5. Confirm AI hitmarker audio is audible but rate-limited in 50v50.
6. Export and replay a schema-2 replay and compare checksums.
