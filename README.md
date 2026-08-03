# Kinetic Battle Engine — v1.3.1 Stage 8.4A

A browser/mobile-ready 2D physics battle game and modular fighter engine built with TypeScript, PixiJS, React, Vite and Capacitor.

> **Stage 8.4A establishes deterministic mass-manipulation primitives for Ballast and future physics-driven fighters.** Stack-scaled mass statuses now feed the existing collision and knockback model, native projectiles can use a finite ricochet budget, and light/heavy status presentation is data-driven.

## Stage 8.4A highlights

- generic per-stack mass multipliers without changing existing status behavior
- registered `featherlight` and `anchored` status definitions
- knockback and fighter collisions continue to use effective mass automatically
- optional finite native projectile wall/obstacle bounce counts
- generic light/heavy status indicators driven by content metadata
- regression coverage for mass scaling, knockback distance and ricochet limits
- no Ballast fighter content yet; this phase is the reusable foundation

See `docs/V1_3_STAGE_8_4A_MASS_MANIPULATION_FOUNDATION.md` for implementation and validation notes.

## Previous Stage 7.5 performance foundation

> **Stage 7.5 is the consolidated final performance architecture pass.** It preserves deterministic simulation and replay behavior while reducing mass-battle AI area-query work, main-thread allocations and redundant obstacle redraws. It also hardens Fight-tab renderer startup, adds live team-health/elimination progress, left-aligns the matchup identity, and enables a distinct rate-limited AI hitmarker cue.

## Stage 7.5 highlights

- exact team-grouped hostile queries for area-target scoring and clustered AI analysis
- reusable AI command/event collections and lower main-thread allocation pressure
- cached obstacle rendering and reusable renderer lookup maps
- idempotent runtime/renderer startup with visible-layout gating and retry recovery
- stable initial team HP baselines for meaningful elimination progress
- separate player and AI hit-confirmation audio paths, including AI-vs-AI
- preserved replay checksums and deterministic command selection

See `docs/V1_1_STAGE_7_5_FINAL_PERFORMANCE.md` for the implementation and validation notes.

## Earlier performance phases

Stages 7.4 phases 1–6 added size-aware diagnostics, replay run-length encoding, AI cadence scaling, presentation budgets, adaptive rendering and mass-battle VFX/audio limits. Those changes remain included in Stage 7.5.

## Complete neon UI overhaul

This build also includes the combined UI Phases 1–5 pass:

- full dark neon ambient background and restrained glass surfaces
- reusable semantic UI primitives in `apps/game/src/ui/NeonUI.tsx`
- function-based button colors for start, random, pause, danger, utility and ultimate actions
- arena-first Battle Lab desktop layout with sticky setup and diagnostic side columns
- mobile setup drawers, backdrop scrims, Escape handling and body-scroll protection
- mobile bottom navigation plus fixed Battle and Ability Lab quick-action docks
- unified Battle/Ability Lab cards, ability slots, objective bars, profile, roster and Fighter Lab surfaces
- responsive tablet, portrait, short-landscape and touch-target tuning
- keyboard focus treatment, high-contrast support and reduced-motion behavior
- polished view, details, card and ultimate-state motion without changing simulation timing


## The central architecture rule

```text
Controllers                         Presentation
AI / Player / Replay / Network      Pixi / FX / Camera / Audio / UI
              \                     /
               Commands + Events
                      ↓
          Deterministic Simulation
   physics · combat · abilities · modes · arenas
                      ↓
        Snapshots + semantic events
                      ↓
                 Meta game
 achievements · progression · history · unlocks
```

The simulation can run headlessly without React, PixiJS, browser audio or Capacitor.

## v1.0 release roster

Every built-in fighter has one authoritative **Primary Attack** shown as Basic, plus Skill 1, Skill 2, Skill 3 and Ultimate. The rendered weapon or elemental source, Basic mechanics, range and AI intent all derive from the same primary-attack definition.

- **Water Shaper** — orbiting controller; Wet, waves, pull and radial knockback
- **Bomber** — aggressive demolition charger; armed impacts, shrapnel and Mega Bomb
- **Pyro Brawler** — momentum bruiser; burn, dash, flame ring and Inferno Collapse
- **Mech Bruiser** — heavy tank; magnetic pull, fortification, pulse and overdrive
- **Frost Warden** — armored sentinel; freeze, area denial and Absolute Zero
- **Volt Striker** — fast assassin; electric burst movement and Thunder Dome
- **Thorn Colossus** — massive guardian; regeneration, rooting and Overgrowth
- **Void Reaper** — mobile gravity skirmisher; pulls, phase attacks and Singularity
- **Gunner** — conventional automatic-rifle specialist; controlled bursts, suppression, grenade support and overdrive

## Arenas

- **Iron Pit** — clean compact ricochet arena
- **Pillar Court** — obstacles and destructible center crate
- **Elemental Foundry** — ice, water, lava, electricity and wind hazards
- **War Basin** — large team/mass-skirmish field
- **Cryo Ring** — ice center, wind lanes and rebound pillars
- **Arc Crucible** — electric grids, coolant core and destructible reactors

## Game modes

- Duel
- Team Battle
- Battle Royale
- Boss Raid
- Survival Trial
- Mass Skirmish

## Player-facing features

- Home screen with featured matchups and progression summary
- Roster screen with fighter comparison, lock states and quick-play actions
- Player vs AI, AI vs AI and mixed controller support
- Keyboard/mouse and touch controls
- Five readable skill indicators with telegraphs, cast phases and cooldowns
- New random battle, replay same seed and manual advanced seed
- Persistent profile, XP, levels, achievements, challenges and fighter unlocks
- Match history and reusable battle loadouts
- Fighter Lab for validated custom fighter JSON bundles
- Standard, Minimal and Debug render profiles
- Auto/Battery/Balanced/High quality presets
- Reduced motion, high contrast, visual toggles and audio controls
- Responsive browser shell, PWA metadata and Capacitor mobile commands

## Requirements

- **Node.js 22.12 or newer**
- npm 10 or newer

Check your environment:

```bash
node -v
npm -v
```

## Run locally

```bash
npm install
npm run check
npm run dev
```

`npm run check` runs:

1. strict TypeScript type checking
2. the Vitest regression suite
3. the production Vite build

Run `npm run lint` separately for the repository architecture/style lint.

## Controls

```text
WASD / Arrow keys   Move
Mouse / pointer     Aim
Space or 1          Basic
Q or 2              Skill 1
E or 3              Skill 2
R or 4              Skill 3
F or 5              Ultimate
```

The same abilities are also available through touch-friendly buttons.

## Mobile shell

Create a native platform once:

```bash
npm run cap:add:android --workspace @kinetic/game
# iOS requires macOS
npm run cap:add:ios --workspace @kinetic/game
```

Build and sync future web changes:

```bash
npm run mobile:sync
```

Open the native project:

```bash
npm run cap:open:android --workspace @kinetic/game
npm run cap:open:ios --workspace @kinetic/game
```

Android Studio/Xcode, platform SDK installation, signing, store metadata and physical-device QA remain local release tasks.

## Project layout

```text
apps/game/                 React application and browser runtime
packages/protocol/         commands, events, snapshots and battle definitions
packages/content/          fighter, ability, AI, arena, mode and status data
packages/simulation/       deterministic gameplay truth
packages/controllers/      AI, player, replay and network command sources
packages/visual-engine/    character, motion and skill-presentation recipes
packages/renderer-pixi/    Pixi battlefield, FX, LOD, camera and debug rendering
packages/audio/            prioritized procedural Web Audio
packages/creator/          Fighter Lab validation and runtime registration
packages/meta/             profiles, achievements, progression and history
packages/platform/         device quality, accessibility and settings migration
packages/replay/           deterministic replay recording/export support
tests/                     architecture and regression tests
validation/                executable headless validation scenarios
```

## v1.1 Stage 7.2 highlights

- Replaces Display Weapon + Gameplay Weapon + Basic Ability with one authoritative `primaryAttackId`
- Separates attack **form** from attack **behavior** and validates allowed combinations through one shared matrix
- Adds a dedicated `activatePrimaryAttack` command; skills cannot execute the Basic attack definition
- Generates the Basic slot from the primary attack instead of storing `abilitySlots.basic`
- Renders the real primary attack directly, with oversized readable silhouettes and no separate decorative weapon
- Keeps normal melee stable while idle; only explicit Spin/Orbit behavior rotates
- Broadens melee reach using attacker radius + attack reach + target radius
- Derives AI approach/kite distance from the primary attack's real range and behavior
- Redesigns Fighter Lab around Primary Attack Source, Form, Behavior and compatible definitions
- Migrates schema-v1 custom fighters to schema v2 and removes legacy display-weapon data
- Gives each built-in fighter a coherent identity, including Flame Fists for Pyro and Automatic Rifle for Gunner

## v1.1 Stage 7 highlights

- Caches one immutable simulation snapshot until authoritative state changes
- Reuses the latest snapshot across AI, controls, audio, progression, rendering and diagnostics
- Reuses spatial-hash buckets and queries projectiles/explosions through bounded deterministic AABBs
- Reports occupied broadphase cells, maximum bucket size and projectile query counts
- Pools inactive fighter views across battle restarts instead of recreating every Pixi object
- Preserves body colors, core accents and weapon silhouettes at Army LOD
- Profiles average and p95 simulation, render and frame time
- Classifies Healthy, Strained and Critical pressure and identifies the dominant bottleneck
- Records dropped simulation ticks and sustained long-frame streaks
- Adds numeric-state recovery metrics for malformed/non-finite entity state
- Keeps adaptive quality presentation-only: fighters, AI, physics, damage and winners are unchanged
- Fixes Battle → Ability Lab → Battle by reattaching, showing, resizing and refitting the retained Pixi canvas

## Stage 8.1 mounted loadouts

- Developer-approved offense, defense, mobility and utility modules
- Optional data-driven physical attachments on any module
- Front, rear, side, top and orbit mount recipes with body, target, counter-rotation and orbit modes
- Generic missile pod, deflector plate, thruster and targeting-drone rendering
- Spawn-time movement modifiers plus centralized incoming-damage, incoming-knockback and skill-projectile modifiers
- Loadout-aware FighterView pooling and Army-LOD attachment suppression
- No player-authored fighter/module creation in the main game

## Stage 6 functionality retained

- Layered arena, fighter, weapon, projectile and screen-relative VFX
- Weapon-specific slashes, thrusts, trails, explosions and ground marks
- Pooled residual particles and status feedback
- VFX tiers that remain separate from authoritative gameplay radius and results

## Stage 8 functionality retained

- Explicit CSS/internal canvas sizing and DPR caps
- Adaptive render scale and mobile quality presets
- Resize scheduling, orientation handling and safe-area layouts
- WebGL context interruption handling
- Runtime suspension while hidden or on another app view
- Live resolution, canvas, viewport and React-render diagnostics

## Stage 5 functionality retained

The Ability Lab remains available and still reuses the real simulation, weapons, projectiles, cooldowns, statuses, damage rules and renderer. It supports stationary, moving and grouped targets, pause/resume, slow motion, one-tick stepping, damage/cooldown toggles, hitboxes, range overlays, projectile paths and damage/status inspection.


## Honest v1.0 boundaries

This release is a **complete core-game evaluation build**, not a finished commercial launch. It intentionally does not include:

- real-time online multiplayer
- server accounts/cloud saves
- public fighter marketplace or arbitrary code mods
- a campaign/story mode
- final professional art, music and sound library
- store signing/submission
- guaranteed 100-fighter performance on every phone
- exact bit-identical cross-engine fixed-point replay parity

Those can be added without replacing the simulation/render/control/meta boundaries, but some—especially real-time multiplayer—remain substantial projects.

See `docs/V1_1_STAGE_7_2.md`, `docs/V1_1_STAGE_7_2_VALIDATION.md`, `docs/V1_1_STAGE_7.md`, `docs/V1_1_STAGE_7_VALIDATION.md`, `docs/V1_1_STAGE_6.md`, `docs/V1_1_STAGE_6_VALIDATION.md`, `docs/V1_1_STAGE_8.md`, `docs/V1_1_STAGE_8_VALIDATION.md`, `docs/STAGE_8_DEVICE_QA.md`, `docs/V1_1_STAGE_5.md`, `docs/V1_1_STAGE_4.md`, `docs/V1_1_STAGE_3.md`, `docs/V1_1_STAGE_2.md`, `docs/V1_1_STAGE_1.md`, `docs/PHASE_1_0.md`, `docs/ARCHITECTURE.md`, `docs/EVALUATION_GUIDE.md` and `docs/RELEASE_CHECKLIST.md`.

## Stage 7.4 performance phase 1

This pass keeps gameplay and determinism unchanged while removing avoidable browser-runtime overhead:

- replay frame counts are now O(1) and no longer export/deep-clone the complete replay during diagnostics
- diagnostics publish at 10 Hz for small battles, 5 Hz for medium battles, 2 Hz through 50v50, and 1 Hz above 100 units
- checksums are cached and refreshed once per simulation second or at battle end
- detailed AI decision data is generated only while the developer metrics panel is open
- the metrics panel now separates AI, simulation core, replay recording, post-simulation work and diagnostics preparation

These changes are intentionally isolated from AI behavior, physics, damage and render presentation so a real 50v50 profile can guide the next optimization pass.

## Stage 7.4 Performance Phase 5

Mass battles now use bounded presentation budgets and a 30 FPS render tier for 80+ fighters while the deterministic simulation remains at 60 Hz. PixiJS initialization is also deferred until the Fight workspace is visible, preventing the blank arena that could occur when opening Fight immediately after page load.

## Stage 7.4 performance phase 6

Main-thread stabilization adds no-op viewport/resize guards, batched meta evaluation, a 48+ fighter mass tier, stricter VFX budgets, centered replay export, and restored AI hitmarker audio.
