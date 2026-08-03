# Adding and Authoring Content

## Fighter Lab workflow

For normal fighter iteration, use the in-app **Fighter Lab**:

1. Start from Arc Prototype or duplicate a built-in/custom fighter.
2. Choose a Primary Attack Source, form and compatible behavior.
3. Select Skill 1, Skill 2, Skill 3 and Ultimate.
4. Edit physics, stats, classification, AI, visual recipe and motion recipe.
5. Resolve validation errors.
6. Click **Save to engine** or **Save & test fight**.
7. Export a `.fighter.json` bundle when the result should live outside browser storage.

Portable Fighter Lab bundles use `schemaVersion: 2`. Schema-v1 bundles are migrated by resolving the legacy weapon/Basic pairing to a primary attack, removing the independent Basic slot and discarding the old display weapon.

## Primary attack model

Every fighter has exactly one authoritative:

```ts
primaryAttackId: string
```

The selected `PrimaryAttackDefinition` determines:

- the visible physical weapon or elemental attack source;
- the generated Basic slot;
- attack form and behavior;
- range, damage and knockback;
- wind-up, active, recovery and cooldown timings;
- melee reach/arc or projectile/burst data;
- AI preferred combat distance;
- VFX and audio presentation.

Do not add a separate display weapon, gameplay weapon or `abilitySlots.basic`. Skills 1–3 and Ultimate remain independent abilities and must not use the primary attack as a hidden weapon execution path.

### Attack form and behavior

Forms describe **what** attacks:

- sword, spear, hammer, axe, claws;
- rifle, launcher, shield, gauntlet;
- fire, water, ice, lightning, nature, void.

Behaviors describe **how** it attacks:

- melee, spin, ranged, automatic, throwable;
- continuous, beam, orbit, slam.

Use the authoritative helpers in `packages/content/src/index.ts`:

```ts
isAttackCombinationAllowed(form, behavior)
getPrimaryAttack(id)
listPrimaryAttacks()
```

Fighter Lab and source validation share the same compatibility matrix. Add new combinations there rather than duplicating UI-only rules.

### Adding a primary attack

Register a `PrimaryAttackDefinition` in `packages/content/src/index.ts`. Required design decisions include:

- unique ID and readable name;
- form, behavior and style;
- minimum and maximum range;
- damage and knockback;
- wind-up, active, recovery and cooldown ticks;
- movement/friendly-fire rules;
- visual scale, effect ID and audio ID;
- melee arc/reach or projectile details where applicable.

For normal melee, do not use continuous idle rotation. Melee should remain stable until wind-up, swing/thrust/slam once, then recover. Use explicit `spin` or `orbit` behavior when rotation is the attack identity.

Projectile recipes support speed, radius, lifetime, fuse, bounce, visual throw arc, direct-hit behavior, burst count/interval/spread and optional explosion data. Set `maxWallBounces` when a native ricochet should expire after a fixed number of wall or obstacle reflections; omitting it preserves lifetime-limited unlimited bounce. The top-down path remains deterministic; throw height is visual only.

A fighter module may provide `primaryConeChannel` to convert the equipped primary from projectile spawning into a pulsed deterministic cone. Author active duration, pulse interval, status cadence, range/angle and per-pulse damage/knockback explicitly. This conversion should be used for sustained streams such as flamethrowers; do not simulate the effect by spawning a projectile every tick. The primary attack ID stays unchanged for replay/content compatibility.

### Authoring mass-changing statuses

Use `massMultiplier` for one fixed modifier and `massMultiplierPerStack` when every stack should compound the target's effective mass. Collision response and knockback already read effective mass, so do not add fighter-specific launch formulas. `massPresentation: "light" | "heavy"` opts the status into the generic renderer indicator. Keep stack counts small and test the resolved multiplier explicitly.

### Adding a new form/behavior combination

Update `ATTACK_FORM_BEHAVIORS` and add tests. A combination should be enabled only when its silhouette and combat intent are clear. Examples:

- Sword + Melee and Sword + Spin are supported.
- Spear + Melee, Spear + Spin and Spear + Throwable are supported.
- Rifle + Ranged/Automatic/Beam may be supported.
- Rifle + Spin is rejected by default.

## Skill identity

A coherent kit normally follows:

```text
Basic       repeated primary attack
Skill 1     approach/reposition tool
Skill 2     main damage or control tool
Skill 3     defense, setup or utility
Ultimate    largest expression of the same identity
```

Skills may visually reference the fighter's source—such as a spear throw or rifle barrage—but their mechanics belong to the skill itself. Do not call the primary-attack resolver from a normal skill.

## Source-controlled built-in fighter

To promote a custom fighter into built-in content:

1. Export its FighterBundle.
2. Copy `fighter` into `packages/content/src/data/fighters/<id>.json`.
3. Register the JSON import in `packages/content/src/index.ts`.
4. Ensure its `primaryAttackId` refers to a registered attack.
5. Add its visual and motion recipes to `packages/visual-engine/src/index.ts`.
6. Add tests and dedicated skill presentation/audio recipes where needed.

Built-in IDs are protected at runtime and cannot be overwritten by imported custom bundles.

## New ability

Prefer Trigger → Condition → Action when a mechanic can be expressed cleanly with reusable primitives. The Basic attack is not authored as a normal ability; it is synthesized from `primaryAttackId`.

Add a new simulation action only when it represents a generally reusable mechanic. Stage 7.2 adds two reusable skill actions:

- `DIRECTIONAL_DAMAGE` for a deterministic forward cone with optional knockback;
- `EXPLODE_AT_TARGET` for a target-centered radial hit and impulse.

These let weapon-themed skills remain related to the fighter without secretly invoking the Basic primary attack. A genuinely special mechanic should eventually use a typed plugin rather than creating dozens of one-off JSON conditions/actions. Fighter Lab currently assigns existing abilities; full visual TCA ability authoring remains deferred.

## New arena

Create JSON in `packages/content/src/data/arenas/` and register it in `packages/content/src/index.ts`.

Required design decisions include:

- actual dimensions and spatial-cell size;
- recommended unit range;
- allowed game-mode IDs;
- spawn zones;
- obstacle geometry/properties;
- environmental zones;
- presentation theme.

`small`, `medium`, and `large` are descriptive labels. Dimensions, capacity and compatibility metadata are authoritative.

### Spawn zones

A spawn zone is a rectangle. Give it a `team` to reserve it for that team or omit `team` for free-for-all placement. Battle participants may explicitly request a zone by ID, otherwise deterministic fallback selection is used.

### Obstacles

Current shapes:

- `circle`: position + radius
- `box`: center position + width/height

Use `destructible`, `maxHp`, `impactDamageScale` and `breakImpulseThreshold` together. Static pillars should normally have `destructible: false` and zero HP/damage scaling.

### Environmental zones

Current kinds:

- `ice`
- `water`
- `lava`
- `electric`
- `wind`

Zones may be rectangular or circular. `strength`, `damage`, `intervalTicks`, `statusId`, and `direction` are interpreted according to the kind. Keep new behavior generic; do not branch on fighter IDs.

## New game mode

Create JSON in `packages/content/src/data/modes/`, register it, then list its ID in compatible arenas.

Current victory strategies:

- `LAST_TEAM_STANDING`
- `DEFEAT_BOSS`
- `SURVIVE_TICKS`

A genuinely new objective may require a new strategy in the simulation, but it should remain isolated from movement, physics, abilities and rendering.

## Element interactions

Elemental damage modifiers live in `element-interactions.json`, independent of fighter identity. Systemic interactions such as Wet + electricity or water extinguishing Burn should be reusable status/environment rules, not fighter-name checks.

## Mass-control fighter example: Ballast

Ballast demonstrates how to build a setup-and-payoff fighter without a resource meter:

- `featherlight` uses `massMultiplierPerStack` so the normal knockback system automatically launches prepared targets farther.
- `anchored` increases effective mass and reduces movement through status data.
- `Skip Stone` uses native projectile `bounce` plus a finite `maxWallBounces` budget.
- modules may add to a native projectile's ricochet budget through `primaryProjectileMaxWallBounces`.
- AI rules use `targetStatusId`, `minimumTargetStatusStacks` and `priorityPerTargetStatusStack` to prefer Downbeat after setup.
