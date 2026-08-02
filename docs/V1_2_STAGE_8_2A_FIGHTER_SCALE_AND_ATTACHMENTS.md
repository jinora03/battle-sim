# v1.2.2 Stage 8.2A — Fighter Scale and Attachment Readability

## Scope

This stage establishes a readable size foundation for compact battles before the next fighter identity rework.

## Fighter radius tiers

| Fighter | Radius |
| --- | ---: |
| Volt Striker | 45 |
| Void Reaper | 46 |
| Pyro Brawler | 47 |
| Gunner | 48 |
| Water Shaper | 49 |
| Solar Sentinel | 50 |
| Rocket Vanguard | 51 |
| Bomber | 52 |
| Frost Warden | 54 |
| Mech Bruiser | 57 |
| Thorn Colossus | 60 |

`MIN_FIGHTER_RADIUS` is exported from `@kinetic/content` and built-in content is validated against it at startup.

## Radius-aware geometry

Default spawn placement now derives padding and spacing from the resolved fighter radius, including participant radius scaling. Projectile origins, melee reach, health rings, status rings, targeting UI, damage text and mounted attachments were already radius-aware and continue to use the authoritative simulation radius.

## Mounted attachments

Gunner's mounted equipment is intentionally larger and farther from the body:

- Shoulder Missile Pod: scale 1.48
- Deflector Plate: scale 1.42
- Recoil Thrusters: scale 1.24 each
- Targeting Drone: scale 1.36 with a 2.14-radius orbit

Every mounted attachment supports a soft-white silhouette outline. Outline width is computed from fighter radius and attachment scale, with a small LOD adjustment. This keeps attachments readable without changing their gameplay modifiers.

## Compatibility

- Simulation remains deterministic.
- No dependency changes were introduced.
- Existing visibility toggles still control attachments and health rings.
- Boss radius scaling remains data-driven through participant `statScale.radius`.
- Large battle support remains available for stress testing, but this stage is tuned for compact modes.
