# v1.2 Stage 8.1 — Data-Driven Mounted Attachments

Stage 8.1 extends the controlled fighter-loadout foundation from Stage 8.0. Modules remain developer-authored and fighter-approved, while a module may now supply one or more physical components that the renderer mounts on the fighter.

## Design boundary

A **module slot** describes gameplay ownership:

- `offense`
- `defense`
- `mobility`
- `utility`

A **mounted attachment** describes presentation and physical placement. It is not a fifth competing loadout slot. For example, Shoulder Missile Pod is an offense module with a mounted launcher, while Ricochet Chamber is an internal offense module with no visible component.

This keeps gameplay rules and rendering separate:

- `packages/content` owns module definitions, compatibility, modifiers and attachment recipes.
- `packages/simulation` consumes only the resolved numeric modifiers.
- `packages/renderer-pixi` consumes only immutable attachment recipes and snapshot module IDs.
- `apps/game` lets players select only modules approved by the selected fighter.

No Gunner-specific branch was added to the simulation runner or mounted-attachment renderer.

## Generic attachment recipe

A module can declare zero or more attachment recipes:

```ts
interface MountedAttachmentDefinition {
  id: string;
  kind: 'targeting-drone' | 'missile-pod' | 'deflector-plate' | 'thruster';
  mountPoint: 'front' | 'rear' | 'left' | 'right' | 'top' | 'orbit';
  rotationMode: 'body' | 'target' | 'counter-rotate' | 'orbit';
  forward?: number;
  lateral?: number;
  scale?: number;
  primaryColor: number;
  accentColor: number;
  glowColor?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  hideInMassBattle?: boolean;
}
```

Offsets are expressed in fighter-radius units, so the same recipe scales correctly with different fighter sizes and stat-scaled battle participants.

## Gunner modules available in Stage 8.1

| Slot | Module | Mounted components | Gameplay effect |
|---|---|---:|---|
| Offense | Ricochet Chamber | None | Primary bullets bounce once; lower primary damage |
| Offense | Piercing Barrel | None | Primary bullets penetrate one target; longer primary cooldown |
| Offense | Shoulder Missile Pod | 1 launcher | Skill-projectile damage ×1.12; homing ×1.08 |
| Defense | Deflector Plate | 1 plate | Incoming damage ×0.90; knockback ×0.90; top speed ×0.95 |
| Mobility | Recoil Thrusters | 2 thrusters | Acceleration ×1.14; top speed ×1.06; incoming knockback ×1.05 |
| Utility | Targeting Drone | 1 orbiting drone | Target Lock duration ×1.35; skill homing ×1.20 |

Only one module can occupy each slot. The resolved order is always offense, defense, mobility, utility, followed by ordinal module ID ordering.

## Rendering behavior

- Attachment definitions are resolved once when a `FighterView` is created, not every render frame.
- Fighter-view pooling now includes the equipped module set in its compatibility key, preventing a view with one loadout from being reused for a different loadout.
- Body mounts rotate with the fighter.
- Orbit mounts remain world-oriented through counter-rotation.
- Reduced-motion mode stops orbit animation and keeps a stable deterministic placement.
- Nonessential attachments are hidden at Army LOD to preserve large-battle readability and performance.

## Simulation behavior

New reusable resolved modifiers are applied at stable boundaries:

- Movement and top-speed modifiers are applied once at spawn.
- Skill-projectile damage is captured when a projectile is spawned.
- Incoming damage is applied in the centralized damage path.
- Incoming knockback is applied in the centralized impulse path.

The module IDs were already included in snapshots and checksums in Stage 8.0, so the new behavior remains replay-deterministic without adding renderer data to authoritative snapshots.

## Adding another mounted module

For a normal stat-based module, developers only need to:

1. Add its definition to `packages/content/src/loadouts.ts`.
2. Add the module ID to the approved slot of the compatible fighter JSON.
3. Use an existing attachment `kind`, or add one renderer drawing strategy in `mountedAttachments.ts`.
4. Add deterministic content and simulation tests.

Unusual mechanics such as independent drone AI, grappling, destructible sub-entities or arena modification still require a reusable simulation behavior/plugin. They should not be implemented as fighter-specific branches in `runner.ts`.

## Deliberate limits

Stage 8.1 does not add:

- independent attachment health or destruction
- autonomous turret/drone AI
- attachment-specific cooldown state
- arbitrary player-authored modules
- dynamic runtime module swapping

Those are later systems. This stage establishes a stable data and rendering boundary first.
