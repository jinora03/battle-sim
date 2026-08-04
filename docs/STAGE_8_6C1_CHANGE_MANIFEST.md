# Stage 8.6C-1 Change Manifest

## Release

```text
previous version: 1.3.9-stage8.6b
new version:      1.3.10-stage8.6c1
phase:            Pyro/Ballast audio rollout + Solar Sentinel AI ultimate fix
```

## Changed files

### `packages/audio/src/combatAudioProfiles.ts`

Added complete lifecycle profiles for all four Pyro abilities and all four Ballast abilities. Pyro uses the fire palette; Ballast uses gravity. Combustion and Downbeat are payoff-tier abilities, while Meltdown and Last Call remain ultimates.

### `packages/audio/src/index.ts`

Removed the migrated Pyro and Ballast IDs from legacy charge/resolve conditionals. Their playback now goes exclusively through reusable intent layers.

### `packages/content/src/data/ai/solar-sentinel.json`

Added a dedicated Solar Sentinel AI profile with correct range, defensive timing and no Heat prerequisite.

### `packages/content/src/data/fighters/solar-sentinel.json`

Changed `aiProfileId` from `aggressive-brawler` to `solar-sentinel`.

### `packages/content/src/fighters/solar-sentinel/index.ts`

Registers the dedicated AI profile with the Solar Sentinel content bundle.

### `tests/stage8-6c1-pyro-ballast-sentinel.test.ts`

Added regression coverage for profile registration, hierarchy/palette separation, removal of the Heat gate, AI ultimate command selection, ability activation and synchronized version markers.

### Documentation and version markers

Updated README, package versions, engine/content markers and existing compatibility tests to `1.3.10-stage8.6c1`.

## Gameplay boundary

Pyro and Ballast gameplay data is unchanged. Solar Sentinel's laser implementation is unchanged; only the invalid AI selection profile was corrected.
