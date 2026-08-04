# Stage 8.8B Change Manifest

Version: `1.3.22-stage8.8b`

## Added

- `apps/game/src/features/battle/BattleFighterPreview.tsx`
- `tests/stage8-8b-battle-setup.test.ts`
- `docs/V1_3_STAGE_8_8B_BATTLE_SETUP.md`

## Updated

- `apps/game/src/features/battle/FighterModuleSelectors.tsx`
  - Converted module slots into compact collapsible disclosures.
- `apps/game/src/features/battle/BattleSetupDrawer.tsx`
  - Added both live fighter previews and the configured-battle action.
- `apps/game/src/app/AppWorkspace.tsx`
  - Removed the duplicate desktop start action and connected the drawer action.
- `apps/game/src/app/AppController.tsx`
  - Set the default Gunner four-slot tuned loadout versus Bomber in Iron Pit.
- `apps/game/src/styles.css`
  - Added preview, disclosure and setup-action styling.
- Version markers and forward-compatible historical assertions.

## Simulation impact

None. This phase changes setup defaults and interface presentation only. The selected default modules use existing authored loadout rules.
