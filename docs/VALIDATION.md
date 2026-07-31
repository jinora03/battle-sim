# Validation — v1.0

## Completed in this environment

### Strict source validation

The full app, packages, tests and validation scripts pass strict TypeScript validation using local declaration stubs because npm dependency installation did not complete within the execution window.

```text
tsc -p tsconfig.validation.json --noEmit
PASS
```

### Executable headless validation

The simulation/content/controller/meta code was compiled and executed outside Pixi and React using the local runtime validation harness.

The v1.0 release validation confirmed:

```json
{"contentVersion":"1.0.0","fighters":8,"arenas":6,"modes":6,"fullFiveSlotKits":8}
```

Featured duel results:

```text
Water Shaper vs Bomber
  tick 1800 · 33 starts · 33 resolves · 8 blasts · checksum 47dce6ba

Pyro Brawler vs Frost Warden
  tick 1640 · winner team 1 · 35 starts · 35 resolves · checksum 2cdd9b3b

Volt Striker vs Mech Bruiser
  tick 850 · winner team 2 · 22 starts · 22 resolves · checksum 7a1872b2

Thorn Colossus vs Void Reaper
  tick 1800 · 20 starts · 20 resolves · checksum f93e9bb0
```

Mixed eight-fighter team validation:

```text
Seed 101010
  checksum de14dc1c
  repeat  de14dc1c
  100 skill activations
  55 hazard events

Seed 101011
  checksum 3c19ed3c
```

The repeated seed matched and the different seed diverged.

### Earlier regression scenarios

Earlier player-control, custom-fighter, arena/hazard, Boss Raid, Survival, progression and large-team scenarios compile and execute under the v1.0 code. Several checksums changed because Pyro and Mech intentionally gained complete five-slot kits; repeatability within the same v1.0 rules remains intact.

## Local validation still required

The npm registry did not finish installing dependencies in this environment, so the following must run on the user's machine:

```bash
npm install
npm run check
npm run dev
```

`npm run check` is the authoritative local confirmation for:

- actual Vitest execution
- actual React/Pixi/Vite type environment
- production Vite bundle
- native Rolldown binding on the local OS

For mobile release work, also validate Capacitor sync, Android Studio/Xcode compilation and physical-device behavior.
