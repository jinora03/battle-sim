# Phase 0.4 — Player Control and Battle Setup

Phase 0.4 proves that direct control can be added without redesigning the deterministic simulation.

## Unified command path

Each participant now carries a controller kind:

- `ai`
- `player`
- `replay`
- `network`

The world snapshot exposes this classification. `AiController` deliberately ignores non-AI entities; `PlayerController` emits commands only for the entity IDs assigned to it.

```text
Held keyboard/touch movement
          ↓
PlayerController
          ↓
MoveCommand / ActivateAbilityCommand
          ↓
LocalSimulationRunner
```

The runner does not know whether the command came from a person, AI, replay, or network transport.

## Input adapters

The React app translates:

- keyboard state into persistent movement
- mouse position into world-space aim direction
- skill keys/clicks into one-shot activation commands
- touch D-pad input into the same movement state

The controller emits held movement every fixed tick, while skill presses are consumed once.

## Player-readable controls

- Player-controlled fighters receive a white marker in the Pixi renderer.
- Skill indicators become clickable when an active skill is ready.
- Passive collision basics show `AUTO` and are not misleadingly clickable.
- The existing casting/cooldown indicators remain authoritative because they read simulation snapshots.
- Camera follow is presentation-only and can be disabled.

## Battle setup

`BattleSetup` now selects:

- Team 1 fighter and controller
- Team 2 fighter and controller
- arena
- game mode
- deterministic seed

The current UI intentionally permits only one local player input source at a time. Selecting Player on one team automatically returns the other team to AI. This avoids pretending local two-player input is complete before separate mappings/gamepads exist.

## Pyro and Mech presentation

Phase 0.4 also gives the existing Pyro/Mech skills explicit presentation identities:

- **Magma Dash:** fire lane charge, directional flame burst, brief committed cast
- **Inferno Collapse:** large danger ring and multi-layer inferno resolution
- **Kinetic Pulse:** mechanical brace, expanding cyan rings, hard pulse impact
- **Reactor Overdrive:** reactor-charge spokes, powered scaling motion, energy release

These use the same presentation-recipe contract introduced for Water and Bomber.

## Multiplayer relevance

This is not multiplayer implementation. It is the boundary multiplayer will need:

```text
Network input → NetworkController → SimulationCommand
```

Real-time multiplayer still requires server authority, prediction/reconciliation, transport, cheating protection, and disconnect handling. Phase 0.4 prevents those systems from having to bypass or rewrite combat.
