# v1.3.13 Stage 8.6C-3 — Bomber and Mech Bruiser Audio Rollout

## Goal

Complete the initial Stage 8.6 roster rollout by giving Bomber and Mech Bruiser coherent, reusable combat-audio identities without changing damage, cooldowns, AI, movement, knockback, projectiles, physics, or replay behavior.

## Bomber

Bomber now uses a reusable `explosive` palette rather than sharing a generic mechanical or elemental tone set. The palette combines low pressure, a sharp ignition transient, fuse-like pulses, and a residual blast tail.

### Impact Bomb

The primary attack now has three readable moments:

1. launcher-arm and fuse-primer commitment
2. airborne launch body with a light fuse pulse
3. separate shell impact and low explosive pressure body

The basic remains below Bomber's skills and ultimate in the mix.

### Blast Dash

- short ignition anticipation
- propulsion/knockback activation
- restrained moving combustion sustain
- compact blast release

### Concussion Bomb

- pressure-building anticipation
- normal-skill explosion body
- separate knockback tail

### Shrapnel Burst

Shrapnel Burst is the payoff-tier skill:

- casing tension before release
- stronger central detonation
- short fragment/burst rhythm
- pressure and self-recoil release

### Mega Bomb

Mega Bomb uses the complete four-layer hierarchy:

1. long arming and fuse anticipation
2. ultimate detonation transient and low blast body
3. residual combustion/pressure sustain
4. delayed knockback and pressure release

## Mech Bruiser

Mech Bruiser retains the mechanical palette but now uses it consistently for servo preparation, magnetic pull, armor locking, and reactor output.

### Hydraulic Gauntlet

- servo and piston preload during attack windup
- low hydraulic slam on contact
- metal/body impact layer
- short high-frequency mechanical accent

### Kinetic Pulse

- compact mechanism charge
- radial knockback activation
- secondary energy-pressure release

### Magnet Drag

- magnetic pull buildup
- descending attraction activation
- sustained compression hum
- final pressure-settle impact

### Fortify

Fortify is the defensive payoff ability:

- armor-lock anticipation
- hydraulic transformation activation
- fortified status sustain
- mechanism-settle release

### Reactor Overdrive

- reactor startup anticipation
- ultimate transformation activation
- sustained machinery and reactor output
- controlled pressure/spin-down release

## Reusable audio additions

- new `explosive` palette available to future bomb, grenade, mine, and demolition abilities
- generic explosive anticipation pulses
- generic ignition transient and low-pressure activation body
- generic explosive pressure-release tail
- no Bomber ability IDs inside the generic sound renderer

## Determinism and gameplay safety

All changes are inside the presentation-only audio package, release tests, documentation, and compatibility markers. Fighter content, ability JSON, simulation systems, AI selection, seeded opening readiness, and replay command flow are unchanged.
