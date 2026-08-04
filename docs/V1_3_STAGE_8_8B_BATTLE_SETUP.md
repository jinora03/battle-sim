# Kinetic Battle Engine v1.3.22 — Stage 8.8B Battle Setup UX

Stage 8.8B shortens and clarifies the configured-battle workflow without changing combat simulation.

## Changes

- Each offense, defense, mobility and utility module slot is now a collapsible disclosure.
- The collapsed header always shows the current selection, including Standard configuration.
- A compact live fighter preview appears below each fighter selector.
- The preview shows fighter identity, primary weapon, passive, complete skill row and equipped modules.
- Equipping at least one module labels the setup presentation as `Fighter · Tuned Version`.
- The preview updates directly from the current module IDs; no separate preview state is maintained.
- Start configured battle now lives at the bottom of the Battle Setup section.
- The duplicate desktop start action was removed from the arena command bar.
- Default demo setup is Gunner with one approved module in every slot versus standard Bomber in Iron Pit.

## Default Gunner loadout

- Rotary Ammo Drum (`shoulder-missile-pod` legacy-compatible ID)
- Deflector Plate
- Recoil Thrusters
- Targeting Drone

Only one module per authored slot is equipped, preserving the existing compatibility rules.

## Scope boundaries

No fighter stats, abilities, AI, physics, seed behavior, replay behavior or deterministic outcomes changed.
