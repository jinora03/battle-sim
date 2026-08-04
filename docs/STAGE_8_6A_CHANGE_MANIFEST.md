# Stage 8.6A Change Manifest

## Apply target

Apply this patch on the clean Stage 8.5C branch/tag:

```text
branch: polish/volt-audio-stage8-6
base version: 1.3.7-stage8.5c
new version: 1.3.8-stage8.6a
```

## Added files

### `packages/audio/src/combatAudioProfiles.ts`

Adds the reusable combat-audio model:

- four lifecycle phases;
- ten semantic intents;
- ten material palettes;
- four hierarchy tiers and gain ordering;
- profile lookup/list helpers;
- normalized layer resolution;
- the first complete Thunder Dome profile.

### `tests/stage8-6a-intent-combat-audio.test.ts`

Adds regression tests for:

- lifecycle and supported intents;
- loudness hierarchy ordering;
- complete Thunder Dome profile registration;
- normalized timing and gain;
- generic profile routing with no `id === 'thunder-dome'` branch;
- engine/content version compatibility.

### `docs/V1_3_STAGE_8_6A_INTENT_BASED_COMBAT_AUDIO.md`

Documents architecture, determinism boundaries, validation and the Stage 8.6B handoff.

### `docs/STAGE_8_6A_CHANGE_MANIFEST.md`

This exact path-level implementation manifest.

## Modified files

### `packages/audio/src/index.ts`

- imports and re-exports the profile API;
- defines reusable palette frequency/waveform tuning;
- routes profiled activation events to anticipation playback;
- routes profiled resolve events to activation, sustain and release playback;
- removes Thunder Dome from legacy electric and resolve branches;
- adds generic phase/intent/palette synthesis;
- adds delayed scheduling parameters to tone and pulse helpers;
- reserves critical voice headroom for ultimate anticipation and activation.

### Version markers

Updated `1.3.7-stage8.5c` to `1.3.8-stage8.6a` in:

- `package.json`
- `package-lock.json`
- `apps/game/package.json`
- `packages/content/src/index.ts`
- `packages/simulation/src/runner.ts`
- `tests/content-and-modes.test.ts`
- `tests/stage8-5c-gunner-functionality-correction.test.ts`

### `README.md`

- advances the release heading;
- adds Stage 8.6A highlights and documentation link;
- retains Stage 8.5C history below the new release section.

## Intentionally unchanged

- all ability JSON;
- fighter stats and AI profiles;
- protocol and simulation events;
- Pixi renderer and VFX;
- replay/checksum logic;
- existing non-profiled ability sounds.

## Local validation commands

```bash
npm install
npm run check
```

For a focused audio compile:

```bash
tsc --noEmit -p apps/game/tsconfig.json
npm test -- tests/stage8-6a-intent-combat-audio.test.ts
```
