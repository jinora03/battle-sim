# v1.2 Stage 8.0 — Validation Notes

## Checks completed in the implementation environment

- repository architecture/style lint: passed;
- strict TypeScript check for protocol, content, controllers, simulation, meta, replay and the Stage 8.0 test: passed;
- syntax transpilation of every changed TypeScript/TSX file: passed;
- all 112 content JSON files parsed successfully;
- Git whitespace/error check: passed;
- runtime Target Lock/passive/payoff smoke test: passed;
- invalid module compatibility and one-module-per-slot checks: passed;
- Ricochet Chamber wall reflection: passed;
- Piercing Barrel two-target penetration and duplicate-hit prevention: passed;
- deterministic same-seed/same-loadout checksum: passed;
- different module selections affect checksum: passed;
- generic AI used Suppressive Burst, Pinning Round and Kill Zone in a deterministic training battle: passed.

## Headless 50v50 smoke result

A 50-Gunner-versus-50-Mech AI battle ran twice for 300 simulation ticks with mixed Gunner modules:

```text
fighters: 100
ticks per sample: 300
observed average: 1.5591–1.7354 ms per simulation tick
battle ended during samples: no
```

This is an environment-specific headless result. It does not include React, PixiJS, audio, browser scheduling, GPU work or mobile thermal throttling and must not be interpreted as a browser frame-rate guarantee.

## Full local validation still required

The uploaded project did not contain a complete workspace dependency installation, and the available package registry could not retrieve the declared React/Vitest/Pixi dependencies. Run the following from the project root on the development machine:

```bash
npm ci
npm run check
npm run bench
```

Then manually verify:

- select each Gunner module in Battle Setup;
- save, reload and apply a preset containing modules;
- export and replay a battle with modules;
- observe the four-stage Target Lock reticle;
- observe the Targeting Drone at hero/standard LOD and its omission at army LOD;
- confirm Pinning Round cannot activate below two stacks;
- confirm Kill Zone cannot activate below three stacks;
- rapidly switch views and restart battles to check renderer lifecycle stability;
- profile 20v20 and 50v50 in the target desktop and mobile browsers.
