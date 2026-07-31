# v1.1 Stage 4 — Validation Report

## Automated coverage

`tests/stage4-player-camera.test.ts` validates:

- exact centering for representative small, medium and large arenas
- clamped player-follow camera bounds
- exact return to centered fit when follow is disabled
- automatic touch-control visibility on touch-first devices only
- explicit always-show and always-hide touch-control overrides

`tests/scale-and-teams.test.ts` was also corrected to avoid creating redundant full snapshots inside the 20v20 loop. The determinism case keeps a per-test `20_000 ms` limit because it runs the complete mass battle twice.

## Completed static checks

- repository lint
- strict TypeScript source validation with temporary external dependency declarations

## Local authoritative check

```powershell
npm install
npm run check
npm run dev
```

Manual browser verification should cover resizing the setup column, fullscreen transitions, one player on each arena size, mouse aiming, keyboard input, a touch-first device/emulator and the three touch-control visibility modes.
