# v1.1 Stage 3 — Validation Report

No `npm install` was run for this stage.

## Checks completed

### Repository lint

```text
Project lint passed.
```

### Strict TypeScript source validation

The global TypeScript compiler validated the application, all packages and tests using temporary ambient declarations for third-party packages unavailable in the build environment. The declarations were kept outside the artifact.

### Executable headless regressions

The real compiled content, simulation and controller code was run through a temporary external lightweight `zod` runtime.

Stage 2 behavior remained valid:

```json
{"stage":"v1.1-stage2","passiveContact":{"impacts":2,"checksum":"398dfcfc"},"explicitRam":{"damageEvents":1,"checksum":"b3877c0f"},"validationRules":{"blockedLineOfSight":true,"fortifyStarts":1},"stableResult":{"result":{"reason":"elimination","winningTeam":1,"winnerEntityIds":[0],"endedAtTick":67},"checksum":"51826cb9"},"ai":{"checksum":"331319e1","tick":700,"maxAbilityCommands":1}}
```

Stage 3 weapon scenarios:

```json
{"stage":"v1.1-stage3","weaponCategories":["continuous","melee","ranged","throwable"],"melee":{"checksum":"711caff8","phases":{"windup":true,"active":true,"recovery":true},"hits":1},"outOfRangeRejected":true,"ranged":{"checksum":"ac89f3e8","spawned":1,"impacts":1},"bomber":{"checksum":"537a0f84","spawned":true,"impacted":true,"exploded":true}}
```

Validated behavior:

- all four required weapon categories exist
- out-of-range melee activation is rejected
- melee exposes wind-up, active and recovery and produces a weapon hit
- Arc Rifle spawns and impacts with a real projectile
- Bomber spawns a Demolition Bomb projectile before impact/fuse explosion
- repeated same-seed weapon runs produce the same checksum
- passive body contact still does no health damage
- explicit ram damage still works
- Stage 2 line-of-sight, cooldown, match-result and one-action AI rules remain valid
- manual pause and browser-lifecycle pause combine without one accidentally cancelling the other
- starting, replaying or randomizing a battle clears only the manual pause state

## Automated tests added/updated

- `tests/stage3-weapons.test.ts`
  - category registry
  - melee range rejection
  - melee phase/hit behavior
  - ranged projectile creation
  - Bomber actual bomb projectile ordering
  - same-seed weapon determinism
- platform-settings migration expectation updated to schema v3/audio-enabled defaults

## Local authoritative check

After extracting, run with your already-installed dependencies:

```powershell
npm run check
npm run dev
```

This environment did not run the real React/Pixi/Vite browser build. The arena-centering, browser audio unlock and visual weapon motion therefore still require manual browser verification on your machine.

## Known limitations

- Projectiles use top-down linear simulation paths; throwable height is a presentation-only arc rather than full ballistic Z-axis physics.
- Projectile-obstacle bounce uses lightweight circle/AABB reflection rather than a general rigid-body solver.
- Standard weapon definitions are currently source-controlled TypeScript data; a visual weapon-authoring editor is not included yet.
- Reload/ammunition/resource systems are not part of the current combat model; cooldown is the firing cadence.
- Stage 4 will continue with player-mode arena alignment and controller-visibility requirements from the v1.1 review.
