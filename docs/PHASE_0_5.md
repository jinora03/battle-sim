# Phase 0.5 — Fighter Creator & Content Pipeline

## Goal

Prove the project's central architectural promise: a genuinely new fighter can be created through composition and entered into a battle without adding fighter-specific simulation code.

## New package: `@kinetic/creator`

The creator package defines a versioned portable bundle:

```text
FighterBundle v1
├── fighter        identity, classification, physics, stats, AI, skills
├── visualRecipe   body template, colors, weapon, horns
└── motionRecipe   stretch, squash, lean, pulse, weapon spin
```

`validateFighterBundle()` checks:

- schema version
- number ranges and allowed enum values
- AI profile existence
- equipped ability existence
- visual and motion recipe ID references

`registerFighterBundle()` then updates the runtime content/visual registries. Built-in IDs cannot be overwritten.

## Fighter Lab

The React application now has two tools:

- **Battle Lab:** the playable deterministic battle testbed from v0.4
- **Fighter Lab:** an internal content-authoring interface

The Fighter Lab supports:

- starting from Arc Prototype
- duplicating any registered fighter
- stat/physics editing
- AI profile selection
- five-slot ability assignment
- visual-template and palette editing
- lightweight motion recipe tuning
- live preview
- validation diagnostics
- save/register
- save and test fight
- import/export JSON
- local browser persistence
- deleting custom definitions

## Runtime registries

`@kinetic/content` now supports validated custom fighter registration and removal. `@kinetic/visual-engine` supports custom visual/motion recipe registration and removal. Existing read APIs (`getFighter`, `getVisualRecipe`, `getMotionRecipe`) remain unchanged, so simulation and renderer code do not need a separate path for custom content.

## What v0.5 intentionally does not do

- It does not create new gameplay primitives from the UI.
- It does not allow arbitrary JavaScript plugins from user files.
- It does not provide a full drawing/vector tool.
- It does not publish or synchronize content online.

Skills are assigned from the existing validated ability library. A future ability editor can produce the same `AbilityDefinition` format, but it should be implemented as its own controlled authoring phase.

## Architecture proof

The headless validation registers `Headless Arc Prototype`, runs it against Bomber, and repeats the same seed twice. Both runs reach tick `900`, activate three skills for the custom entity, and produce checksum `a7d24a49`.

No branch checks for `headless-arc-prototype` in simulation, AI, or physics.
