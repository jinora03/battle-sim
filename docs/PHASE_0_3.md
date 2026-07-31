# Phase 0.3 — Skill Presentation and Readability

Phase 0.3 addresses a crucial problem discovered in v0.2: skills could be executing correctly inside the simulation while still looking too similar to ordinary movement and collisions.

The design rule is now:

> **Every meaningful skill must communicate itself through motion, effect silhouette and UI state.**

Shared low-level effects remain reusable, but the complete skill choreography is unique.

## What changed

### Deterministic cast phases

Abilities can define:

- `castTicks`
- `castMovementMultiplier`
- cooldown duration

The simulation exposes each equipped ability as one of:

- `ready`
- `casting`
- `cooldown`

`abilityActivated` is emitted when the fighter commits. `abilityResolved` is emitted when its actions actually execute.

### Skill presentation recipes

Each supported Water/Bomber skill now has a presentation recipe containing:

- icon and short UI name
- primary/accent colors
- importance (`basic`, `skill`, `ultimate`)
- telegraph style
- cast-motion style
- resolve-effect style
- telegraph radius

These recipes live in `packages/visual-engine` and do not affect gameplay.

### Battlefield telegraphs

The Pixi renderer now has a dedicated skill-telegraph layer. Examples:

- **Surge Dash:** directional water stream
- **Pressure Wave:** expanding concentric rings
- **Undertow:** rings and particles moving inward
- **Tidal Cataclysm:** large gathering water sequence
- **Blast Dash:** rocket/ignition direction
- **Concussion Bomb:** danger radius
- **Shrapnel Burst:** radial shard lock
- **MEGA BOMB:** large pulsing danger zone and countdown feeling

A label above the fighter shows the active skill name while casting.

### Distinct cast motion

The character renderer applies presentation-only skill poses such as:

- stream/stretch
- compression/brace
- vortex twist
- gather/pulse
- rocket lean
- radial spin
- ultimate tremble

These poses are derived from the cast snapshot and do not mutate simulation positions.

### Unique resolve effects

Each skill resolves through a distinct FX recipe layered over shared primitives:

- water splash
- directional dash burst
- pressure-wave rings
- undertow vortex
- multi-ring tidal ultimate
- fuse/contact pop
- rocket exhaust
- concussion blast
- shrapnel shards
- oversized Mega Bomb flash/shockwave/debris

The simulation still emits generic semantic events such as `blast`; Pixi decides how the named skill should appear.

### UI indicators

Each fighter card now displays all equipped slots:

- Basic
- Skill 1
- Skill 2
- Skill 3
- Ultimate

The indicator visually distinguishes:

- ready
- currently casting, including cast progress
- cooldown, including remaining seconds
- recently resolved flash

The arena also shows a cast banner with fighter name, skill name and progress.

### Per-skill procedural audio

The audio layer responds separately to ability start and resolve events. Water skills use rising/falling fluid tones, while Bomber skills use harsher fuse, warning and detonation signatures. Ultimates receive stronger layered cues.

No MP3/WAV asset is required for the current demo; sample-based audio can be layered in later without changing the event architecture.

## Architectural result

```text
Simulation
  abilityActivated / casting snapshot / abilityResolved
                  ↓
     ┌────────────┼─────────────┐
     ↓            ↓             ↓
Telegraph      Skill motion   React UI
     ↓            ↓             ↓
Resolve FX      character      cooldown/cast
                  ↓
                Audio
```

The skill presentation layer is reusable for future fighters. Adding a new skill normally requires gameplay data plus a presentation recipe; highly unusual visuals can use a controlled custom renderer/plugin.
