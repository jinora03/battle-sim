# Stage 8.2R3 — Pixi Fighter Presentation Refactor

## Goal

Reduce the responsibility of `packages/renderer-pixi/src/index.ts` without changing gameplay, rendering output, settings, replay behavior, or the renderer's public API.

## Extracted responsibilities

### Fighter composition

`packages/renderer-pixi/src/fighters/FighterView.ts`

Owns fighter interpolation, cast motion, body and weapon drawing, hit feedback, labels, and composition of fighter presentation subcomponents.

### Fighter health rings

`packages/renderer-pixi/src/fighters/FighterHealthRing.ts`

Owns delayed HP interpolation, low-health pulse rendering, radius-relative sizing, and the HP-ring visibility setting.

### Fighter status indicators

`packages/renderer-pixi/src/fighters/FighterStatusIndicators.ts`

Owns Target Lock ring and stack-segment rendering. This is the extension point for future Burn, Heat, Chill, Freeze, and other readable fighter statuses.

### Mounted attachments

`packages/renderer-pixi/src/fighters/MountedAttachmentView.ts`

Owns visibility and delegation to the existing data-driven mounted-attachment renderer. Attachment scale, offset, white outlines, reduced-motion behavior, and large-battle LOD remain unchanged.

### Damage numbers

`packages/renderer-pixi/src/effects/DamageNumberLayer.ts`

Owns damage-event consumption, text-node creation, severity presentation, the 40-node retention cap, animation, and cleanup.

## Compatibility guarantees

- `PixiBattleRenderer` keeps the same exported methods and signatures.
- `VisualLod` remains exported from the package entry point.
- No content JSON, simulation code, settings schema, abilities, balance values, or replay formats changed.
- Existing HP-ring, mounted-attachment, damage-number, reduced-motion, and mass-battle visibility behavior is preserved.
- No new dependencies were added.

## Result

`packages/renderer-pixi/src/index.ts` is reduced by roughly 530 lines. It remains the renderer facade and orchestration layer while fighter-specific presentation is now isolated behind focused components.
