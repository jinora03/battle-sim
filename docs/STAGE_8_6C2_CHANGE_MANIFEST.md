# Stage 8.6C-2 Change Manifest

## Version

- Previous: `1.3.11-stage8.6c2a`
- New: `1.3.12-stage8.6c2`

## Added

### `tests/stage8-6c2-gunner-sentinel-audio.test.ts`

Covers:

- all Gunner and Solar Sentinel ability-profile registrations
- mechanical versus solar palette identity
- skill/payoff/ultimate hierarchy
- Kill Zone activation-anchored barrage lifecycle
- Solar Eye Beams charge, ignition, sustain, contact, and shutdown separation
- removal of migrated hardcoded ability-ID branches
- compatibility-version alignment

### `docs/V1_3_STAGE_8_6C2_GUNNER_SENTINEL_AUDIO.md`

Implementation and design notes for the fighter rollout.

### `docs/STAGE_8_6C2_CHANGE_MANIFEST.md`

Exact change inventory and validation summary.

## Modified

### `packages/audio/src/combatAudioProfiles.ts`

- adds `activated` and `resolved` lifecycle anchors
- adds reusable channel-contact metadata and resolver
- registers Tactical Slide, Suppressive Burst, Pinning Round, and Kill Zone
- registers Sky Rush, Thunder Clap, Solar Aegis, and Solar Eye Beams
- schedules Kill Zone firing and spin-down around its real barrage window
- schedules Solar Eye Beams ignition/sustain after its existing warmup

### `packages/audio/src/index.ts`

- routes profile layers according to their event anchor
- tracks profiled channels through semantic simulation events
- emits rate-limited contact cues only from real damage events
- adds reusable beam ignition/shutdown rendering
- adds reusable mechanical spool, burst sustain, and spin-down rendering
- gives Solar Punch a distinct basic-attack read
- removes old Gunner and Solar Eye Beams ability-ID playback branches

### Version and compatibility files

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- version assertions in existing release tests

### `README.md`

Adds Stage 8.6C-2 release highlights and links to the implementation notes.

## Explicitly unchanged

- fighter and ability JSON
- Gunner targeting, firing intervals, damage, and projectile behavior
- Solar Eye Beams damage, warmup, range, tracking, and channel duration
- Stage 8.6C-2A seeded opening-readiness behavior
- simulation RNG and replay command flow

## Validation

- project lint passed
- strict TypeScript compilation passed for protocol and audio packages
- runtime profile assertions passed for all eight migrated abilities
- Kill Zone lifecycle anchor assertions passed
- Solar Eye Beams contact-profile assertions passed
- full `npm run check` remains a required local validation because the provided archive does not include the root dependency installation
