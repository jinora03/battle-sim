# V1.3 Stage 8.3B — Full Pyro Rework

Stage 8.3B converts Pyro from the legacy fire bruiser into a Heat-and-Burn combo fighter. Stable fighter, primary-attack, and ability IDs are retained for replay and content compatibility while their player-facing identities and behavior are replaced.

## Fighter identity

- **Passive — Living Furnace**: fire damage, new Burn stacks, and Flame Jet hits build Heat. During Meltdown, Flame Jet deals an additional fire hit and applies additional Burn.
- **Basic — Flame Jet** (`flame-fists`): a short-range, three-pulse fire stream that applies Burn.
- **Skill 1 — Cinder Rush** (`magma-dash`): a directional fiery engage with a collision ignition window.
- **Skill 2 — Fire Vortex** (`flame-ring`): creates a target-centered furnace vortex, ignites enemies, and pulls nearby enemies toward the selected target.
- **Skill 3 — Combustion** (`molten-guard`): requires at least two Burn stacks, consumes Burn in range, and scales each detonation's damage, force, and visual radius by consumed stacks.
- **Ultimate — Meltdown** (`inferno-collapse`): fills Heat, enters a five-second Meltdown state, ignites nearby enemies, and empowers Pyro's other actions.

The intended loop is:

`Flame Jet → Cinder Rush / Fire Vortex → Combustion → Meltdown power window`

## Modules

Six developer-approved Pyro modules are registered:

- **Accelerant Nozzle**: one additional Burn stack per application; Flame Jet direct damage is reduced by 12%.
- **Blast Vent**: Combustion gains 18% damage, 24% force, and 12% effective radius.
- **Thermal Shield**: at 60% Heat or higher, incoming damage is reduced by 16%.
- **Afterburner**: Cinder Rush gains 28% self impulse and a 30% longer ignition window.
- **Ember Satellite**: visible orbiting attachment; extends Burn duration and spreads Burn in a 210-unit pulse every 120 ticks while Pyro has at least 20 Heat.
- **Overpressure Core**: Meltdown gains 20% damage and 15% radius, while Heat decays 35% faster.

## Visual identity

- Burning fighters now carry a persistent snapshot-driven flame overlay.
- Burn presentation scales from one to five stacks using stronger glow, additional flames, and rising embers.
- Pyro has a Heat-driven furnace aura and an active Cinder Rush flame tail.
- Meltdown adds a high-intensity overheat shell and vent pattern.
- Flame Jet projectiles render as layered flame tongues rather than generic bolts.
- Fire Vortex uses a dark rotating furnace spiral.
- Combustion creates individual stack-scaled furnace detonations on every consumed target.
- Meltdown uses a large double shockwave, fire spiral, flash, and ember burst.
- Ember Satellite has a dedicated outlined, glowing attachment silhouette.

Army LOD reduces persistent flame and ember counts, and reduced-motion mode removes the most animated oscillation while preserving status readability.

## Reusable engine additions

Stage 8.3B adds data-driven support for:

- target-centered area effects;
- status-stack detonation and consumption;
- per-ability damage, impulse, radius, and self-impulse module multipliers;
- status-stack application bonuses;
- resource gain and decay multipliers;
- resource-threshold damage reduction;
- deterministic module-owned periodic status pulses;
- AI rules based on target status stacks and fighter resources.

These features are generic and are not hardcoded to Pyro.

## Compatibility

- Fighter ID remains `pyro-brawler`.
- Primary ID remains `flame-fists`.
- Ability IDs remain `magma-dash`, `flame-ring`, `molten-guard`, and `inferno-collapse`.
- Existing non-Pyro deterministic scenarios retain byte-identical snapshots, checksums, and ordered events.
- Engine/content version is `1.3.0-stage8.3b`.
