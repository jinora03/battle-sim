# Stage 8.7C-3 Change Manifest

## Version

- Previous: `1.3.18-stage8.7c2`
- New: `1.3.19-stage8.7c3`

## Modified files

### `packages/visual-engine/src/combatVfxProfiles.ts`

- Adds complete VFX profiles for Bomber:
  - `blast-dash`
  - `concussion-bomb`
  - `shrapnel-burst`
  - `mega-bomb`
- Adds complete VFX profiles for Mech Bruiser:
  - `kinetic-pulse`
  - `magnet-drag`
  - `fortify`
  - `reactor-overdrive`
- Adds explicit `directional` metadata to VFX layers.
- Marks Downbeat and Sky Rush knockback as directional.
- Resolves unspecified knockback layers as radial by default.

### `packages/renderer-pixi/src/effects/FxEngine.ts`

- Adds dedicated generic explosion rendering for profiled activation layers.
- Adds radial versus directional knockback handling.
- Adds neutral smoke/debris sustain for explosive profiles.
- Adds metal spark/debris sustain for mechanical profiles.

### `packages/renderer-pixi/src/layeredVfx.ts`

- Adds the same radial/directional distinction to the budgeted renderer.
- Uses smoke for neutral profiles and debris for metal profiles.
- Adds simplified profiled explosion and sustained machinery/smoke presentation.

### `packages/audio/src/combatAudioProfiles.ts`

- Adds reusable `CombatAudioVariant` support.
- Adds the `cataclysmic-explosion` variant.
- Applies the variant to Mega Bomb activation.
- Keeps the existing Bomber audio hierarchy and lifecycle.

### `packages/audio/src/index.ts`

- Adds reusable low-register catastrophic explosion synthesis.
- Uses sub-bass oscillators and low-pass pressure noise.
- Avoids an ability-ID-specific Mega Bomb branch.

### `tests/stage8-7c3-bomber-mech-vfx-audio.test.ts`

- Verifies all eight VFX profiles.
- Verifies Bomber and Mech visual hierarchy.
- Verifies radial versus directional knockback metadata.
- Verifies the reusable Mega Bomb audio variant and low-pass synthesis path.
- Verifies engine/content compatibility markers.

### Version files

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`

### Documentation

- `docs/V1_3_STAGE_8_7C3_BOMBER_MECH_VFX_AND_MEGA_BOMB_AUDIO.md`
- `docs/STAGE_8_7C3_CHANGE_MANIFEST.md`

## Explicitly unchanged

- Fighter JSON
- Ability JSON
- Damage
- Cooldowns
- Knockback magnitude
- AI selection
- Opening readiness
- Physics
- Replay checksums
- Simulation RNG
- README
