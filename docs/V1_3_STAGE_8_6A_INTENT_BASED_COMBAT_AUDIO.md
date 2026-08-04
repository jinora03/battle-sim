# v1.3.8 Stage 8.6A — Intent-Based Combat Audio

## Goal

Stage 8.6A turns Thunder Dome's satisfying multi-part presentation into a reusable audio architecture rather than copying its electric sound into other fighters.

The audio system now separates two concerns:

- **intent** controls the shape of the sound: launch, burst, pull, explosion, channel, release, and similar behavior;
- **palette** controls the material identity: electric, fire, gravity, mechanical, kinetic, water, ice, nature, void, or solar.

This lets a fire explosion and an electric explosion share the same dramatic structure while still sounding materially different.

## Shared lifecycle

A profiled ability may use any of four presentation layers:

1. **Anticipation** — charge, spool, pressure rise, or targeting commitment.
2. **Activation** — launch, ignition, impact, transformation, or mechanical engagement.
3. **Sustain** — beam loop, firing rhythm, field hum, flame roar, or channel pulse.
4. **Release** — impact crack, discharge, pressure release, spin-down, or field collapse.

The profile is optional. Abilities without a profile continue through the Stage 8.5C playback path unchanged.

## Reusable intents

The foundation supports:

- `projectile`
- `burst-fire`
- `beam`
- `explosion`
- `pull`
- `knockback`
- `transformation`
- `channel`
- `status-application`
- `ultimate`

## Loudness hierarchy

The system exposes a strict gain hierarchy:

```text
basic < skill < payoff < ultimate
```

The hierarchy controls relative emphasis before per-layer intensity is applied. Ultimate anticipation and activation layers may use the existing critical voice headroom so they are less likely to disappear during a crowded battle, while the standard voice limits still constrain the later sustain and release layers.

## Thunder Dome reference profile

Thunder Dome is the first complete profile:

| Phase | Intent | Purpose |
|---|---|---|
| Anticipation | `ultimate` | large electric charge buildup |
| Activation | `explosion` | thunderous radial engagement |
| Sustain | `channel` | residual electrical field rhythm |
| Release | `status-application` | final shocked-state discharge |

The old `id === 'thunder-dome'` playback branch has been removed. The engine now resolves the profile and renders its layers through generic intent/palette synthesis.

## Determinism boundary

Stage 8.6A does not change:

- ability definitions;
- damage, cooldowns, ranges, impulses, or statuses;
- AI decisions or spacing;
- simulation events;
- snapshots, checksums, replay data, or command timing.

Sustain and release delays are scheduled only in the browser Web Audio graph. They do not create deterministic simulation timers.

## Files

- `packages/audio/src/combatAudioProfiles.ts`
  - lifecycle, intent, palette and hierarchy types;
  - profile registry and normalized layer resolver;
  - Thunder Dome reference profile.
- `packages/audio/src/index.ts`
  - profile routing for activation and resolution events;
  - generic intent/palette renderer;
  - optional delayed tone and pulse scheduling;
  - critical voice headroom for ultimate anticipation/activation.
- `tests/stage8-6a-intent-combat-audio.test.ts`
  - lifecycle, intent, hierarchy and Thunder Dome profile coverage;
  - source-level regression preventing return to an ability-ID Thunder Dome branch.

## Validation

Completed in the temporary workspace:

- focused strict TypeScript compile for `@kinetic/audio` and `@kinetic/protocol`;
- runtime assertions for profile lookup, phase resolution and hierarchy ordering.

The complete repository `npm run check` could not be executed in this environment because the uploaded archive excludes dependencies and the available npm mirror returned HTTP 404 for `vite@8.1.5`. No `node_modules` directory is included in the deliverables.

Run locally after applying the patch:

```bash
npm install
npm run check
```

## Next phase

Stage 8.6B audits Volt Striker under this standard. It should first determine whether Arc Emitter, Lightning Dash, Arc Burst and Polarity Pull require audio/VFX only, spacing or AI changes, balance changes, or a deeper kit rework.
