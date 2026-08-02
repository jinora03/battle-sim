# Stage 8.2R6.7 — Fighter Collision and Runner Façade

## Goal

Complete the first simulation-runner decomposition pass without changing
combat results, event ordering, snapshots, replay checksums, or public APIs.

`LocalSimulationRunner` remains the composition root and deterministic tick
orchestrator. Detailed fighter contact, primary-attack, participant-spawn, and
numeric-recovery behavior now lives in focused systems.

## Extracted systems

### FighterCollisionSystem

Owns deterministic fighter-to-fighter contact processing:

- spatial candidate-pair traversal
- same-team collision policy
- overlap correction
- restitution and momentum response
- protected external-impulse trajectory preservation
- impact events
- collision-triggered ability dispatch
- collision diagnostics

The Mega Bomb minimum-wall-bounce protection is preserved exactly.

### PrimaryAttackSystem

Owns the complete primary-weapon lifecycle:

- activation validation
- player-versus-AI range behavior
- cooldown start
- windup, active, and recovery phases
- ranged bursts and throwable launches
- melee arc resolution
- primary damage, knockback, statuses, and passives
- weapon presentation events

### ParticipantSpawnSystem

Owns deterministic initial placement:

- requested, team, and generic spawn-zone selection
- radius-aware grid spacing
- seeded spawn jitter
- arena-orbit fallback placement
- maximum spawned fighter-radius calculation

### NumericStateRecoverySystem

Owns defensive recovery for invalid fighter and projectile numeric state while
leaving valid state untouched.

## Runner role after R6.7

`runner.ts` is reduced from approximately 778 lines to 506 lines. It now mainly
owns:

- battle and training policy
- system construction and dependency wiring
- deterministic tick ordering
- snapshots and public runner methods
- shared status application
- battle finalization

## Deliberately unchanged

- `SimulationRunner` public API
- tick rate and system order
- battle definitions and replay formats
- collision formulas and event ordering
- primary-attack validation and timing
- damage, knockback, projectiles, abilities, statuses, and arena behavior
- spawn positions and RNG consumption
- battle-result behavior

## Validation

The R6.6 baseline and R6.7 refactor were compiled separately and executed with
identical deterministic scenarios covering:

- Gunner AI duel and ranged primary attacks
- Solar Laser channeling
- Rocket Vanguard delayed missiles
- Bomber Mega Bomb and protected wall bounces
- collision-triggered abilities
- Gunner passives and Target Lock

The complete serialized outputs matched byte-for-byte, including checksums,
ordered events, entities, projectiles, ticks, and results.
