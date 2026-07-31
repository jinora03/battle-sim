# Target Architecture

## 1. Four layers

### Simulation
Answers **what actually happened**: physics, combat, abilities, statuses, victory, game rules.

### Control
Answers **who decided what to do**: AI, player input, replay, or network input. All control sources output the same command types.

### Presentation
Answers **what it looks and sounds like**: PixiJS character construction, procedural motion, FX, camera and audio.

### Meta
Answers **what happens around battles**: stats, achievements, progression, replay storage, profiles and eventually matchmaking.

## 2. Deterministic + dynamic

The scaffold uses a fixed tick, seeded RNG, numeric IDs, stable iteration, and deterministic command ordering. Combat remains emergent: the seed and rules produce collisions rather than scripted timelines.

The current scaffold uses JavaScript floating point. Exact cross-device bit-identical replays are intentionally deferred until that becomes a product requirement. The simulation boundary is designed so a quantized/fixed-point numeric layer can be introduced without touching Pixi.

## 3. Content composition

A fighter is not its element. A fighter definition contains independent concerns:

```text
Identity
Classification
  archetype
  elements[]
  traits[]
Physics
  radius
  mass
  restitution
Stats
AI profile
Ability slots
Resistances
Visual recipe
Animation recipe
Audio profile
```

This allows a large lightweight fighter, a tiny heavy fighter, hybrid elements, bosses, and unusual mechanical traits without inheritance chains.

## 4. TCA abilities

Most abilities are assembled from:

```text
Trigger → Conditions → Actions
```

The current action vocabulary includes impulses, damage, statuses, knockback, radial effects and healing. Truly unusual mechanics should eventually use a typed code-plugin escape hatch rather than turning JSON into a programming language.

## 5. Rendering profiles

The same snapshot can be rendered as:

- `standard`: layered procedural character visuals + trails + FX
- `minimal`: circles/lines for readability and performance
- `debug`: colliders, velocity vectors, IDs and spatial grid

This is also the future basis for war-scale LOD.

## 6. Future multiplayer

The architecture accommodates multiplayer because network input can become another command source. This avoids a simulation rewrite, but real-time multiplayer is still a major feature requiring server authority/lockstep strategy, prediction, reconciliation, anti-cheat and transport infrastructure.

## Phase 0.2 additions

Phase 0.2 validates the same boundaries with richer combat rather than changing them:

- `AiController` now consumes generic movement profiles and per-slot ability-use rules.
- TCA actions can emit semantic radial blasts and area statuses; collision-triggered abilities use a cooldown channel separate from activation cooldowns.
- `BlastEvent` is simulation truth (`kind`, `radius`, `force`, `damage`, `element`), while Pixi/audio independently decide presentation.
- `visual-engine` owns reusable impact-response tiers and the `impactFreeze` presentation setting.
- Water/Bomber prove that a new fighter can be composed from classification + physics + AI + full ability kit + visual/motion/audio recipes without adding fighter-specific simulation branches.


## Phase 0.3 additions

Phase 0.3 adds a presentation contract for skills without moving presentation concerns into gameplay:

- Abilities may define deterministic cast duration and movement scaling while casting.
- Simulation snapshots expose each equipped slot as `ready`, `casting`, or `cooldown`.
- `AbilityActivatedEvent` and `AbilityResolvedEvent` split commitment/telegraph from gameplay resolution.
- `visual-engine` maps ability IDs to reusable presentation recipes: telegraph, cast motion, resolve style, UI icon/color and importance.
- Pixi owns battlefield telegraphs, above-fighter labels, unique skill poses and resolve effects.
- React observes the same snapshots/events to show cast banners and five-slot cooldown indicators.
- Audio observes start/resolve events and supplies distinct procedural cues.

The simulation does not reference any animation, UI, camera, particle or sound identifier. A low-quality/mobile renderer may simplify all of these while preserving identical gameplay.

## Phase 0.4 additions

Phase 0.4 makes controller ownership explicit in participants and snapshots. AI, local player, replay, and future network sources are peers that emit `SimulationCommand` values. The stateful local player controller keeps held movement separate from one-shot skill activation. React/DOM input remains outside the simulation.

The Pixi renderer may optionally follow the player entity and draw a player marker, but both are presentation-only. Replays capture the resulting commands rather than browser events, preserving the engine boundary.

## Phase 0.5 additions

Phase 0.5 introduces **authoring and runtime registration** without weakening the original boundaries.

```text
Fighter Lab
   ↓
@kinetic/creator
   ↓ validate bundle + references
Content / Visual runtime registries
   ↓
Existing getFighter / getVisualRecipe / getMotionRecipe APIs
   ↓
Unchanged controllers, simulation, renderer, audio and replay
```

The creator is not a second game engine. It produces versioned content consumed by the same APIs as built-in content.

### Protected built-ins

Built-in fighter, visual, and motion IDs cannot be overwritten by imported runtime content. Custom definitions may be updated or removed. This prevents an imported file from silently changing the meaning of a built-in replay or battle setup.

### Portable bundle boundary

`FighterBundle` groups the minimum definitions needed to reconstruct a composed fighter:

- simulation-facing fighter definition
- presentation-facing visual recipe
- presentation-facing motion recipe

Ability definitions and AI profiles are referenced by ID rather than copied into each fighter bundle. That reduces duplication and keeps shared mechanics centrally versioned.

### Future migration path

A later creator can also emit ability, FX, audio, and attachment definitions. Those should be additional validated content-package sections, not arbitrary executable code. Truly unusual mechanics remain candidates for a typed, permissioned plugin boundary.

## Phase 0.7 additions

Phase 0.7 promotes arenas and game modes from labels into simulation-owned content.

```text
ArenaDefinition                     GameModeDefinition
├── dimensions                      ├── participant limits
├── spatial cell size               ├── victory strategy
├── spawn zones                     ├── boss/survivor team metadata
├── obstacles                       └── duration where applicable
├── environmental zones
├── capacity recommendation
├── allowed mode IDs
└── presentation theme
                \                  /
                 BattleDefinition
                        ↓
              LocalSimulationRunner
```

### Data-defined compatibility

The runner rejects a game mode that is not listed by the selected arena and rejects participant counts outside the mode range. The React setup screen also resolves incompatible choices for usability, but simulation validation remains authoritative.

### Spawn-zone contract

Participants may request a `spawnZoneId`. Otherwise the runner selects a team-matching zone, then a generic zone, and places members deterministically with grid spacing and seeded jitter. The system does not require coordinates to be authored for every battle.

### Obstacles

Obstacles are static arena geometry represented as circles or axis-aligned boxes. They have independent restitution, optional contact damage, and optional destructible state:

```text
collision impulse
       ↓
ObstacleImpactEvent
       ↓ when threshold is exceeded
obstacle HP reduction
       ↓
ObstacleDamagedEvent / ObstacleDestroyedEvent
```

Only obstacle state lives in simulation. Debris, flashes, sound and camera response remain presentation concerns.

### Environmental zones

Each entity snapshot exposes the IDs of zones currently affecting it. The current reusable zone vocabulary is:

- ice: weaker steering, lower energy loss and slightly higher maximum speed
- water: slower motion and Wet application
- lava: periodic fire damage and Burn
- electric: periodic damage/force with Wet amplification
- wind: continuous directional force

Environmental processing is based on zone kind and status interactions—not fighter names.

### Victory strategies

The same simulation supports:

- `LAST_TEAM_STANDING`
- `DEFEAT_BOSS`
- `SURVIVE_TICKS`

The snapshot exposes an objective label, normalized progress, and remaining ticks where relevant. This allows UI, replay and spectators to explain the current goal without duplicating rules.

### Arena-aware presentation and control

Pixi draws themes, zones, obstacle state and debug spawn regions from snapshots/content. Audio and meta systems consume semantic arena events. AI receives obstacle snapshots and applies lightweight avoidance while continuing to emit the same movement/ability commands.

## Phase 0.7 — Scale boundaries

Large battles continue to use the same simulation runner. Scale-specific policy is supplied through `BattleRules`, AI profiles, and presentation LOD:

```text
BattleRules
  friendlyFire
  teamCollision
  teamCollisionScale
  maxBattleTicks
  # collisionDamageCooldownTicks is deprecated compatibility metadata
```

The world snapshot exposes simulation metrics, while renderer and audio diagnostics remain presentation-only. This preserves deterministic gameplay while allowing lower visual and audio density on weaker devices.

The current spatial hash, numeric entity IDs, command protocol, and snapshot/event boundaries leave room for later TypedArray hot stores and a Web Worker runner without changing fighter content or Pixi views.

## Phase 0.8 — Persistent meta-game boundary

Phase 0.8 activates the previously reserved Meta layer:

```text
LocalSimulationRunner
  ├── semantic SimulationEvent[] every tick
  └── BattleCompletionSummary once at completion
                      ↓
               @kinetic/meta
  ├── BattleStatsTracker
  ├── AchievementEngine
  ├── profile progression reducers
  ├── challenges
  ├── match history
  ├── loadouts
  └── versioned save migration
                      ↓
             React profile UI / localStorage
```

### One-way dependency

The app/runtime may send events and summaries to Meta. Simulation never imports Meta. Therefore deleting the entire profile/progression package would not change a battle checksum.

### Persistent versus per-battle state

Per-battle statistics reset on every restart. Achievement IDs, unlocks, profile XP, history, and challenges remain in `PlayerProfile`. `AchievementEngine` can be initialized or synchronized with those persistent IDs while its rules still inspect only current battle state.

### Save migration

Imported/local data is migrated into schema version 2 with defaults, uniqueness normalization, numeric clamping, and sanitization of match/loadout records. This is an application integrity boundary, not anti-cheat security.

### Difficulty

Difficulty is part of battle setup and loadouts, but it is translated into participant stat scales before simulation begins. No physics branch asks which difficulty is active. This also keeps replays self-contained because the resulting battle definition records the final participant scales.

### Seed behavior

Determinism remains an engine feature. Random rematch generation is application UX. The main button generates a new seed; explicit replay/debug controls preserve one.

## Phase 0.9 — Platform and presentation-quality boundary

Phase 0.9 adds a fifth application-facing boundary without altering the four core game layers:

```text
Device / OS / player preferences
              ↓
       @kinetic/platform
              ↓
      PresentationSettings
      ↙        ↓          ↘
 browser UI  Pixi renderer  audio/runtime cadence
```

`@kinetic/platform` has no dependency on simulation. A Battery Saver battle and a High Quality battle therefore consume the same snapshots/events and produce the same deterministic gameplay result.

### Adaptive presentation only

The runtime may reduce `qualityScale` after sustained frame-budget pressure. Renderer LOD, particle density and trail sampling respond to the scale. Simulation tick rate, commands, damage and RNG do not.

### Render cadence

A selected 30 FPS presentation target does not lower the 60 Hz simulation tick. Events generated between rendered frames are queued for the next render. This preserves visual feedback while reducing GPU/CPU presentation work.

### Mobile lifecycle

Background visibility pauses the local runner and clears held movement. On resume, runtime timing is reset. This prevents the fixed-step accumulator from attempting to simulate the entire time the app was suspended.

### Settings migration

Application settings use a separate versioned schema from the player progression profile. Partial legacy presentation objects are normalized into schema version 2 with bounded numeric values and device-informed defaults.

## 13. v1.0 player-facing release layer

v1.0 adds Home and Roster screens, but these are clients of the same content and battle-configuration APIs used by Battle Lab.

```text
Home / Roster / Battle Lab / Fighter Lab
                    ↓
             BattleSetup / content IDs
                    ↓
              BattleRuntime adapter
                    ↓
     controller commands + simulation snapshots
```

The release UI does not own fighter rules, ability execution, physics, progression checks or renderer state.

The eight built-in release fighters all use the same composition path:

```text
Fighter JSON
+ AI profile
+ five ability definitions
+ visual recipe
+ motion recipe
+ skill-presentation recipes
+ audio profile/cues
```

No new fighter requires a fighter-ID branch in the simulation.


## v1.1 Stage 2 — Result, damage-source, and action-selection boundaries

Stage 2 formalizes three rules:

1. `BattleResultSnapshot` is the authoritative terminal state. Once emitted, command processing and combat stepping stop.
2. Collision resolution is physical only. Health changes require explicit damage actions, hazards, statuses, or future weapon/projectile systems.
3. Controllers propose one action, while the simulation authoritatively validates range, target, line of sight, aim, cooldown, and target density.

Collision-triggered abilities are represented as finite armed states rather than passive fighter stats. AI candidate evaluation lives in `packages/controllers/src/actionSelection.ts`; authoritative validation remains in `packages/simulation/src/runner.ts`.

## v1.1 Stage 3 — Weapon, attack, and projectile boundary

Stage 3 introduces `WeaponDefinition` as reusable content and keeps the authoritative lifecycle in the deterministic simulation:

```text
Ability/Controller command
        ↓
activation validation
        ↓
ActiveWeaponAttackState
wind-up → active → recovery
        ↓
melee query or RuntimeProjectile
        ↓
semantic weapon/projectile events
        ↓
Pixi FX + animation + procedural audio
```

`EntitySnapshot.weaponAttack` exposes presentation state without allowing Pixi to mutate combat. `WorldSnapshot.projectiles` exposes interpolatable projectile transforms. Weapon/projectile state participates in checksums. Standard attacks are selected through ability `USE_WEAPON` actions and weapon data, never fighter-ID branches.

The responsive arena fix also preserves the boundary: `ResizeObserver` changes only renderer dimensions/camera fit. It does not resize or mutate the simulation arena.
