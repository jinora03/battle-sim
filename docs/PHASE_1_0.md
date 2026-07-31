# Phase 1.0 — First Complete Core-Game Evaluation Build

## Objective

v1.0 turns the accumulated engine lab into one coherent playable application while preserving the architecture proven in v0.1–v0.9.

The release is intended as the point where the complete system can be evaluated for:

- overall look and identity
- movement and collision feel
- skill readability and uniqueness
- AI and direct controls
- arena/game-mode behavior
- Fighter Lab usability
- progression and unlock flow
- performance and mobile presentation

## Player-facing shell

The application now opens on a release home screen rather than dropping directly into development controls.

It includes:

- featured quick battles
- profile/level summary
- roster and content counts
- concise control guidance
- release-roster preview
- navigation to Battle, Roster, Fighter Lab and Profile

The development-heavy Battle Lab remains available because it is still the best tool for testing arbitrary combinations, seeds, render profiles and telemetry.

## Roster

v1.0 ships eight built-in fighters:

1. Water Shaper
2. Bomber
3. Pyro Brawler
4. Mech Bruiser
5. Frost Warden
6. Volt Striker
7. Thorn Colossus
8. Void Reaper

All eight have:

- complete five-slot kits
- reusable AI profiles
- independent radius/mass/movement statistics
- element, archetype and trait classification
- visual and motion recipes
- unique skill names, telegraphs, cast motions, resolve presentation and audio cues

Pyro and Mech were upgraded from their earlier two-skill demo kits to full release kits.

## New release content

### Frost Warden

- Frost Impact
- Glacier Charge
- Frost Nova
- Ice Anchor
- Absolute Zero

### Volt Striker

- Static Strike
- Lightning Dash
- Arc Burst
- Polarity Pull
- Thunder Dome

### Thorn Colossus

- Thorn Impact
- Bramble Charge
- Seed Burst
- Regenerate
- Overgrowth

### Void Reaper

- Phase Cut
- Phase Lunge
- Gravity Well
- Void Burst
- Singularity

### Completed Pyro kit

- Ember Impact
- Magma Dash
- Flame Ring
- Molten Guard
- Inferno Collapse

### Completed Mech kit

- Steel Impact
- Kinetic Pulse
- Magnet Drag
- Fortify
- Reactor Overdrive

## New arenas

### Cryo Ring

A medium arena with a slippery center, wind lanes and two hard rebound pillars.

### Arc Crucible

A large electric arena with hazard grids, a coolant center, destructible reactors and a central conduit.

These join Iron Pit, Pillar Court, Elemental Foundry and War Basin for six total arenas.

## Progression integration

The release roster is connected to existing event-driven achievements:

- First Blood unlocks Pyro Brawler
- Wrecking Ball unlocks Mech Bruiser
- Pinball unlocks Volt Striker
- Skill Storm unlocks Void Reaper
- Untouchable unlocks Thorn Colossus
- Hazard Course unlocks Frost Warden

Water Shaper and Bomber remain the starter fighters.

New long-term challenges reward arena, mode and skill experimentation.

## Architectural result

v1.0 did not introduce a second engine for new fighters, modes or player-facing screens.

```text
Release Home / Roster / Battle Lab / Fighter Lab / Profile
                         ↓
                Battle configuration
                         ↓
AI / Player / Replay / Network controllers
                         ↓
                  Commands per tick
                         ↓
        Existing deterministic simulation core
                         ↓
Snapshots + semantic events + completion summary
              ↓                    ↓
       Pixi/Audio/UI          Meta progression
```

The four new fighters were created using the same data, TCA ability, AI, visual, motion, FX and audio systems as the original roster.

## Not claimed by v1.0

v1.0 does not claim final commercial polish, balanced competitive PvP, store-ready native binaries, final commissioned art/audio, cloud services or exact cross-device fixed-point determinism.

It is the complete core-game checkpoint from which real playtesting feedback should drive v1.1.
