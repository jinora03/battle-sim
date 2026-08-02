# Stage 8.2R7 — Content Registry and Fighter Definition Decomposition

## Goal

Remove fighter ownership, catalog construction, activation-profile derivation, and registry mutation from `packages/content/src/index.ts` without changing any public content behavior.

## Result

`packages/content/src/index.ts` is now an 8-line public facade. Built-in fighter content is grouped into fighter-owned manifests, while generic lookup and mutation behavior is centralized in a registry module.

## Structure

```text
packages/content/src/
  index.ts
  catalogs/
    sharedPrimaryAttacks.ts
    worldContent.ts
  fighters/
    types.ts
    index.ts
    pyro/index.ts
    mech/index.ts
    water/index.ts
    bomber/index.ts
    frost/index.ts
    volt/index.ts
    thorn/index.ts
    void/index.ts
    gunner/index.ts
    rocket/index.ts
    solar-sentinel/index.ts
  profiles/
    activationProfiles.ts
  registries/
    contentRegistry.ts
  validation/
    attackCatalog.ts
```

## Responsibilities

### Fighter manifests

Each fighter manifest owns the imports and definitions for that fighter's:

- fighter JSON
- AI profile, when the fighter introduces one
- ability JSON files
- primary attack
- fighter-specific skill projectiles

The existing JSON files remain in `src/data` during this phase. This avoids unnecessary file moves while giving every fighter one clear composition point.

### Fighter catalog

`fighters/index.ts` assembles the built-in manifests while explicitly preserving the historical ordering exposed by:

- `listFighters()`
- `listAiProfiles()`
- `listAbilities()`
- `listPrimaryAttacks()`
- skill-projectile lookup

### Content registry

`registries/contentRegistry.ts` owns:

- schema parsing
- immutable built-in ID tracking
- runtime maps and lookups
- custom fighter registration and removal
- reference validation
- element interaction lookup
- public list functions

### Activation profiles

`profiles/activationProfiles.ts` owns deterministic ability and primary-attack activation-profile derivation. Its cache and derivation rules are unchanged.

### Attack validation

`validation/attackCatalog.ts` owns form/behavior compatibility and startup catalog validation.

### World catalogs

`catalogs/worldContent.ts` owns status, arena, game-mode, and element-interaction imports.

## Compatibility constraints

This phase intentionally keeps all of the following unchanged:

- `CONTENT_VERSION`
- public runtime export names
- fighter, AI, ability, primary-attack, skill-projectile, status, arena, and mode IDs
- catalog ordering
- object values and balance numbers
- activation-profile outputs
- custom fighter registration behavior and error messages
- replay and protocol contracts
- simulation behavior

## Validation

The refactor was checked with:

- `git diff --check`
- project lint
- strict targeted TypeScript compilation for protocol and content sources
- compiled before/after public API parity comparison
- lookup, ordering, activation-profile, element-interaction, and custom-registration parity checks
- clean patch application against the exact R6.7 baseline

The before/after parity harness reported:

```text
44 runtime exports
11 fighters
10 AI profiles
47 abilities
16 primary attacks
7 arenas
7 modes
exact public content parity
```
