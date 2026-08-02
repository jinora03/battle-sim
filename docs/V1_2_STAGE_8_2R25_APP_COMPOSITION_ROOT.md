# Stage 8.2R2.5 — App Composition Root

## Goal

Make `apps/game/src/App.tsx` the application composition root instead of the owner of battle, profile, creator, settings and workspace implementation details.

## New boundary

- `App.tsx` calls the application controller hook and renders the workspace.
- `app/AppController.tsx` exports the application controller hook that owns state, effects and cross-feature actions.
- `app/AppWorkspace.tsx` owns top-level page composition and the existing UI markup.
- Existing focused battle UI components and runtime/input hooks remain unchanged.

## Behavior preserved

This refactor does not change:

- battle setup or launch flow;
- manual Start Battle and intros;
- renderer startup, retry and tab switching;
- player input;
- settings persistence;
- profile progression;
- fighter creator behavior;
- replay export;
- simulation, AI, balance, rendering or serialization.

## Follow-up

`AppController.tsx` is now an explicit orchestration boundary. It can be decomposed safely in later refactors into focused environment, progression, battle-setup and creator hooks without touching the application entry point or workspace markup.
