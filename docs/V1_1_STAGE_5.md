# v1.1 Stage 5 — Ability Lab

Stage 5 adds a focused training and debugging surface without creating a second combat engine. The Ability Lab constructs a normal deterministic `LocalSimulationRunner`, loads ordinary fighter and ability definitions, and uses the same weapon attacks, projectiles, hit resolution, statuses, semantic events, Pixi renderer and audio engine as Battle Lab.

## Player-facing workflow

The new **Ability Lab** navigation item opens a dedicated training view where the player can:

- choose a trainer fighter and a target fighter;
- choose stationary, moving, three-target or five-target dummy layouts;
- select and manually activate any of the fighter's five abilities;
- reset the current setup or regenerate it with a new seed;
- pause, resume, run at 0.25x/0.5x/1x speed, or advance exactly one simulation tick;
- enable or disable damage and cooldowns independently;
- make target teams invulnerable while still reporting attempted damage;
- inspect target HP and active statuses;
- inspect recent damage and combat events.

Keyboard movement and ability shortcuts are preserved, and touch movement/skill controls remain available on touch-first devices.

## Authoritative training rules

`BattleRules.training` is optional and is ignored by ordinary battles. It supports:

- `enabled`
- `damageEnabled`
- `cooldownsEnabled`
- `invulnerableTeams`
- `suppressVictory`

When damage is disabled or a target team is invulnerable, the simulation emits an ordinary damage event with the calculated amount, impact position and `prevented: true`, but does not reduce HP. Status actions still execute, which makes elemental and debuff testing useful.

When cooldowns are disabled, existing cooldown state is cleared and subsequent ability activation does not write a new cooldown. Cast, wind-up, active and recovery timing remain real.

When victory is suppressed, defeated targets can be removed without ending the training session. Resetting the arena restores them.

## Debug presentation

The Pixi renderer now accepts `TrainingDebugOptions` and can draw:

- selected ability minimum and maximum range;
- melee/continuous attack arcs;
- fighter and projectile hitboxes;
- actual sampled projectile paths;
- floating damage numbers;
- prevented-damage labels.

These overlays are presentation-only. They do not alter simulation state or checksums.

## Training content

Stage 5 adds:

- `training-grid` arena;
- `training` mode.

The regular Battle Lab filters both out so training-specific rules cannot be selected accidentally for normal matches.

## Files of interest

- `apps/game/src/TrainingLabView.tsx`
- `apps/game/src/runtime/TrainingRuntime.ts`
- `packages/protocol/src/index.ts`
- `packages/simulation/src/runner.ts`
- `packages/simulation/src/world.ts`
- `packages/renderer-pixi/src/index.ts`
- `packages/content/src/data/arenas/training-grid.json`
- `packages/content/src/data/modes/training.json`
- `tests/stage5-training-lab.test.ts`
