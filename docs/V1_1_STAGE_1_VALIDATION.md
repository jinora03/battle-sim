# v1.1 Stage 1 Validation

## Completed checks

### Repository lint

```text
npm run lint
Project lint passed.
```

The repository lint checks source formatting and the architectural rule that fighter IDs must not be used for special-case logic inside the simulation package.

### Strict TypeScript structural check

The complete app/package graph passed strict TypeScript checking using temporary local declaration stubs for external packages because the execution environment could not complete the npm dependency download.

```text
TypeScript errors: 0
```

The temporary stubs were removed before packaging.

### TSX syntax/transpile check

All 39 TypeScript/TSX files in `apps`, `packages`, and `tests` passed the TypeScript parser/transpiler with zero syntactic diagnostics.

### UI policy execution

A direct executable check validated:

- Duel fallback label resolves to `1v1 only`.
- low-priority mobile notices are suppressed.
- duplicate skill casts aggregate into one UI entry.
- grouped skill progress keeps the most advanced cast.

```text
ui-model validation passed
```

### Game-mode content validation

All six mode JSON files were parsed and checked for non-empty `description` and `formatLabel` fields. Duel was also checked for:

```text
minUnits: 2
maxUnits: 2
formatLabel: 1v1 only
```

```text
mode metadata validation passed
```

## Automated tests added

`tests/ui-stage1.test.ts` covers:

- Duel display accuracy
- complete mode descriptions/capacity labels
- notification duration policy
- compact-screen notice suppression
- repeated skill-cast aggregation

`tests/content-and-modes.test.ts` now also asserts Duel’s `1v1 only` content metadata.

## Validation not executable in this environment

The npm registry dependency installation did not complete within the tool execution window, so these commands could not be executed against the real React/Pixi/Vite dependencies here:

```text
npm test
npm run build
npm run check
```

Run them locally after extraction. A real browser pass is also required at desktop wide, desktop narrow, mobile portrait and mobile landscape sizes.

## Simulation impact

No file in these packages changed:

- `packages/simulation`
- `packages/controllers`
- `packages/renderer-pixi`
- `packages/audio`
- `packages/replay`
- `packages/meta`

Therefore Stage 1 does not intentionally alter battle results or deterministic checksums. The existing full regression suite must still be run locally before Stage 2 begins.
