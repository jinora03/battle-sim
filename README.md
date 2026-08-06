# Kinetic Battle Engine — v1.3.27 Stage 8.8G

A browser/mobile-ready 2D physics battle game and modular fighter engine built with TypeScript, PixiJS, React, Vite and Capacitor.


> **Stage 8.8G completes the final UI-polish pass.** Fighter previews now use one body-only visual language across Battle Setup, match intro, Roster, and Creator; mobile floating action docks are removed; Ability Lab movement is integrated beside its scrollable skill tray; touch steering sensitivity is persisted; and release-facing developer metrics are removed.

## Stage 8.8G highlights

- shared body-only fighter portrait across preview surfaces
- clearer battle objective and team-status spacing
- new-battle action moved ahead of Team 1 configuration
- compact passive-and-skill setup previews with smaller module helper typography
- integrated Ability Lab direction pad and properly padded horizontal skill tray
- no duplicate floating Fight or Lab action docks on mobile
- touch steering sensitivity with settings migration to schema v11
- body-only Creator preview and stable mobile Roster cards
- release developer metrics card removed without changing simulation behavior


> **Stage 8.6D closes the intent-audio milestone with stabilization and mix control.** Delayed layers now consume the voice budget only while they are actually audible, long channels stop cleanly on resolution, death, restart and Ability Lab resets, focused-player events receive priority, and crowded battles automatically reduce ambient gain and contact-cue frequency without weakening ultimates.

## Stage 8.6D highlights

- time-window voice reservations prevent delayed ultimate layers from starving current combat sounds
- dedicated critical reserve keeps focused and ultimate cues audible when the normal voice budget is full
- seeded simulation remains untouched; all scheduling and mix decisions stay presentation-only
- Solar Eye Beams activation sustain is cancelled on real resolution or interruption before shutdown playback
- contact-channel watchdog prevents stale hit audio when a resolution event is interrupted or missing
- battle-size mix tiers reduce ambient gain, selected events and contact frequency for skirmish and mass-battle loads
- focused-player events receive a priority bonus over equivalent background events
- Battle and Ability Lab restart/destroy paths explicitly clear scheduled audio
- no damage, cooldown, AI, physics, projectile, replay or checksum changes

See `docs/V1_3_STAGE_8_6D_AUDIO_STABILIZATION.md` for implementation and validation details.


> **Stage 8.6C-3 completes the initial roster-audio rollout with Bomber and Mech Bruiser.** Bomber gains a reusable explosive palette with fuse, ignition, blast-pressure, and release layers, while Mech gains coherent servo, magnetic, armor-lock, and reactor lifecycles. Impact Bomb and Hydraulic Gauntlet also receive stronger basic-attack identities.

## Stage 8.6C-3 highlights

- reusable explosive palette for demolition, grenade, mine, and bomb-style abilities
- complete profiles for Blast Dash, Concussion Bomb, Shrapnel Burst, and Mega Bomb
- Mega Bomb arming tension, ultimate detonation, residual pressure, and knockback release
- complete profiles for Kinetic Pulse, Magnet Drag, Fortify, and Reactor Overdrive
- Reactor Overdrive startup, transformation, sustained machinery, and controlled spin-down
- distinct Impact Bomb launcher/fuse/impact cues and Hydraulic Gauntlet servo/piston cues
- migrated Bomber and Mech abilities removed from legacy hardcoded playback branches
- no damage, cooldown, AI, projectile, physics, seeded-opening, or deterministic simulation changes

See `docs/V1_3_STAGE_8_6C3_BOMBER_MECH_AUDIO.md` for implementation and validation details.


> **Stage 8.6C-2 rolls the intent-audio standard out to Gunner and Solar Sentinel.** Kill Zone now follows a mechanical spool-to-spin-down lifecycle, Solar Eye Beams separates eye charge, ignition, sustain, real contact, and shutdown, and all eight fighter abilities are profile-driven rather than hardcoded in the audio engine.

## Stage 8.6C-2 highlights

- complete mechanical intent profiles for Tactical Slide, Suppressive Burst, Pinning Round and Kill Zone
- Kill Zone motor spool, rotary start, firing sustain and post-barrage spin-down
- complete solar intent profiles for Sky Rush, Thunder Clap, Solar Aegis and Solar Eye Beams
- Solar Eye Beams ignition begins after its real 0.8-second warmup and shutdown follows actual ability resolution
- rate-limited beam-contact cues occur only when the active channel emits real damage events
- distinct Solar Punch launch and impact audio while retaining the basic < skill < payoff < ultimate hierarchy
- reusable activated/resolved layer anchors, channel-contact metadata and generic mechanical/beam rendering
- no damage, cooldown, targeting, AI, projectile, seeded-opening or deterministic simulation changes

See `docs/V1_3_STAGE_8_6C2_GUNNER_SENTINEL_AUDIO.md` for implementation and validation details.

> **Stage 8.6C-2A adds seeded opening readiness and controlled AI variation.** Basics remain immediate, movement and normal skills enter in short seeded windows, payoff skills wait longer, and ultimates cannot open a battle before five seconds. Small utility variation is stable until an ability is committed, preserving deterministic replays without identical openings across every seed.

## Stage 8.6C-2A highlights

- universal AI-only opening cadence: movement 0.3–1.0s, normal skills 0.5–2.0s, payoff skills 1.5–3.5s, ultimates 5.0–8.0s
- exact first-use ticks derived from seed, entity, slot, intent and ability id
- no simulation RNG consumption, spawn drift or `Math.random()`
- bounded ±3.25 utility jitter that can vary close decisions but cannot overturn large score gaps
- variation epoch advances only when an ability is committed, never every tick
- Solar Sentinel still uses Solar Eye Beams, but no longer at the opening bell
- player-controlled fighters and actual ability cooldown values remain unchanged

See `docs/V1_3_STAGE_8_6C2A_SEEDED_OPENING_READINESS.md` for implementation and determinism details.

> **Stage 8.6C-1 rolls the intent-audio standard out to Pyro and Ballast and corrects Solar Sentinel's AI ultimate usage.** Pyro now has a furnace-to-detonation hierarchy, Ballast has distinct mass-shift and compression cues, and Solar Sentinel no longer inherits Pyro's Heat-gated AI rules.

## Stage 8.6C-1 highlights

- complete intent-profile migration for Pyro's Cinder Rush, Fire Vortex, Combustion and Meltdown
- complete intent-profile migration for Ballast's Featherfall, Downbeat, Dead Weight and Last Call
- Pyro uses the fire palette while Ballast uses the low gravity palette; neither copies Thunder Dome's electric identity
- Combustion and Downbeat are explicit payoff abilities between ordinary skills and ultimates
- legacy Pyro/Ballast ability-ID playback branches removed after migration
- Solar Sentinel now has a dedicated AI profile instead of reusing `aggressive-brawler`
- removed the impossible `heat` resource prerequisite that prevented Solar Eye Beams from being selected
- Solar Eye Beams can now be selected from its real 90–1080 range and begins its existing stationary tracking channel normally
- no Pyro or Ballast damage, cooldown, status, physics, AI or replay behavior changed

See `docs/V1_3_STAGE_8_6C1_PYRO_BALLAST_AUDIO_SENTINEL_FIX.md` for implementation and validation notes.

> **Stage 8.6B validates intent-based combat audio on Volt Striker.** Arc Emitter now has separate charge, launch and impact reads; Lightning Dash, Arc Burst and Polarity Pull use distinct lifecycle profiles; Thunder Dome remains the ultimate-quality benchmark. The audit found no immediate need for AI, balance or kit changes.

## Stage 8.6B highlights

- complete intent-profile migration for Lightning Dash, Arc Burst, Polarity Pull and Thunder Dome
- Arc Emitter capacitor commitment, electrical launch crack and distinct impact discharge
- Lightning Dash departure, travel-current and delayed overcharge release layers
- Arc Burst explosion body plus shocked-state release
- Polarity Pull promoted to the payoff tier with cast-length attraction, compression sustain and pressure release
- reusable intent renderer improvements for projectiles, pulls, status application and knockback release
- no changes to Volt damage, cooldowns, ranges, statuses, AI, physics, determinism or replay output
- explicit audit finding that `shocked` is a slow, not true chain-lightning propagation

See `docs/V1_3_STAGE_8_6B_VOLT_IDENTITY_AUDIO.md` for the full identity audit and implementation notes.

> **Stage 8.6A establishes intent-based combat audio.** Abilities can now be described through anticipation, activation, sustained-action and release layers, selected from reusable combat intents and sound palettes. Thunder Dome is the first complete reference profile; unconverted abilities retain their existing playback until the Volt and roster rollout phases.

## Stage 8.6A highlights

- reusable `anticipation -> activation -> sustain -> release` audio lifecycle
- explicit intents for projectiles, burst fire, beams, explosions, pulls, knockback, transformations, channels, status application and ultimates
- separate sound palettes so fire, gravity, mechanical and electric abilities can share structure without sharing the same sound
- enforced loudness hierarchy: Basic < Skill < Payoff < Ultimate
- Thunder Dome migrated out of the ability-ID sound chain into a complete four-layer profile
- scheduled sustain/release layers use Web Audio timing only and do not add simulation timers or alter replay checksums
- legacy ability sounds remain unchanged until Stage 8.6B/8.6C migration

See `docs/V1_3_STAGE_8_6A_INTENT_BASED_COMBAT_AUDIO.md` for implementation and validation notes.

> **Stage 8.5C corrects Gunner's live-play firing behavior.** Kill Zone now launches a straight per-round tracked gatling stream instead of a precomputed fan with curved homing arcs. Suppressive Burst is now a six-round tracked firing lane with a stronger, longer suppression effect.

## Stage 8.5C highlights

- delayed projectile actions can optionally re-aim when each round launches
- Kill Zone retains 24 rounds but removes fan spread and curved homing
- Suppressive Burst changes from a wide six-round fan to a reliable concentrated six-round stream
- Suppressed movement multiplier strengthens from 0.82x to 0.70x and lasts longer
- existing delayed abilities keep snapshot aiming unless they opt in

See `docs/V1_3_STAGE_8_5C_GUNNER_FUNCTIONALITY_CORRECTION.md` for implementation and validation notes.

> **Stage 8.5A begins Gunner's identity pass without replacing his existing Target Lock kit.** The four-round rifle now reads as a committed firing sequence: Gunner holds a disciplined kite lane, tracks the selected target between rounds, uses crisp ballistic VFX/audio across skill projectiles and no longer freezes the presentation on every rapid-fire hit.

## Stage 8.5A highlights

- dedicated Gunner spacing tune with a 440-unit kite lane and stronger lateral firing behavior
- burst-commitment steering that reduces forward pressure while the rifle is winding up or active
- deterministic target refresh between rounds while already-launched bullets keep their original trajectories
- zero repeated hit-stop for Automatic Rifle, Tactical Round and Suppressive Round
- registered ballistic VFX/audio identity for all rifle projectiles, with Pinning Round retaining its heavier payoff
- enlarged outlined rifle silhouette with a visible stock, receiver, scope, magazine and muzzle brake
- no ability replacement, resource meter or projectile-system rewrite

See `docs/V1_3_STAGE_8_5A_GUNNER_READABILITY.md` for implementation and validation notes.

## Stage 8.4C Ballast presentation polish

- complete Ballast fighter with `House Rules`, `Skip Stone`, `Featherfall`, `Downbeat`, `Dead Weight` and `Last Call`
- dedicated mass-aware AI that primes Featherlight before choosing its launch payoff
- finite native ricochets used by the basic attack, including module-added bounce budget
- six developer-approved Ballast modules using existing generic loadout modifiers
- dedicated mass-bloom, directional punt, anchor-drop and arena-inversion resolve effects
- distinct synthesized audio cues for Skip Stone and every Ballast ability
- deterministic gameplay remains identical to Stage 8.4B

See `docs/V1_3_STAGE_8_4C_BALLAST_PRESENTATION_POLISH.md` for the presentation pass and `docs/V1_3_STAGE_8_4B_FULL_BALLAST.md` for the fighter implementation.

## Stage 8.4A.1 Pyro readability pass

- dedicated `pyro-combo-bruiser` orbit profile
- readable stream-primary firing commitment and stronger close-range separation
- optional `furnace-nozzle` offense module with deterministic pulsed cone damage

See `docs/V1_3_STAGE_8_4A1_PYRO_READABILITY_AND_FURNACE_NOZZLE.md` for implementation and validation notes.

## Stage 8.4A mass-manipulation foundation

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
