# Stage 8.2R1 — App UI Decomposition

This refactor is intentionally behavior-preserving. It does not change battle rules,
content definitions, fighter balance, replay data, renderer behavior, or saved settings.

## Goals

- Reduce the responsibility and size of `apps/game/src/App.tsx`.
- Give battle setup, fighter controls, shared form controls, and the developer workshop
  clear module boundaries.
- Preserve existing public runtime and package APIs.
- Prepare the application layer for later hook extraction without mixing refactoring
  with the Pyro feature work.

## Extracted modules

- `features/battle/BattleSetupDrawer.tsx`
  - battle configuration
  - input settings
  - quality and accessibility settings
- `features/battle/BattleFighterControls.tsx`
  - analog movement pad
  - fighter cards
  - skill buttons and activity presentation metadata
- `features/battle/FighterModuleSelectors.tsx`
  - approved loadout module selection
- `features/battle/battleUtils.ts`
  - battle setup equality
  - result presentation
  - seed generation
  - device and viewport equality checks
- `features/creator/DeveloperFighterWorkshop.tsx`
  - internal fighter authoring UI and recipe preview
- `ui/FormControls.tsx`
  - shared fields, toggles, ranges, metrics, and color formatting

## Boundary rules

- Feature components receive state and actions through typed props.
- They do not create or own the battle runtime.
- Simulation and renderer packages remain untouched.
- The developer workshop remains internal and is not restored to player navigation.
- Seed generation and setup comparison remain deterministic in behavior.

## Follow-up refactor

R1 intentionally leaves runtime state and orchestration in `App.tsx`. The next safe
step is to extract battle launch/runtime lifecycle logic into focused hooks after this
component-only extraction has passed local browser verification.
