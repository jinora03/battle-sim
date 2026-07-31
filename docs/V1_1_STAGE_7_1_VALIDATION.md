# v1.1 Stage 7.1 Validation

Validated in the artifact environment:

- repository architecture/style lint;
- full strict TypeScript source validation using temporary external-library declarations;
- Gunner, Automatic Rifle, visual recipe and motion recipe registration;
- generic Fighter Lab weapon activation resolves the equipped weapon's true range;
- one Basic activation emits exactly four deterministic automatic-rifle projectiles;
- AI uses prioritized skills and falls back to Basic when other slots are unavailable;
- AI movement commands face the target independently from steering;
- player pointer targeting selects the enemy nearest the cursor;
- 100-fighter VFX resolves to the low-density policy;
- seeded 50v50 simulation repeats with the same checksum;
- 50v50 exercise includes Basic attacks, skills, ranged/throwable projectiles and numeric-state checks.

The executable headless validation output is stored in:

`validation/v1.1-stage7-1-gameplay-performance-output.txt`

A real dependency-backed `npm run check` and browser/device profiling should still be run after `npm install` because the artifact environment does not contain the project npm dependencies or a graphical browser benchmark.
