# Stage 8.6C-2A Change Manifest

Previous version: `1.3.10-stage8.6c1`

New version: `1.3.11-stage8.6c2a`

## Added

- `packages/controllers/src/seededDecisionVariation.ts`
  - deterministic opening windows by ability class
  - seed-derived first-use ticks without consuming simulation RNG
  - bounded ability-score jitter keyed by a persistent decision epoch
- `tests/stage8-6c2a-seeded-opening-readiness.test.ts`
- `docs/V1_3_STAGE_8_6C2A_SEEDED_OPENING_READINESS.md`

## Updated

- `packages/controllers/src/actionSelection.ts`
  - optional AI selection context
  - opening-lockout validation and debug reasons
  - bounded deterministic score variation
- `packages/controllers/src/index.ts`
  - exports opening-readiness helpers
  - stores an ability variation epoch per AI entity
  - advances the epoch only after an ability command is selected
- `tests/stage8-6c1-pyro-ballast-sentinel.test.ts`
  - verifies Sentinel does not ult immediately and still activates Solar Eye Beams after the lockout
- root, app, engine and content version markers
- compatibility expectations and README

## Explicitly unchanged

- ability damage, cooldowns and cast durations
- Solar Eye Beams tracking and channel implementation
- fighter AI profiles and priority values
- player-controlled ability readiness
- replay schema
- simulation RNG consumption order
