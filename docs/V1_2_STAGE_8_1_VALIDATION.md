# v1.2 Stage 8.1 Validation

Validation was performed against the Stage 8.0 codebase with the passive-event and skill-projectile renderer hotfixes already applied.

## Completed checks

- Project architecture/style lint: passed.
- Strict TypeScript validation for protocol, content, simulation, controllers, visual engine, Pixi renderer and Stage 8 tests: passed.
- App/renderer TypeScript syntax transpilation: passed.
- Git whitespace/error check: passed.
- Module registry and attachment recipe runtime validation: passed.
- Four-slot deterministic loadout resolution: passed.
- Attachment registry cloning/immutability guard: passed.
- Movement modifier application at spawn: passed.
- Deflector Plate damage reduction: passed.
- Shoulder Missile Pod skill-projectile damage multiplier: passed.
- Targeting Drone orbit-pose calculation: passed.
- Active-ID buffer uniqueness regression: passed.
- Two identical 50v50 all-Gunner module runs produced the same checksum.

## Headless 50v50 sample

Reference environment: Node 22.16.0 in the validation container.

- Fighters: 100 Gunner entities
- Equipped on every fighter: Shoulder Missile Pod, Deflector Plate, Recoil Thrusters and Targeting Drone
- Sampled ticks: 300 after 30 warm-up ticks
- Average AI + simulation step: approximately 1.14 ms
- p95: approximately 2.31 ms
- Maximum sampled step: approximately 3.83 ms
- Deterministic repeated checksum: passed

These figures are machine-dependent and measure the headless controller/simulation path. They do not include PixiJS, React, audio or browser compositing. Mounted visuals are hidden at Army LOD by default, limiting presentation overhead in 50v50 battles.

## Local commands still required

Run on the developer machine with the complete workspace dependencies:

```powershell
npm run check
npm run bench
npm run dev
```

Manual browser checks:

1. Equip each mounted module separately and verify its visual placement.
2. Equip one module in every slot and verify all five physical components render together.
3. Switch fighters and confirm incompatible module selections are cleared.
4. Save/reload a preset and export/import a replay with mounted modules.
5. Test reduced motion, standard quality and a 50v50 Army-LOD battle.
6. Verify immediate Fight-tab entry and skill-projectile impacts still do not stop the render loop.
