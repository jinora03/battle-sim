# Phase 0.6 — Arenas, Game Modes & Environmental Interaction

## Goal

Prove that the combat engine is not accidentally designed around one empty rectangle or one duel rule. Fighters, player input, AI, abilities, replay and the Fighter Lab must work unchanged across different arena geometry and victory conditions.

## Delivered

### Arena content model

Each arena now defines:

- real width and height
- spatial-grid cell size
- descriptive size/theme
- recommended fighter range
- compatible mode IDs
- team-specific and free spawn zones
- circle/box obstacles
- destructibility and collision properties
- environmental zones

### Arena catalog

- **Iron Pit:** clean small ricochet arena
- **Pillar Court:** medium obstacle arena with four pillars and a destructible crate
- **Elemental Foundry:** large hazard arena with a destructible reactor/crates and five environmental zone types

### Game modes

- Duel
- Team Battle
- Battle Royale
- Boss Raid
- Survival Trial

Mode definitions own participant limits and victory rules. Arena definitions own compatibility.

### Environmental interactions

- Ice changes steering/damping to create sliding.
- Water slows fighters and applies Wet.
- Lava periodically damages and burns.
- Electricity periodically damages/launches; Wet amplifies its damage.
- Wind continuously pushes along its configured direction.

### Obstacles

- deterministic circle and axis-aligned box collision
- individual restitution
- optional contact damage
- impulse-gated destructible HP
- obstacle state exposed in snapshots
- impact/damage/destruction events for FX, sound, statistics and achievements

### Battle Lab

- arena and game-mode selectors
- automatic compatibility handling
- mode-dependent roster generation
- team-size controls
- arena dimensions/capacity/object/zone summaries
- objective banner
- arena activity feed and telemetry
- debug spawn-zone and obstacle rendering

### Meta and presentation

- obstacle/hazard statistics
- `Wrecking Ball` achievement hook
- procedural obstacle and hazard audio
- zone and obstacle effects
- arena themes and mutable obstacle health bars

## Architectural proof

The following remain unchanged across all modes:

```text
Controller → Commands → Simulation → Snapshots/Events → Presentation
```

There is no separate Team Battle physics engine or Boss fighter class. Bosses are ordinary fighter content with participant stat scaling, while the mode supplies the boss-team victory rule.

## Deliberate limits

- Obstacles are static circles or axis-aligned boxes, not arbitrary polygons.
- Destroyed obstacles disappear; full physical debris is presentation-only for now.
- Survival uses a fixed starting enemy roster. Timed waves/director logic belongs to a later phase.
- Arena authoring is source-controlled JSON; an Arena Lab UI is deferred.
- Large-war optimization is deferred until v0.7 profiling.
