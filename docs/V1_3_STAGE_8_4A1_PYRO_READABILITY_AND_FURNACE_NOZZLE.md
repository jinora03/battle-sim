# Kinetic Battle Engine v1.3.2 — Stage 8.4A.1

## Pyro readability adjustment

This is a focused presentation/gameplay adjustment, not another full Pyro rework.

- Pyro now uses the dedicated `pyro-combo-bruiser` AI profile.
- Normal spacing changes from charger-style body pressure to close-range orbiting.
- Stream-primary commitment holds a firing lane during Flame Jet windup/active frames.
- Cinder Rush is reserved for meaningful engages at 240–520 units instead of being used while already in close range.
- Flame Jet, Burn, Heat, Combustion and Meltdown values remain unchanged when no new module is equipped.

## Furnace Nozzle module

`furnace-nozzle` is a new Pyro offense module.

- Replaces Flame Jet projectile spawning with a deterministic pulsed cone query.
- Channels for 72 active ticks and resolves one pulse every 6 ticks.
- Applies Flame Jet's Burn status every third pulse rather than every damage pulse.
- Retains 72% locomotion acceleration while the channel is active.
- Uses stable active-id snapshots and line-of-sight checks; it does not spawn per-tick flame projectiles.
- Mounts a visible forward nozzle and rear fuel tank.
- The renderer draws a persistent flame cone only while the converted primary is active.
- Continuous hit presentation suppresses per-pulse hit-stop and metallic hit audio while retaining damage, Burn, passive and hit-confirm semantics.

The primary attack id remains `flame-fists` for replay/content compatibility.
