# v1.1 Stage 2 — Match Flow and Combat Rules

This stage implements the second section of the v1.1 polish specification. It extends the current command/event/snapshot architecture rather than replacing it.

## Scope completed

### Stable match completion

The simulation now creates an immutable `BattleResultSnapshot` when the official objective is completed. It records:

- end reason: elimination, boss defeated, survival complete, timeout, or draw
- winning team, or `null` for a draw
- surviving winner entity IDs
- ending simulation tick

Once the result exists:

- the runner accepts no further commands
- AI and player combat decisions stop
- active casts and armed collision abilities are cleared
- surviving fighter velocity is set to zero
- defeated fighters cannot act because they are no longer active entities
- subsequent calls to `step()` return no events

The Pixi renderer adds only a restrained winner pulse/lift. This is presentation-only and does not restart motion or alter the result.

The Battle Lab displays a responsive result card with:

- fighter/team result wording
- reason-appropriate wording for boss, survival, timeout, and draw
- Rematch using the same setup and seed
- New Random Battle
- Return to Setup

A replay playback button is intentionally not shown because the project currently records/exports replay data but does not yet contain a replay viewer.

### No passive body-contact damage

Circle-to-circle contact still performs:

- overlap correction
- momentum transfer
- restitution/bounce
- knockback
- semantic impact events for presentation and statistics

It does **not** directly reduce HP.

Health damage now requires a declared gameplay source such as an ability, blast, hazard, status pulse, and—beginning in Stage 3—weapon/projectile attacks.

Collision attacks use an explicit lifecycle:

```text
Activate configured ram/contact skill
                ↓
Cast or wind-up resolves
                ↓
Ability becomes ARMED for a finite collision window
                ↓
Valid hostile impact + trigger conditions
                ↓
Declared collision actions execute once
                ↓
Armed state is consumed
```

The lifecycle is data-driven through the ability's `ON_COLLISION` trigger and activation profile. It contains no fighter-ID exception.

### Ability activation profile

Each ability now resolves to an `AbilityActivationProfile`:

```text
intent
  offensive | defensive | movement | support | reactive

targeting
  self | target | area | direction

priority
minRange / maxRange
requiresLineOfSight
minimumTargets
aimToleranceDegrees
collisionWindowTicks
```

Definitions can override these values. Existing abilities receive reusable derived defaults based on their slot, actions, and triggers, preserving compatibility with current content.

The authoritative simulation validates player, AI, replay, and future network commands using the same rules:

- ability exists in the requested slot
- caster is alive and not already casting
- cooldown is ready
- target is alive, hostile, and in range where required
- line of sight is not blocked by an active arena obstacle
- aim is within configured tolerance
- area skills have enough useful hostile targets

The current game has no resource/mana system, so resource checks are not faked. The activation profile leaves a clean boundary for adding one if the design later requires it.

### Reusable AI action selection

AI no longer loops through skill rules and activates every rule that happens to be ready on the same tick.

For each fighter it builds candidates, records why each candidate is valid or rejected, scores valid choices, and emits at most one ability command. Scoring considers:

- ability/profile priority
- emergency defensive utility from missing health
- useful target count for area actions
- range suitability
- profile-specific cadence and health thresholds

Stable tie-breaking uses score, slot order, then ability ID. The simulation validates the chosen action again, keeping AI advisory rather than authoritative.

Debug metrics expose:

- selected target
- action kind
- selected slot/ability
- score
- reason
- candidate rejection reasons in controller diagnostics

### Compatibility

`collisionDamageCooldownTicks` remains optional in `BattleRules` only so old battle/replay JSON can still parse. It is deprecated and ignored because ordinary body collision no longer causes damage.

## Important files changed

- `packages/protocol/src/index.ts`
- `packages/content/src/schemas.ts`
- `packages/content/src/index.ts`
- `packages/content/src/data/fighters/*.json`
- `packages/simulation/src/world.ts`
- `packages/simulation/src/runner.ts`
- `packages/simulation/src/checksum.ts`
- `packages/controllers/src/actionSelection.ts`
- `packages/controllers/src/index.ts`
- `packages/renderer-pixi/src/index.ts`
- `apps/game/src/runtime/BattleRuntime.ts`
- `apps/game/src/App.tsx`
- `apps/game/src/styles.css`
- `tests/stage2-combat-flow.test.ts`
- `validation/v1.1-stage2-headless.ts`

## Intentionally deferred

These items belong to later stages:

- reusable weapon hitboxes and projectiles (Stage 3)
- Player Mode centering and touch-device policy (Stage 4)
- Training Mode (Stage 5)
- layered VFX rewrite (Stage 6)
- measured large-battle optimization (Stage 7)
- real-device responsive/rendering pass (Stage 8)
