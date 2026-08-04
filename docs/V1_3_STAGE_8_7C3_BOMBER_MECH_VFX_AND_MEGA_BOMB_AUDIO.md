# v1.3.19 Stage 8.7C-3 — Bomber and Mech VFX + Mega Bomb Audio Retune

## Purpose

Complete the first full-roster intent-based VFX rollout by migrating Bomber and Mech Bruiser, while correcting Mega Bomb's overly bright/high-pitched ultimate detonation.

This phase is presentation-only. It does not change damage, cooldowns, impulses, statuses, AI, physics, replay state, or deterministic simulation behavior.

## Bomber VFX profiles

### Blast Dash

- Directional ignition anticipation.
- Forward dash activation.
- Short combustion/smoke sustain.
- Small explosive release behind the movement.

### Concussion Bomb

- Warning/pressure anticipation.
- Radial explosion activation.
- Radial pressure-wave release.

### Shrapnel Burst

- Casing-tension transformation anticipation.
- Payoff-tier explosion.
- Fragment/burst-fire sustain.
- Radial recoil release.

### Mega Bomb

- Long ultimate danger buildup.
- Largest Bomber explosion profile.
- Lingering smoke/debris field.
- Heavy radial pressure release.

Visual hierarchy remains:

`Blast Dash / Concussion Bomb < Shrapnel Burst < Mega Bomb`

## Mech Bruiser VFX profiles

### Kinetic Pulse

- Mechanical charge.
- Radial kinetic discharge.
- Pressure-wave release.

### Magnet Drag

- Inward magnetic anticipation.
- Inward pull activation.
- Sustained compression field.
- Radial pressure settle.

### Fortify

- Armor-lock anticipation.
- Payoff-tier transformation activation.
- Fortified-state sustain.
- Short defensive pressure release.

### Reactor Overdrive

- Ultimate reactor startup.
- Heavy transformation activation.
- Sustained machinery/energy field.
- Controlled shutdown release.

## Reusable VFX correction

The VFX layer schema now includes an explicit `directional` flag for knockback layers.

- Directional abilities such as Downbeat and Sky Rush use a forward force cone.
- Radial abilities such as Concussion Bomb, Kinetic Pulse, Thunder Clap, and Mega Bomb use radial pressure waves.

Both the full-quality `FxEngine` and the budgeted `LayeredVfxEngine` support the distinction.

Neutral profiled effects now prefer smoke/debris particles, while metal profiles prefer debris/spark treatments. Large-battle rendering remains budget-aware.

## Mega Bomb audio retune

Mega Bomb's activation uses the reusable audio variant:

`cataclysmic-explosion`

The treatment intentionally avoids the explosive palette's bright transient and instead layers:

- 74 Hz to 22 Hz sawtooth pressure body.
- 46 Hz to 20 Hz sub-bass decay.
- 118 Hz to 32 Hz low mechanical detonation layer.
- Low-frequency pulse sequence.
- Low-pass noise sweep from 420 Hz toward 145 Hz.

This keeps the existing arming and detonation timing, but replaces the piercing/high-pitched character with a deeper, heavier, more devastating blast.

The variant is reusable for future catastrophic explosions and does not check `mega-bomb` directly inside the audio engine.

## Compatibility

- Engine version: `1.3.19-stage8.7c3`
- Content version: `1.3.19-stage8.7c3`
- Game package version: `1.3.19-stage8.7c3`

README is intentionally not modified by the delivery patch to avoid branch-specific documentation conflicts.
