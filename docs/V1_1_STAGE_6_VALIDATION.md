# v1.1 Stage 6 Validation

## Completed in this artifact

```bash
npm run lint
tsc --noEmit -p tsconfig.validation.json
tsc -p tsconfig.stage6-validation.json
node /tmp/kbe-stage6-validation/validation/v1.1-stage6-vfx.js
```

Validated policies:

- Small healthy battles resolve to High VFX quality.
- Crowded, constrained battles resolve to Low VFX quality.
- Ground-mark and trail budgets decrease with quality.
- Visual radius is independent from gameplay radius.
- Arc Rifle exposes muzzle/beam presentation.
- Sword, hammer and orbit weapons expose distinct trail/ground-mark recipes.
- Element palettes remain visually distinct.
- Repository lint and strict TypeScript validation pass.

## Local dependency-backed validation

Run after installing dependencies:

```bash
npm install
npm run check
npm run dev
```

Manual checks:

1. Ember Sword visibly leaves a slash and occasional scorch residue.
2. Steel Hammer creates heavier debris and crack marks than light weapons.
3. Arc Rifle displays a muzzle flash and a real projectile trail.
4. Cryo Axe leaves ice shards/frost residue.
5. Bomb explosions layer flash, smoke, debris, shockwaves and scorch marks.
6. Status rings follow fighters through movement and camera follow.
7. Ground marks stay fixed in the arena.
8. Disabling Effects clears layered VFX without changing battle state.
9. Disabling Trails removes both fighter and projectile trails.
10. Large skirmishes lower VFX tier while producing the same simulation checksum.
11. Reduced Motion lowers feedback intensity without changing simulation ticks.
12. Ability Lab range/hitbox/projectile-path overlays remain readable over Stage 6 effects.
