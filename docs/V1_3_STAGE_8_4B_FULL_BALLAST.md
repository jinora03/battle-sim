# Kinetic Battle Engine v1.3.3 — Stage 8.4B Full Ballast

Stage 8.4B uses the mass-manipulation foundation from Stage 8.4A to ship the complete Ballast fighter without introducing another combat-resource meter.

## Fighter identity

Ballast is a close-to-mid-range controller whose normal loop is:

1. Apply Featherlight with Skip Stone or Featherfall.
2. Orbit while looking for wall-bank angles.
3. Use Downbeat after the target reaches two or more Featherlight stacks.
4. Use Dead Weight when committing at close range or resisting a launch.
5. Use Last Call to make the surrounding arena weightless while Ballast becomes Anchored.

## Kit

- **Passive — House Rules:** Skip Stone adds extra launch force against targets already carrying at least two Featherlight stacks. During Last Call, primary hits add another weighted void impact.
- **Basic — Skip Stone:** A finite-ricochet void projectile that applies one Featherlight stack.
- **Skill 1 — Featherfall:** Applies two Featherlight stacks in an area and lightly gathers affected enemies.
- **Skill 2 — Downbeat:** A directional damage wave with high knockback. Featherlight's lower effective mass and the conditional payoff trigger make prepared targets launch much farther.
- **Skill 3 — Dead Weight:** Applies Anchored to Ballast and creates a short defensive impact pulse.
- **Ultimate — Last Call:** Applies Last Call and Anchored to Ballast, applies maximum Featherlight to nearby enemies, pulls them inward and resolves a large void wave.

## Modules

- `polished-stone`: two extra Skip Stone ricochets with a direct-damage tradeoff
- `loaded-shaker`: stronger Downbeat damage and launch force
- `floor-bolts`: lower incoming knockback and longer Anchored duration
- `rolling-service`: faster movement and primary cadence
- `gravity-caddy`: periodic nearby Featherlight pulse
- `closing-time`: larger and stronger Last Call

## Engine change

Native bouncing primary attacks now add module-provided ricochet budget instead of ignoring it. Existing native-bounce attacks keep their original values when no such module is equipped, while non-native projectiles retain the previous module behavior.

## Compatibility

- Replay JSON schema is unchanged.
- Engine/content version advances to `1.3.3-stage8.4b`.
- Existing fighter IDs, ability IDs and primary-attack IDs are unchanged.
- Ballast is appended to the public fighter and primary-attack lists to preserve existing ordering.
