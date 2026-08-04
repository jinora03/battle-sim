# v1.3.12 Stage 8.6C-2 — Gunner and Solar Sentinel Audio Rollout

## Goal

Apply the Stage 8.6 intent-based audio standard to Gunner and Solar Sentinel without changing damage, cooldowns, targeting, AI, physics, or replay behavior.

## Gunner

### Tactical Slide

- short mechanical readiness cue
- forceful slide/departure layer
- restrained two-round release accent

### Suppressive Burst

- mechanical firing preparation
- readable burst activation
- controlled firing sustain underneath the six real projectile cracks
- short mechanism-settle release

### Pinning Round

- heavier projectile anticipation
- payoff-tier ballistic activation
- distinct target-lock/status confirmation

### Kill Zone

Kill Zone now uses a fully profile-driven lifecycle:

1. motor/rotor spool during its 30-tick cast
2. rotary activation as the barrage begins
3. mechanical firing sustain under the 24 real round events
4. spin-down after the barrage window

The activation, sustain, and release layers are anchored to the ability-activation event and scheduled with Web Audio timing. This avoids requiring simulation timers or Gunner-specific branches in the audio engine.

## Solar Sentinel

### Solar Punch

The primary attack receives a brighter solar launch and a heavier solar-impact body while remaining below normal skills in the mix.

### Sky Rush

- compact solar charge
- directional launch/knockback body
- short pressure-release tail

### Thunder Clap

- expanding solar anticipation
- radial impact body
- secondary knockback release

### Solar Aegis

- defensive charge cue
- payoff-tier transformation layer
- stable fortified sustain
- restrained close-range release

### Solar Eye Beams

The ultimate now follows its real channel timeline:

1. eye-charge anticipation for the first ~0.8 seconds
2. beam ignition after the existing warmup
3. sustained solar beam for the active damage window
4. shutdown discharge when the ability actually resolves

A rate-limited contact cue is emitted only when an active profiled channel produces a real damage event. Charging and near-misses therefore do not play damage contact audio.

## Reusable audio additions

- `activated` and `resolved` layer anchors
- profile-level channel-contact metadata
- generic contact tracking from `abilityActivated`, `damage`, `abilityResolved`, and `death` events
- reusable mechanical transformation spool/spin-down treatment
- reusable burst-fire sustain treatment
- reusable beam activation and shutdown treatment

## Determinism and gameplay safety

No simulation RNG, ability definitions, fighter stats, AI rules, projectile behavior, or damage logic changed. All new sequencing lives in the presentation-only Web Audio layer.
