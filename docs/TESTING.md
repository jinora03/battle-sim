# Testing Strategy

Kinetic Battle Engine tests should protect observable behavior and stable architecture contracts, not the exact spelling of implementation code.

## Required local gate

Run before committing a completed change:

```bash
npm run check
```

That runs TypeScript checking, the Vitest suite, and the production build. Performance benchmarks are intentionally separate:

```bash
npm run bench
```

## Test hierarchy

Prefer tests in this order:

1. **Behavior/unit tests** — call public or pure functions and assert results.
2. **Integration tests** — exercise multiple packages through their supported APIs, especially simulation → replay → export preparation.
3. **Browser smoke tests** — reserve for a small set of critical DOM/canvas lifecycle flows once a browser test environment is added.
4. **Source-contract tests** — use only when the source shape itself is the contract, such as prohibiting `MediaRecorder` in the fixed-frame exporter.

Do not add tests that assert implementation details such as an exact `useState(...)` initializer, local variable name, coordinate literal, or private helper placement when the same rule can be tested through behavior.

## Ownership rule

Each behavior should have one obvious authoritative test. Avoid repeating the same creator defaults, filename rules, format rules, queue behavior, or simulation invariant across several historical stage tests.

When touching an older `stage*-*.test.ts` file:

- keep unique behavior coverage;
- remove duplicate assertions already owned elsewhere;
- replace source-text assertions with behavior tests when practical;
- move or rename the test by behavior only when that area is already being modified.

Do not perform mass renames of otherwise healthy tests solely for organization.

## Preferred test layout

New or consolidated tests should be grouped by the behavior they protect, for example:

```text
tests/
  architecture/
  content/
  replay/
  simulation/
  video-export/
```

Stage-numbered tests are legacy history. Do not create new stage-numbered test files.

## Source-text exceptions

Reading source text is acceptable only for a narrow architectural or packaging invariant that cannot reasonably be observed through the public API. Keep those assertions minimal and explain why source inspection is necessary.

Good example:

```ts
expect(exporterSource).not.toContain('MediaRecorder');
```

when the architectural contract explicitly forbids `MediaRecorder` in the fixed-frame export path.

Bad example:

```ts
expect(hookSource).toContain("useState<BroadcastLayoutId>('vertical')");
```

The latter should assert the exported/default behavior instead.

## Manual QA

Automated tests do not replace visual/device checks for presentation-heavy areas. Use `docs/STAGE_8_DEVICE_QA.md` for viewport/device coverage and `docs/RELEASE_CHECKLIST.md` for the current release pass. These guides will be refreshed during release hardening.
