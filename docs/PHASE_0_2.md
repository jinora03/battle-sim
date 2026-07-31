# Phase 0.2 — Combat Feel Vertical Slice

Phase 0.2 keeps the v0.1 architecture boundaries intact while exercising them with a more demanding matchup: **Water Shaper vs Bomber**.

## Added

- Generic AI movement styles (`chase`, `orbit`, `kite`, `charger`) with wall avoidance.
- Generic per-profile ability-use rules; no fighter-specific AI branching.
- Full demo kits: Basic + Skill 1 + Skill 2 + Skill 3 + Ultimate for Water Shaper and Bomber.
- Separate activation and collision-trigger cooldown channels.
- New TCA actions: `EXPLODE`, `RADIAL_STATUS`, and push/pull radial impulse.
- Semantic `blast` simulation event carrying kind, radius, force, damage, and element.
- Reusable impact-response tiers for particles, shockwaves, camera shake, screen flash, and visual hit freeze.
- Dedicated explosion/wave FX behavior with pooled sparks, smoke, flashes, and shockwaves.
- Procedural Web Audio blast synthesis: low-frequency body + filtered noise, no audio files required.
- Water and Bomber visual recipes and motion recipes.
- Battle Lab fighter selectors while keeping the default matchup Water vs Bomber.
- Skill/blast telemetry and a small achievement hook for repeated blasts.

## Water Shaper kit

- **Basic — Riptide Impact:** collision damage, Wet, extra knockback.
- **S1 — Surge Dash:** directional burst with a temporary speed state.
- **S2 — Pressure Wave:** radial water blast, knockback, Wet.
- **S3 — Undertow:** pulls enemies inward and applies Wet.
- **ULT — Tidal Cataclysm:** large radial water wave.

## Bomber kit

- **Basic — Impact Detonator:** while Blast Dash is armed, a qualifying collision detonates.
- **S1 — Blast Dash:** high-speed charge that arms the collision detonation.
- **S2 — Concussion Bomb:** medium radial explosion.
- **S3 — Shrapnel Burst:** larger explosion plus recoil.
- **ULT — MEGA BOMB:** large high-force explosion.

## Still deliberately deferred

- Full fixed-point cross-device determinism.
- Web Worker simulation.
- Projectile entities / mines / delayed bombs.
- Swept collision/CCD for all high-speed mechanics.
- Large-war LOD and 1,000-unit optimization.
- Player-control UI and real-time multiplayer.
