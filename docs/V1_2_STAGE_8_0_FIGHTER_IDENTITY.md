# v1.2 Stage 8.0 — Fighter Identity, Combos, Modules and Attachments

## Goal

Stage 8.0 changes fighters from collections of unrelated attacks into developer-authored combat kits.

The release model is now:

- developers author and approve fighters;
- a fighter may have zero or more passive abilities;
- active skills can set up and consume stack-based combat states;
- AI reads the same generic state used by players and simulation;
- players may choose only modules explicitly approved for that fighter;
- modules adjust the authored kit instead of replacing the fighter's identity;
- the existing Fighter Workshop remains an internal developer authoring tool and is removed from the public navigation.

Gunner is the first vertical slice. Other fighters continue to use their existing kits until they receive the same identity treatment.

## Architecture rules

### 1. Passives are optional data

`FighterDefinition.passiveIds` is optional. Fighters without a passive continue to work unchanged.

Passive definitions contain generic trigger events, conditions and actions. The simulation does not switch on `fighterId` to run Gunner logic.

Supported first-stage passive events:

- `ON_BATTLE_START`
- `ON_PRIMARY_HIT`
- `ON_ABILITY_RESOLVED`

### 2. Combo resources use stack-aware statuses

Marks, Chill, Heat, Rage, Charges and similar future mechanics should use status definitions with:

- `maxStacks`
- `refreshMode`
- deterministic stack addition/removal
- stack counts in snapshots, replay-visible state and checksums

This avoids adding a new simulation array or one-off state machine for each fighter mechanic.

### 3. Active skills remain data-driven

Abilities use reusable conditions and actions such as:

- `TARGET_HAS_STATUS`
- `APPLY_STATUS_TARGET`
- `REMOVE_STATUS_TARGET`
- directional self impulse
- projectile status interactions

A projectile may read target stacks to calculate bonus damage, knockback, homing, threshold effects and stack consumption.

### 4. Modules are controlled loadouts

Every module has:

- one slot;
- an explicit compatible-fighter list;
- a fighter-side allowlist;
- deterministic modifiers;
- no direct access to the simulation runner.

The loadout resolver rejects incompatible modules and multiple modules in one slot. The simulation stores the resolved immutable result per fighter spawn.

### 5. Determinism remains authoritative

Module IDs and status stack counts are included in snapshots and checksums. Saved battle presets carry Team 1 and Team 2 module selections. Simulation ordering uses locale-independent ordinal comparison.

### 6. Presentation consumes semantic state

The renderer reads only snapshot state:

- Target Lock renders a one-to-four segment reticle;
- the Targeting Drone renders as an orbiting attachment;
- army LOD omits the drone to preserve large-battle readability and cost.

## Gunner identity

### Passive — Combat Analysis

Primary rifle hits apply one Target Lock stack to the hit enemy, up to four. Target Lock lasts long enough to support a setup-and-payoff sequence but still expires if Gunner changes targets or loses pressure.

### Skill 1 — Tactical Slide

Gunner slides away from the selected target, briefly phases, and fires two tactical rounds. It is a defensive repositioning tool that can continue building Target Lock.

### Skill 2 — Suppressive Burst

Gunner fires a six-round fan. Hits build Target Lock and apply a short movement suppression effect.

### Skill 3 — Pinning Round

Requires at least two Target Lock stacks. Its projectile gains damage and knockback per stack, consumes all Target Lock, and applies `pinned` when fired against at least three stacks.

### Ultimate — Kill Zone

Requires at least three Target Lock stacks. Gunner enters overdrive and releases a timed ten-missile barrage. Missiles gain damage, knockback and tracking from the target's current stacks.

### Combo-aware AI

The existing generic AI action selector now supports optional status-stack gates and score bonuses. Gunner's profile uses those fields to:

- use Suppressive Burst early in the setup;
- reserve Pinning Round for two or more Target Lock stacks;
- reserve Kill Zone for three or more stacks;
- score payoff skills more highly as stacks increase.

No Gunner-specific branch was added to controller code.

## First approved Gunner modules

### Ricochet Chamber — offense

- primary bullets bounce once from arena walls or obstacles;
- primary damage is reduced by 10%;
- bounce velocity retention is 82%.

### Piercing Barrel — offense

- primary bullets continue through one enemy;
- a projectile cannot hit the same target twice;
- primary cooldown is 12% longer.

### Targeting Drone — utility attachment

- Target Lock duration is increased by 35%;
- skill-projectile homing is increased by 20%;
- a visible orbiting drone is rendered outside army LOD.

## Player-facing policy

The public `Create` navigation item and Roster creation call-to-action are removed. Players choose developer-authored fighters and approved modules in Battle Setup.

The underlying creator package is retained because it is useful as an internal content-authoring and diagnostic tool. It can be opened only from the Developer Information panel and is clearly labeled **Developer Fighter Workshop**.

## Adding the next fighter identity

Use this order:

1. Define the fighter's combat loop in one sentence.
2. Add any stack/resource statuses under `packages/content/src/data/statuses/`.
3. Add an optional passive in `packages/content/src/passives.ts`.
4. Author active abilities under `packages/content/src/data/abilities/` using generic conditions/actions.
5. Register any reusable skill projectiles in `packages/content/src/index.ts`.
6. Configure the fighter's `passiveIds`, ability slots and approved module IDs.
7. Add combo gates and scoring to the fighter's AI profile.
8. Add semantic presentation recipes and status/attachment rendering.
9. Add interaction, determinism, invalid-loadout, AI-combo and large-battle tests.

Only add custom simulation code when a mechanic cannot be represented safely by the generic action/effect vocabulary.

## Main implementation files

- `packages/protocol/src/index.ts`
- `packages/content/src/schemas.ts`
- `packages/content/src/passives.ts`
- `packages/content/src/loadouts.ts`
- `packages/content/src/data/fighters/gunner.json`
- `packages/content/src/data/ai/ranged-gunner.json`
- `packages/content/src/data/abilities/tactical-slide.json`
- `packages/content/src/data/abilities/suppressive-fire.json`
- `packages/content/src/data/abilities/pinning-round.json`
- `packages/content/src/data/abilities/kill-zone.json`
- `packages/content/src/data/statuses/target-lock.json`
- `packages/content/src/data/statuses/suppressed.json`
- `packages/content/src/data/statuses/pinned.json`
- `packages/simulation/src/combatModifiers.ts`
- `packages/simulation/src/order.ts`
- `packages/simulation/src/world.ts`
- `packages/simulation/src/runner.ts`
- `packages/controllers/src/actionSelection.ts`
- `packages/renderer-pixi/src/index.ts`
- `apps/game/src/runtime/BattleRuntime.ts`
- `apps/game/src/App.tsx`
- `apps/game/src/RosterView.tsx`
- `tests/stage8-gunner-combo-and-modules.test.ts`
