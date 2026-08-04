# Stage 8.6C-3 Change Manifest

## Version

- Previous: `1.3.12-stage8.6c2`
- New: `1.3.13-stage8.6c3`

## Added

### `tests/stage8-6c3-bomber-mech-audio.test.ts`

Covers:

- all Bomber and Mech Bruiser profile registrations
- reusable explosive-palette availability
- Bomber skill/payoff/ultimate hierarchy
- Mega Bomb's complete arming-to-release lifecycle
- Mech pulse, pull, armor-lock, and reactor lifecycles
- removal of migrated hardcoded ability-ID branches
- retained Impact Bomb and Hydraulic Gauntlet basic-attack paths
- compatibility-version alignment

### `docs/V1_3_STAGE_8_6C3_BOMBER_MECH_AUDIO.md`

Implementation and design notes for the final initial roster-audio batch.

### `docs/STAGE_8_6C3_CHANGE_MANIFEST.md`

Exact change inventory and validation summary.

## Modified

### `packages/audio/src/combatAudioProfiles.ts`

- adds the reusable `explosive` palette
- registers Blast Dash, Concussion Bomb, Shrapnel Burst, and Mega Bomb
- registers Kinetic Pulse, Magnet Drag, Fortify, and Reactor Overdrive
- classifies Shrapnel Burst and Fortify as payoff abilities
- preserves Mega Bomb and Reactor Overdrive as ultimate-tier profiles

### `packages/audio/src/index.ts`

- adds reusable explosive-palette synthesis tuning
- adds generic fuse/arming, ignition, blast-pressure, and release treatment
- gives Impact Bomb distinct commit, launch, fuse, and impact cues
- gives Hydraulic Gauntlet distinct servo preload and piston-slam impact cues
- removes Bomber and Mech ability IDs from legacy charge/resolve branches

### Version and compatibility files

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- version assertions in existing release tests

### `README.md`

Adds Stage 8.6C-3 release highlights and links to the implementation notes.

## Explicitly unchanged

- fighter and ability JSON
- Bomber projectile speed, fuse, homing, explosion, damage, and knockback
- Mech damage, healing, statuses, movement, and cooldowns
- AI profiles and Stage 8.6C-2A seeded opening readiness
- simulation RNG, checksums, and replay command flow

## Validation

- project lint passed
- strict TypeScript compilation passed for protocol and audio packages
- runtime assertions passed for all eight migrated profiles
- profile registry increased from 20 to 28 abilities
- Mega Bomb and Reactor Overdrive four-layer lifecycle assertions passed
- full `npm run check` remains a required local validation because the provided archive does not include the root dependency installation
