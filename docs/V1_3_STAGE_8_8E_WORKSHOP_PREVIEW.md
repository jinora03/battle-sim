# v1.3.25 Stage 8.8E — Workshop and Unified Fighter Preview

## Goal

Make the Developer Fighter Workshop feel like a real authored-content tool rather than a disconnected prototype form. The live preview, Battle Setup preview and Roster portrait now consume the same fighter body, primary-attack and mounted-attachment data.

## Unified fighter portrait

A reusable `FighterPortrait` component now renders:

- the selected body template and visual colors,
- the authoritative primary attack silhouette,
- horns and body-specific details,
- selected/default module attachments,
- fighter-radius scale and facing direction.

The component is shared by:

- Developer Fighter Workshop,
- Battle Setup fighter previews,
- Roster cards.

The arena still uses the Pixi renderer. The shared portrait is a lightweight DOM preview driven by the same authored content data, not a second simulation or a screenshot of the arena renderer.

## Authored kit-source rules

Custom recipes can now declare `kitSourceFighterId`. This source controls which authored combat pieces the recipe may reuse:

- primary attack,
- skill slots,
- passives,
- approved module catalog.

A sourced recipe may remove an optional skill, but it may not borrow a weapon, skill, passive or module from another fighter. Imported and saved bundles use the same validation.

Custom fighters derived from a built-in kit can equip that kit's modules because module compatibility resolves through `kitSourceFighterId`. Their explicit `moduleSlots` remain the final approval list.

## Workshop improvements

- Added clear spacing between the workshop description and source selector.
- Reduced selection typography for denser authoring controls.
- Renamed the source control to **Approved kit to duplicate**.
- Added a visible **Locked kit source** explanation.
- Replaced cross-roster weapon selection with an approved-weapon summary and restore action.
- Restricted skill selectors to the approved source skill for each slot.
- Added a default module editor with one module per slot.
- `Save & test fight` now equips the selected default modules.

## Live Recipe Preview redesign

The preview now includes:

- a larger battle-data-driven fighter portrait,
- actual primary weapon silhouette,
- mounted module attachments,
- structured HP, radius, mass and speed cards,
- a wide primary-attack card,
- basic/skill/ultimate loadout cards,
- selected module chips,
- standard versus Tuned Version state.

## Roster and Battle Setup consistency

Battle Setup and Roster now use the same portrait component. Roster portraits display authored default-module attachments, while Battle Setup displays the modules currently selected for that battle.

## Compatibility and validation

- Added validation for duplicate default module slots.
- Legacy custom bundles without `kitSourceFighterId` remain supported.
- No damage, cooldown, AI, physics, replay or deterministic simulation values changed.
- Version markers advance to `1.3.25-stage8.8e`.
