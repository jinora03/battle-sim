# v1.1 Stage 7.3 Validation

Validated in the artifact environment:

- repository lint
- strict TypeScript validation for core packages
- strict TypeScript validation for the Pixi renderer using dependency declarations
- strict TypeScript validation for BattleRuntime and React application sources using dependency declarations
- strict TypeScript validation for the complete Vitest test source set
- executable deterministic Stage 7.3 headless scenario

Executable validation result:

```text
Content version: 1.1.3-stage7.3
Registered fighters: 10
Gunner bullet damage: 3.6
Bomber projectile speed: 15.5
Starburst missiles: 16
Deterministic checksum: 42475ef2
Player ranges: 760, 720, 240, 760, 850
```

The executable scenario verifies current content registration, player range resolution, out-of-range AI rejection, Rocket Vanguard's sixteen targeted micro-missiles, deterministic replay outcome and explosion-driven wall impact.

The final dependency-backed authority remains:

```bash
npm install
npm run check
npm run dev
```

The artifact environment could not install the requested TypeScript 5.9 package because its internal npm mirror returned 404, so the actual Vite/Vitest dependency build must be completed locally.
