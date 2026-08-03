# Stage 8.2R7.2 — Loadout and Fighter Module Decomposition

## Purpose

This stage separates fighter-module data from loadout resolution and registry behavior. It is an organizational refactor only. Existing module IDs, attachment recipes, compatibility rules, default loadouts, modifier math, error messages, and public exports remain unchanged.

## Structure

```text
packages/content/src/loadouts.ts
packages/content/src/loadouts/
  index.ts
  internal.ts
  loadoutResolver.ts
  moduleCatalog.ts
  moduleValidation.ts
  mountedAttachments.ts
  sharedModules.ts
  fighterModules/
    gunnerModules.ts
    index.ts
```

`loadouts.ts` remains as a compatibility facade, so existing imports continue to work.

## Boundaries

- `fighterModules/gunnerModules.ts` owns Gunner-specific module and mounted-attachment data.
- `sharedModules.ts` is the catalog extension point for modules intentionally reusable by multiple fighters.
- `moduleCatalog.ts` owns deterministic module registration and public lookups.
- `moduleValidation.ts` owns module and mounted-attachment catalog validation.
- `loadoutResolver.ts` owns slot validation and modifier aggregation.
- `mountedAttachments.ts` owns deterministic mounted-attachment resolution.
- `internal.ts` owns non-public cloning and module ordering helpers.

## Intentionally unchanged

- all six fighter-module definitions
- module and mounted-attachment ordering
- all modifier values
- clone behavior of list APIs and resolved loadouts
- `getFighterModule` lookup behavior
- compatibility and one-module-per-slot errors
- public `@kinetic/content` exports
- simulation and rendering behavior
- protocol and replay schemas
