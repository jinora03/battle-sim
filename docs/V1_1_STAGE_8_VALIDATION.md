# v1.1 Stage 8 — Validation Report

## Automated source checks performed

The Stage 8 source was checked with:

```bash
npm run lint
tsc --noEmit -p tsconfig.validation.json
tsc -p tsconfig.stage8-validation.json
node <compiled validation/v1.1-stage8-platform.js>
```

The repository lint and strict source validation passed in the build environment.

The full dependency-backed command remains:

```bash
npm install
npm run check
```

`npm run check` performs the application TypeScript check, complete Vitest suite and production Vite build. It should be run locally after dependencies are installed.

## Stage 8 regression tests

`tests/stage8-mobile-rendering.test.ts` verifies:

- portrait and compact viewport classification;
- short-landscape classification;
- internal resolution calculation;
- device-pixel-ratio capping;
- configurable render scaling;
- adaptive presentation scaling;
- migration from settings schema v4 to v5;
- propagation of render scale into presentation settings;
- mobile automatic quality defaults.

Existing Stage 3, Stage 4 and Stage 5 tests remain in the project, including weapon behavior, deterministic camera math and Ability Lab rules.

## Executable platform validation

`validation/v1.1-stage8-platform.ts` checks representative phone and desktop policies without requiring React or Pixi. It validates:

- compact portrait classification;
- short-landscape classification;
- high-DPR capping;
- adaptive resolution reduction;
- touch-first default quality selection;
- settings schema migration;
- presentation-setting propagation.

The captured output is stored in:

```text
validation/v1.1-stage8-platform-output.txt
```

## Manual browser checks still required

Automated source validation cannot prove layout and GPU behavior on real devices. Before treating Stage 8 as release-certified, run the matrix in `docs/STAGE_8_DEVICE_QA.md`, particularly:

- repeated portrait/landscape rotation;
- mobile browser address-bar expansion/collapse;
- entering and leaving fullscreen;
- backgrounding and restoring the app;
- iOS safe-area behavior;
- Android keyboard/viewport behavior;
- WebGL context interruption where browser tooling permits;
- arena readability at Battery, Balanced and High settings;
- 20v20 rendering on the actual target devices.

## Determinism boundary

Stage 8 resolution, DPR, frame target, viewport and lifecycle changes are presentation controls. They do not enter simulation state or checksums. The fixed-tick simulation remains authoritative.
