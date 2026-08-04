# V1.3 Stage 8.7B — Gunner and Solar Sentinel VFX Migration

## Goal

Stage 8.7B validates the intent-based combat-VFX foundation on two fighters whose presentation depends on timing and sustained state:

- Gunner, with burst cadence and a status-bound rotary-cannon ultimate
- Solar Sentinel, with a multi-stage charge, live tracked beam, contact period, and shutdown

This phase is presentation-only. It does not change damage, cooldowns, AI, targeting, projectiles, beam collision, statuses, physics, replay data, or deterministic simulation output.

## Gunner lifecycle

The complete Gunner kit now has VFX profiles:

- **Tactical Slide** — directional anticipation, dash activation, restrained projectile release
- **Suppressive Burst** — firing preparation, directional launch, six-round sustain, mechanical settle
- **Pinning Round** — focused projectile charge, payoff launch, status confirmation
- **Kill Zone** — rotary transformation, ultimate activation, sustained firing rhythm, spin-down

Kill Zone also declares a reusable persistent rig:

```text
status: kill-zone-overdrive
rig: rotary-cannon
```

`FighterView` resolves the rig from active status metadata. It no longer checks for the Gunner fighter ID or hardcodes the overdrive status inside the renderer.

## Solar Sentinel lifecycle

- **Sky Rush** — directional charge, dash activation, knockback release
- **Thunder Clap** — radial anticipation, explosive activation, pressure release
- **Solar Aegis** — transformation buildup, armor activation, fortified sustain, status settle
- **Solar Eye Beams** — eye charge, beam ignition, live channel, shutdown release

The live Solar Eye Beams renderer remains snapshot-bound so the beam tracks the fighter and target and disappears as soon as casting ends. Its timing is now supplied by profile metadata:

```text
eye charge end: 30 ticks
beam start: 48 ticks
beam range: 1080
```

The telegraph renderer no longer contains an ability-ID check for Solar Eye Beams.

## Reusable renderer behavior

Stage 8.7B adds `burst-fire` to the VFX intent vocabulary and teaches both renderer paths to distinguish:

- projectile launch direction
- burst-fire cadence
- dash exhaust direction
- beam ignition and shutdown
- transformation and status layers

Profiles may also override the base elemental core, accent, and glow colors. This allows Solar Sentinel and Gunner to retain their visual identity without adding fighter-specific renderer branches.

## Performance and compatibility

- Full-quality battles use the richer `FxEngine` implementation.
- Low-quality and crowded battles use the same profiles through `LayeredVfxEngine` with existing budgets.
- Real projectiles, the live beam, and the rotary-cannon status remain authoritative for sustained presentation.
- Existing unprofiled abilities continue using `SkillPresentationRecipe` fallback behavior.
- Engine/content compatibility markers advance together to `1.3.16-stage8.7b`.

## Validation

Run locally:

```bash
npm run check
```

Manual review should include Gunner versus Solar Sentinel in Battle and Ability Lab, plus a larger skirmish to confirm that burst effects remain readable without excessive particle noise.
