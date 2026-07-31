# v1.1 Stage 2 — Validation Report

No `npm install` was run for this stage, per the requested delivery workflow.

## Checks completed in the build environment

### Repository lint

```text
Project lint passed.
```

### Strict core and test type validation

The installed global TypeScript compiler was run against:

- protocol
- content and schemas
- simulation
- controllers
- creator, visual, meta, platform, replay, and audio packages
- the complete test source set

Temporary ambient declarations were used only for unavailable third-party packages (`zod` and `vitest`). They were not copied into the project.

### Full source syntax/transpile validation

All application, package, test, and validation TypeScript/TSX files passed TypeScript's no-check transpilation validation. This catches syntax and module-shape failures without downloading React, Pixi, Vite, or Capacitor.

### Dependency-free regression harness

All 11 test files were compiled and executed through a temporary Vitest-compatible assertion harness outside the artifact. This was not a replacement for real Vitest, but it exercised the same test callbacks without downloading packages.

```text
45 passed
0 failed
```

This included the new seven-test Stage 2 suite and the existing determinism, arenas, teams, creator, player-control, progression, platform and v1.0 release regressions.

### Executable headless Stage 2 scenarios

A temporary lightweight `zod` runtime was used outside the artifact only to execute the real compiled content/simulation/controller code.

Result:

```json
{
  "stage": "v1.1-stage2",
  "passiveContact": { "impacts": 2, "checksum": "43ba120d" },
  "explicitRam": { "damageEvents": 1, "checksum": "ea8e9c0f" },
  "validationRules": { "blockedLineOfSight": true, "fortifyStarts": 1 },
  "stableResult": {
    "result": {
      "reason": "elimination",
      "winningTeam": 1,
      "winnerEntityIds": [0],
      "endedAtTick": 67
    },
    "checksum": "a6aee8ee"
  },
  "ai": { "checksum": "8b5af255", "tick": 700, "maxAbilityCommands": 1 }
}
```

Validated behavior:

- physical impacts occurred without HP damage
- explicit Bramble Charge collision dealt damage
- blocked line of sight rejected a targeted activation
- repeated commands did not bypass Fortify cooldown
- match completion created a result snapshot
- winner velocity was stabilized
- ended simulation rejected later commands
- AI emitted no more than one competing skill activation per fighter/tick
- repeated same-seed AI scenario produced the same checksum

## Local checks still required

Run these after downloading/extracting:

```powershell
npm run lint
npm run check
npm run dev
```

`npm run check` is the authoritative local validation using the real installed Vitest, React, PixiJS, Vite, and browser build dependencies.

## Known limitations

- Stage 2 validates obstacle line of sight with straight segment tests against circle/AABB obstacles; it is not a navigation/pathfinding system.
- Current abilities have no mana/resource economy, so only existing cooldown/target/context requirements are enforced.
- Replay export exists, but replay playback UI is not implemented, so no result-overlay playback action is shown.
- Stage 3 will replace generic current basic abilities with the full weapon/attack architecture requested in the v1.1 specification.
