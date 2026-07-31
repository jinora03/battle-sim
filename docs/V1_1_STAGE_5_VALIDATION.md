# v1.1 Stage 5 validation

## Static validation

- Repository lint: passed.
- Strict project-source TypeScript validation: passed using the repository validation configuration and temporary ambient declarations for unavailable third-party packages.

## Headless Stage 5 scenarios

The Stage 5 headless harness verifies:

1. A real ranged weapon produces a calculated damage event against an invulnerable dummy without reducing HP.
2. Status application still occurs when damage is prevented.
3. Turning damage off prevents HP loss independently of team invulnerability.
4. Turning cooldowns off clears cooldown state and allows repeated authoritative activations.
5. Victory suppression lets a target be defeated without ending the training battle.
6. The same seed and command sequence produce the same final checksum.

The generated output is stored in `validation/v1.1-stage5-headless-output.txt`.

## Full local verification

The execution environment could not install the repository dependencies because its configured npm registry returned a package-not-found response for TypeScript 5.9. Run the authoritative dependency-backed checks locally:

```bash
npm install
npm run check
npm run dev
```

Manual browser checks should cover the Ability Lab navigation, all dummy patterns, every overlay toggle, pointer aiming, keyboard/touch controls, pause/resume, slow motion, one-tick stepping, audio unlock and return to Battle Lab.
