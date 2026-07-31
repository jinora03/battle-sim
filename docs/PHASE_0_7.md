# Phase 0.7 — Multi-Fighter Combat & Scale

## Goal

Prove that the same deterministic simulation can move beyond 1v1 into teams, free-for-all battles, and larger automatic skirmishes without introducing a second battle engine.

## Added in v0.7

### Mass Skirmish

- New `mass-skirmish` game mode supports 10–100 configured fighters.
- New `War Basin` arena is 2400 × 1600 and is designed for 16–80 fighters.
- Existing Team Battle and Battle Royale participant limits were expanded.

### Team-aware AI

AI profiles now select targets using one of four reusable strategies:

- nearest
- lowest health
- largest/heaviest
- clustered target

Target load is tracked during each AI command pass so an entire team does not automatically select the same opponent. Profiles can control target spreading, target stickiness, and ally-separation steering.

### Crowd collision rules

Battle definitions can choose:

- `full`: allies collide normally
- `soft`: reduced impulse between allies
- `ghost`: allies pass through each other

Friendly fire is a separate rule. A team can use soft physical collisions while still being immune to allied damage and allied ability triggers.

### Spatial and combat metrics

Each world snapshot reports:

- active entities
- commands processed
- broadphase candidate pairs
- resolved contacts
- same-team contacts

This lets scaling decisions be based on actual measurements rather than guesses.

### Presentation scaling

Pixi automatically selects:

- hero LOD for small fights
- standard LOD for medium fights
- army LOD for large fights

Crowds also reduce particle density, trail sampling, health-bar detail, layered fighter parts, and simultaneous skill telegraphs. Player-controlled fighters remain at hero quality.

### Audio prioritization

The audio engine ranks deaths, ultimates, blasts, hazards, and impacts, then limits how many events and voices are played based on battle size. Large battles therefore emphasize important foreground events instead of playing every minor collision.

### Battle Lab additions

- team counts up to 50 per side
- friendly-fire toggle
- full/soft/ghost ally-collision selector
- team survival/HP summaries
- automatic roster-card capping for large battles
- simulation, collision, rendering, particle, and audio telemetry

## Deliberate limitations

- The hot simulation stores are not fully migrated to TypedArrays yet.
- Simulation is still on the main browser thread.
- AI target selection is currently straightforward and can still become expensive near 100 units.
- Army LOD is functional, not final art direction.
- This phase validates 20v20 headlessly; 100-unit device performance must be profiled on real hardware.

Those are optimization tasks, not architectural redesigns.
