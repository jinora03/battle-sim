# Stage 8.2R7.1 — Content Schema Decomposition

## Purpose

The former `packages/content/src/schemas.ts` contained every public content type and every Zod validator in one 696-line file. This stage separates those definitions by domain while preserving the existing `@kinetic/content` API.

## Structure

```text
packages/content/src/schemas/
  fighterSchema.ts
  attackSchema.ts
  projectileSchema.ts
  aiSchema.ts
  abilitySchema.ts
  attachmentSchema.ts
  moduleSchema.ts
  statusSchema.ts
  arenaSchema.ts
  modeSchema.ts
  elementSchema.ts
  internal.ts
  index.ts
```

`packages/content/src/schemas.ts` remains as a compatibility facade, so existing imports from `./schemas`, `../schemas`, and `@kinetic/content` continue to work.

## Boundaries

- Fighter definitions and minimum radius live in `fighterSchema.ts`.
- Primary attack shapes live in `attackSchema.ts`.
- Projectile and status-interaction shapes live in `projectileSchema.ts`.
- AI profiles and rules live in `aiSchema.ts`.
- Ability actions, conditions, passives, and validation live in `abilitySchema.ts`.
- Mounted presentation components live in `attachmentSchema.ts`.
- Fighter modules and resolved loadouts live in `moduleSchema.ts`.
- Status, arena, mode, and element schemas each have their own domain file.
- Shared internal Zod enums are centralized in `internal.ts` but are not added to the public package API.

## Compatibility guarantees

This stage intentionally changes no:

- public export names
- type shapes
- Zod schema definitions or defaults
- fighter radius requirements
- content IDs or balance values
- catalog ordering
- replay or protocol contracts
- runtime lookup behavior

## Validation

The schema facade and decomposed files were checked with:

- project lint
- strict targeted TypeScript compilation for protocol and content
- exact public export-name and type/value classification comparison
- AST-level comparison of all 52 original type/schema declarations and initializers
- `git diff --check`
- clean patch application on the Stage 8.2R7 baseline
