# v1.3.1 Stage 8.4A — Mass-Manipulation Foundation

Stage 8.4A adds only the generic engine/content pieces required by Ballast. It does not add or balance the fighter yet.

## Status mass stacking

`StatusDefinition.massMultiplier` remains a fixed multiplier. The new optional `massMultiplierPerStack` is multiplied once for every active stack. Existing statuses are unchanged because the field is opt-in.

Two reusable statuses are registered:

- `featherlight`: up to three stacks, each multiplying mass by `0.63`; three stacks resolve to approximately `0.25x` effective mass.
- `anchored`: a fixed `3.2x` mass multiplier with slower movement.

The simulation already routes fighter collisions and knockback through `World.getEffectiveMass()`, so these statuses automatically affect launch distance and collision response without a Ballast-specific branch.

## Finite native ricochets

Projectile definitions now accept optional `maxWallBounces`. When omitted, existing native-bounce projectiles keep their legacy unlimited bounce behavior until lifetime/fuse expiry. Module-granted primary ricochets continue to use the existing loadout fields.

## Presentation

Statuses may opt into `massPresentation: light | heavy`. `FighterStatusIndicators` renders those hints generically and does not branch on fighter IDs.

## Determinism and compatibility

- Fixed tick order is unchanged.
- No random calls were added.
- Existing status multipliers and projectile definitions retain their previous behavior.
- Engine/content version is `1.3.1-stage8.4a`.
- Replay schema is unchanged.

## Next phase

Stage 8.4B can add Ballast content using these primitives: Skip Stone, Featherfall, Downbeat, Dead Weight and Last Call.
