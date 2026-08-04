# V1.3 Stage 8.7A — Intent-Based Combat VFX Foundation

## Goal

Stage 8.7A introduces a reusable combat-VFX lifecycle so presentation can be authored by ability intent instead of adding a new fighter or ability ID branch to the Pixi renderer every time.

The lifecycle mirrors the combat-audio standard:

```text
anticipation -> activation -> sustain -> release
```

This phase is presentation-only. It does not change ability actions, damage, statuses, cooldowns, AI, physics, projectiles, replay data, or deterministic simulation output.

## Reusable profile model

Each profiled ability declares:

- a gameplay-neutral element palette
- a presentation hierarchy: basic, skill, payoff, or ultimate
- one or more lifecycle layers
- an intent for each layer
- an event anchor: ability activated or ability resolved
- optional delay, duration, intensity, and visual-radius scaling

Supported intents are:

```text
projectile
dash
beam
explosion
pull
knockback
status
transformation
channel
ultimate
```

The renderer converts these semantic layers into particles, flashes, directional bursts, shockwaves, and residual effects. Unconverted abilities continue using the existing `SkillPresentationRecipe` path.

## Thunder Dome reference migration

Thunder Dome is the first complete profile because it was already the quality benchmark for Stage 8.6 audio.

Its visual lifecycle is now:

1. **Anticipation** — cast-length electric charge bloom on `abilityActivated`
2. **Activation** — high-importance radial electric detonation on `abilityResolved`
3. **Sustain** — delayed residual electrical field
4. **Release** — delayed shocked-status discharge

The profile is data-driven and contains no `event.abilityId === 'thunder-dome'` renderer branch.

## Quality and scale behavior

Two renderer paths consume the same profile:

- `FxEngine` provides the full presentation for high/medium-quality battles with up to 40 fighters.
- `LayeredVfxEngine` provides a simplified, budget-aware representation when quality is low or fighter count exceeds 40.

Ultimate profiles remain priority presentation events in crowd mode. Delayed lifecycle layers are held in presentation-only queues and are cleared by renderer reset, so they cannot leak across battle restarts or Ability Lab sessions.

## Compatibility

- Existing skill telegraphs and resolve recipes remain available as fallback.
- Existing large-battle presentation budgets remain authoritative.
- Battle and Ability Lab use the same Pixi renderer and therefore the same profile behavior.
- Engine/content compatibility markers advance together to `1.3.15-stage8.7a`.

## Validation

Validated in the provided environment:

- project lint
- strict TypeScript validation for protocol, visual-engine, and the affected renderer files
- profile resolver runtime assertions
- patch whitespace validation

The complete root `npm run check` should still be run in the local repository with its installed dependencies.
