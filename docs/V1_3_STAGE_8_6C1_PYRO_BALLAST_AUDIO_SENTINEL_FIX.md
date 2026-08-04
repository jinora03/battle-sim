# v1.3 Stage 8.6C-1 — Pyro/Ballast Audio and Solar Sentinel AI Fix

## Scope

Stage 8.6C-1 is the first roster rollout of the intent-based combat-audio system introduced in Stage 8.6A and validated on Volt in Stage 8.6B.

This batch migrates Pyro and Ballast. It also includes the requested Solar Sentinel correction because the audit found a concrete content configuration bug rather than a deeper beam-system failure.

## Pyro audio hierarchy

```text
Flame Jet basic < Cinder Rush / Fire Vortex < Combustion < Meltdown
```

- **Cinder Rush:** short furnace ignition, explosive departure, moving flame body and burn tail.
- **Fire Vortex:** inward heat draw, vortex activation, brief flame sustain and burn release.
- **Combustion:** burn-stack anticipation, detonation body and pressure release. It is classified as a payoff skill.
- **Meltdown:** furnace rise, ignition blast, transformation roar and residual burn discharge. It remains the loudest Pyro ability.

## Ballast audio hierarchy

```text
Skip Stone basic < Featherfall / Dead Weight < Downbeat < Last Call
```

- **Featherfall:** light mass-shift cue, low gravity pull and status shimmer.
- **Downbeat:** compressed windup and heavy directional mass impact. It is classified as a payoff skill.
- **Dead Weight:** anchoring buildup, outward pressure hit and short stabilizing hum.
- **Last Call:** deep gravity anticipation, arena-wide pull, anchored sustain and final mass release.

Ballast uses the gravity palette, so the structure is shared with other intent profiles while its pitch and waveform remain distinct from Volt and Pyro.

## Solar Sentinel root cause

Solar Sentinel referenced the generic `aggressive-brawler` AI profile. That profile was later specialized for Pyro and required the `heat` resource for both skill 3 and the ultimate.

Solar Sentinel does not own a Heat resource. Its AI therefore rejected Solar Eye Beams with an impossible prerequisite even though the ability itself was ready and functional for player commands.

## Solar Sentinel correction

A dedicated `solar-sentinel` AI profile now:

- preserves its close-range powerhouse movement style;
- uses Solar Aegis below 68% health;
- evaluates Solar Eye Beams across the ability's real 90–1080 range;
- has no unrelated Heat or burn-stack requirements;
- gives the ultimate enough priority to begin its existing stationary tracking channel when ready.

The laser ability, damage ramp, rotation tracking, cooldown and channel implementation are unchanged.

## Determinism boundary

Pyro and Ballast changes are Web Audio presentation data only and do not enter simulation state.

The Solar Sentinel fix intentionally changes AI command selection because the old command path was blocked by an invalid resource gate. No beam damage, physics or timing values were changed.
