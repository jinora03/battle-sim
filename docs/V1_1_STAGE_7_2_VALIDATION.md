# v1.1 Stage 7.2 Validation

Validated in the artifact environment:

- repository architecture/style lint;
- strict TypeScript checking for application, renderer, packages and tests using temporary external-library declarations;
- every built-in fighter has one registered primary attack and no independent Basic ability field;
- every registered form/behavior combination passes the shared compatibility matrix;
- Sword + Spin is accepted and Rifle + Spin is rejected;
- Pyro uses Fire + Melee rather than a sword;
- Thorn Claws use non-spinning Melee behavior;
- Gunner uses Automatic Rifle and emits exactly four real projectiles per Basic burst;
- Suppressive Fire damages only targets inside its forward cone and does not trigger the Basic attack;
- Grenade Launcher resolves around the selected target rather than around Gunner;
- broad melee reach lands outside the old raw center-distance range;
- activating a normal skill does not start the primary attack;
- primary attack timing and outcomes repeat with the same checksum;
- schema-v1 Fighter Lab bundles migrate to schema v2 and discard the separate display weapon;
- a seeded 20v20 mixed-roster battle repeats deterministically.

Executable validation output:

`validation/v1.1-stage7-2-primary-attacks-output.txt`

Observed headless result in this environment:

```json
{
  "contentVersion": "1.1.2-stage7.2",
  "fighters": 9,
  "primaryAttacks": 14,
  "gunnerShots": 4,
  "deterministicChecksum": "f4eb1282",
  "massChecksum": "faeebbac",
  "massTicks": 450,
  "massMillisecondsPerTick": 0.6
}
```

The timing is a headless Node measurement, not a browser FPS guarantee. A full dependency-backed `npm run check` and browser/device playtest must still be run locally after `npm install`. The artifact environment's configured npm registry could not retrieve the requested TypeScript package version.
