# Kinetic Battle Engine v1.3.17 — Stage 8.7C-1 Volt and Pyro VFX

Stage 8.7C-1 applies the Stage 8.7 intent-based combat-VFX system to Volt Striker and Pyro. The phase is presentation-only: fighter data, ability data, AI, damage, cooldowns, statuses, physics, and deterministic simulation behavior are unchanged.

## Volt Striker

### Lightning Dash

- charge-direction anticipation
- bright departure discharge
- short electrical travel residue
- overcharged status release cue

### Arc Burst

- radial electrical buildup
- expanding activation flash and shockwave
- shocked-status release cue

### Polarity Pull

- payoff-tier visual hierarchy
- particles visibly travel inward instead of radiating outward
- compressed electric core on activation
- residual field followed by a pressure release

### Thunder Dome

Thunder Dome remains the existing Stage 8.7A benchmark. Its profile is retained as the strongest Volt presentation and is now evaluated alongside the complete Volt kit.

## Pyro

### Cinder Rush (`magma-dash`)

- ignition anticipation
- directional flame departure
- short ember sustain layer
- burn/status release cue

The existing snapshot-driven Cinder Rush trail and Pyro furnace aura remain active; the profile adds lifecycle readability without replacing those strong persistent visuals.

### Fire Vortex (`flame-ring`)

- inward furnace buildup
- reusable pull-intent compression
- rotating fire sustain
- burn application release

### Combustion (`molten-guard`)

- payoff-tier furnace pressure buildup
- detonation activation
- burn-consumption residue
- knockback release

### Meltdown (`inferno-collapse`)

- transformation anticipation
- ultimate-grade fire activation
- sustained transformation heat
- final burn/status discharge

Pyro's existing Heat and Meltdown snapshot aura remains the long-duration visual source of truth.

## Renderer foundation improvements

- added reusable inward particle motion for `pull` intent
- supported inward pull rendering in both full-quality and budgeted/mass-battle paths
- added generic profile-driven semantic blast presentation
- removed the old `flame-ring`, `molten-guard`, and `inferno-collapse` event-ID blast branches
- used profile palette, hierarchy, and activation intent to style semantic blasts
- preserved low-quality and crowded-battle budget enforcement

## Compatibility

- engine/content version: `1.3.17-stage8.7c1`
- no replay schema change
- no fighter or ability JSON change
- no gameplay balance change
- no simulation RNG change
