import type { ChangeEvent, Ref, SyntheticEvent } from 'react';
import {
  getFighter,
  isCustomFighter,
  type ArenaDefinition,
  type FighterDefinition,
  type GameModeDefinition
} from '@kinetic/content';
import type { PlayerProfile } from '@kinetic/meta';
import type { ControllerKind, EntitySnapshot, ModuleSlot } from '@kinetic/protocol';
import {
  qualityPresets,
  type AimAssistLevel,
  type AppSettings,
  type MovementMode,
  type QualityPresetId,
  type TouchControlMode
} from '@kinetic/platform';
import type { BattleSetup } from '../../runtime/BattleRuntime';
import { DrawerHeader, NeonButton } from '../../ui/NeonUI';
import { CreatorField, RangeField, Toggle } from '../../ui/FormControls';
import { formatModeCapacity } from '../../ui/presentation';
import { FighterModuleSelectors } from './FighterModuleSelectors';
import { generateRandomSeed } from './battleUtils';

export interface BattleSetupDrawerProps {
  open: boolean;
  onClose(): void;
  setupPanelRef: Ref<HTMLDetailsElement>;
  setupPanelOpen: boolean;
  onSetupPanelToggle(open: boolean): void;
  setupDirty: boolean;
  setup: BattleSetup;
  fighters: readonly FighterDefinition[];
  arenas: readonly ArenaDefinition[];
  gameModes: readonly GameModeDefinition[];
  profile: PlayerProfile;
  configuredFighterA: FighterDefinition;
  configuredFighterB: FighterDefinition;
  configuredMode: GameModeDefinition | undefined;
  configuredArena: ArenaDefinition | undefined;
  playerEntity: EntitySnapshot | undefined;
  settings: AppSettings;
  seedText: string;
  onSeedTextChange(value: string): void;
  onApplySeed(): void;
  onFighterChange(side: 'A' | 'B', fighterId: string): void;
  onModuleChange(side: 'A' | 'B', slot: ModuleSlot, moduleId: string): void;
  onControllerChange(side: 'A' | 'B', controller: ControllerKind): void;
  onSetupChange(patch: Partial<BattleSetup>): void;
  onDifficultyChange(difficulty: PlayerProfile['difficulty']): void;
  onQualityPresetChange(preset: QualityPresetId): void;
  onSettingChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  onToggleFullscreen(): void;
  onRestoreSettings(): void;
}

export function BattleSetupDrawer({
  open,
  onClose,
  setupPanelRef,
  setupPanelOpen,
  onSetupPanelToggle,
  setupDirty,
  setup,
  fighters,
  arenas,
  gameModes,
  profile,
  configuredFighterA,
  configuredFighterB,
  configuredMode,
  configuredArena,
  playerEntity,
  settings,
  seedText,
  onSeedTextChange,
  onApplySeed,
  onFighterChange,
  onModuleChange,
  onControllerChange,
  onSetupChange,
  onDifficultyChange,
  onQualityPresetChange,
  onSettingChange,
  onToggleFullscreen,
  onRestoreSettings
}: BattleSetupDrawerProps) {
  return (
    <aside className={`control-panel ui-mobile-drawer ${open ? 'open' : ''}`} id="battle-setup-drawer" aria-label="Battle configuration and settings">
      <DrawerHeader eyebrow="Battle Lab" title="Setup & settings" onClose={onClose} />
      <details
        ref={setupPanelRef}
        className="panel-section collapsible-panel battle-setup-panel"
        open={setupPanelOpen}
        onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => onSetupPanelToggle(event.currentTarget.open)}
      >
        <summary className="panel-summary">
          <span><small>Configure</small><strong>Battle setup</strong></span>
          <em>{setupDirty ? 'Changes ready' : formatModeCapacity(configuredMode)}</em>
        </summary>
        <div className="panel-content">
          <label className="field-label" htmlFor="fighter-a">Team 1 fighter</label>
          <select id="fighter-a" value={setup.fighterAId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFighterChange('A', event.target.value)}>
            {fighters.map((fighter) => {
              const locked = !isCustomFighter(fighter.id) && !profile.unlockedFighterIds.includes(fighter.id);
              return <option value={fighter.id} key={fighter.id} disabled={locked}>{fighter.name}{isCustomFighter(fighter.id) ? ' · custom' : locked ? ' · locked' : ''}</option>;
            })}
          </select>
          <FighterModuleSelectors fighter={configuredFighterA} selectedModuleIds={setup.moduleIdsA} side="A" onChange={onModuleChange} />
          <label className="field-label stacked-label" htmlFor="controller-a">Team 1 controller</label>
          <select id="controller-a" value={setup.controllerA} onChange={(event: ChangeEvent<HTMLSelectElement>) => onControllerChange('A', event.target.value as ControllerKind)}>
            <option value="player">Player</option>
            <option value="ai">AI</option>
          </select>

          <label className="field-label stacked-label" htmlFor="fighter-b">Team 2 fighter</label>
          <select id="fighter-b" value={setup.fighterBId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFighterChange('B', event.target.value)}>
            {fighters.map((fighter) => {
              const locked = !isCustomFighter(fighter.id) && !profile.unlockedFighterIds.includes(fighter.id);
              return <option value={fighter.id} key={fighter.id} disabled={locked}>{fighter.name}{isCustomFighter(fighter.id) ? ' · custom' : locked ? ' · locked' : ''}</option>;
            })}
          </select>
          <FighterModuleSelectors fighter={configuredFighterB} selectedModuleIds={setup.moduleIdsB} side="B" onChange={onModuleChange} />
          <label className="field-label stacked-label" htmlFor="controller-b">Team 2 controller</label>
          <select id="controller-b" value={setup.controllerB} onChange={(event: ChangeEvent<HTMLSelectElement>) => onControllerChange('B', event.target.value as ControllerKind)}>
            <option value="ai">AI</option>
            <option value="player">Player</option>
          </select>

          <label className="field-label stacked-label" htmlFor="mode">Game mode</label>
          <select id="mode" value={setup.modeId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSetupChange({ modeId: event.target.value })}>
            {gameModes.map((mode) => <option value={mode.id} key={mode.id}>{mode.name} · {formatModeCapacity(mode)}</option>)}
          </select>
          <label className="field-label stacked-label" htmlFor="arena">Arena</label>
          <select id="arena" value={setup.arenaId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSetupChange({ arenaId: event.target.value })}>
            {arenas.map((arena) => <option value={arena.id} key={arena.id}>{arena.name} · {arena.size}{arena.allowedModes.includes(setup.modeId) ? '' : ' · incompatible'}</option>)}
          </select>
          {setup.modeId !== 'duel' && (
            <div className="team-size-grid">
              <CreatorField label={setup.modeId === 'boss-raid' ? 'Raiders' : setup.modeId === 'survival' ? 'Survivors' : 'Fighter A count'}>
                <input type="number" min={1} max={50} value={setup.teamSizeA} onChange={(event: ChangeEvent<HTMLInputElement>) => onSetupChange({ teamSizeA: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} />
              </CreatorField>
              {setup.modeId !== 'boss-raid' && (
                <CreatorField label={setup.modeId === 'survival' ? 'Enemy count' : 'Fighter B count'}>
                  <input type="number" min={1} max={50} value={setup.teamSizeB} onChange={(event: ChangeEvent<HTMLInputElement>) => onSetupChange({ teamSizeB: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} />
                </CreatorField>
              )}
            </div>
          )}
          <div className="compatibility-note">
            <strong>{configuredMode?.name} · {formatModeCapacity(configuredMode)}</strong>
            <span>{configuredMode?.description}</span>
            <strong>{configuredArena?.name}</strong>
            <span>{configuredArena?.width} × {configuredArena?.height} · recommended {configuredArena?.recommendedUnits.min}–{configuredArena?.recommendedUnits.max} units</span>
            <span>{configuredArena?.obstacles.length ?? 0} obstacles · {configuredArena?.zones.length ?? 0} environmental zones</span>
          </div>
          <label className="field-label stacked-label" htmlFor="difficulty">Difficulty</label>
          <select id="difficulty" value={profile.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => onDifficultyChange(event.target.value as PlayerProfile['difficulty'])}>
            <option value="relaxed">Relaxed</option>
            <option value="standard">Standard</option>
            <option value="intense">Intense</option>
          </select>
          <div className="battle-rule-grid">
            <label className="field-label" htmlFor="team-collision">Ally collision</label>
            <select id="team-collision" value={setup.teamCollision} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSetupChange({ teamCollision: event.target.value as BattleSetup['teamCollision'] })}>
              <option value="full">Full</option>
              <option value="soft">Soft crowd collision</option>
              <option value="ghost">Ghost through allies</option>
            </select>
            <Toggle label="Friendly fire" checked={setup.friendlyFire} onChange={(value) => onSetupChange({ friendlyFire: value })} />
          </div>

          <details className="advanced-seed-panel">
            <summary>Advanced seed / debugging</summary>
            <label className="field-label seed-label" htmlFor="seed">Current seed</label>
            <div className="seed-row">
              <input id="seed" value={seedText} onChange={(event: ChangeEvent<HTMLInputElement>) => onSeedTextChange(event.target.value.replace(/\D/g, ''))} />
              <div className="seed-actions">
                <NeonButton tone="utility" size="small" onClick={onApplySeed}>Apply</NeonButton>
                <NeonButton tone="random" size="small" onClick={() => onSeedTextChange(String(generateRandomSeed()))}>Random unique</NeonButton>
              </div>
            </div>
            <p className="small-note">New battles already use a fresh cryptographic seed. Use Apply only when reproducing a battle exactly.</p>
          </details>
        </div>
      </details>

      <details className="panel-section collapsible-panel controls-card" open>
        <summary className="panel-summary"><span><small>Input</small><strong>Player controls</strong></span></summary>
        <div className="panel-content">
          <p className="eyebrow">Active controller</p>
          <h2>{playerEntity ? getFighter(playerEntity.fighterId).name : 'No player fighter'}</h2>
          <div className="control-help">{settings.movementMode === 'mouse' ? <><kbd>Mouse</kbd><span>move + aim</span><kbd>Left click</kbd><span>basic</span><kbd>Q E R F</kbd><span>skills</span><kbd>1–5</kbd><span>all slots</span></> : <><kbd>WASD</kbd><span>move</span><kbd>Mouse</kbd><span>aim</span><kbd>Q E R F</kbd><span>skills</span><kbd>1–5</kbd><span>all slots</span></>}</div>
          <label className="field-label stacked-label" htmlFor="movement-mode">Movement mode</label>
          <select id="movement-mode" value={settings.movementMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('movementMode', event.target.value as MovementMode)}>
            <option value="mouse">Mouse move + aim</option>
            <option value="wasd">WASD / arrows move</option>
          </select>
          <RangeField
            label={`Control opacity · ${Math.round(settings.touchControlOpacity * 100)}%`}
            value={settings.touchControlOpacity}
            min={0.3}
            max={1}
            step={0.05}
            onChange={(value) => onSettingChange('touchControlOpacity', value)}
          />
          <label className="field-label stacked-label" htmlFor="aim-assist">Aim assist</label>
          <select id="aim-assist" value={settings.aimAssist} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('aimAssist', event.target.value as AimAssistLevel)}>
            <option value="off">Off</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
          <p className="small-note">Aim assist pulls your aim toward the nearest enemy in your aiming direction. Stronger levels widen the cone and pull harder. Applies to player fighters only.</p>
          <p className="small-note">Custom fighters use the same controller, cooldown, command and replay systems as built-in fighters.</p>
        </div>
      </details>

      <details className="panel-section collapsible-panel release-settings" open>
        <summary className="panel-summary"><span><small>Display</small><strong>Quality & accessibility</strong></span></summary>
        <div className="panel-content">
          <label className="field-label" htmlFor="quality-preset">Quality preset</label>
          <select id="quality-preset" value={settings.qualityPreset} onChange={(event: ChangeEvent<HTMLSelectElement>) => onQualityPresetChange(event.target.value as QualityPresetId)}>
            <option value="auto">Auto · recommended for this device</option>
            <option value="battery">{qualityPresets.battery.label}</option>
            <option value="balanced">{qualityPresets.balanced.label}</option>
            <option value="high">{qualityPresets.high.label}</option>
            <option value="custom">Custom</option>
          </select>
          <p className="small-note">Auto resolves from device memory, CPU threads, data-saver and reduced-motion preferences.</p>
          <label className="field-label stacked-label" htmlFor="render-profile">Visual style</label>
          <select id="render-profile" value={settings.renderProfile} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('renderProfile', event.target.value as AppSettings['renderProfile'])}>
            <option value="standard">Standard characters</option>
            <option value="minimal">Minimal shapes</option>
            <option value="debug">Debug renderer</option>
          </select>
          <label className="field-label stacked-label" htmlFor="target-fps">Render target</label>
          <select id="target-fps" value={settings.targetRenderFps} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('targetRenderFps', Number(event.target.value) === 30 ? 30 : 60)}>
            <option value={60}>60 FPS</option>
            <option value={30}>30 FPS · battery saver</option>
          </select>
          <RangeField label={`Internal render scale · ${Math.round(settings.renderScale * 100)}%`} value={settings.renderScale} min={0.5} max={1} step={0.05} onChange={(value) => onSettingChange('renderScale', value)} />
          <RangeField label={`Device pixel ratio cap · ${settings.maxDevicePixelRatio.toFixed(2)}×`} value={settings.maxDevicePixelRatio} min={0.75} max={3} step={0.25} onChange={(value) => onSettingChange('maxDevicePixelRatio', value)} />
          <RangeField label={`Particle density · ${Math.round(settings.particleScale * 100)}%`} value={settings.particleScale} min={0} max={1.5} step={0.05} onChange={(value) => onSettingChange('particleScale', value)} />
          <RangeField label={`Audio volume · ${Math.round(settings.masterVolume * 100)}%`} value={settings.masterVolume} min={0} max={1} step={0.05} onChange={(value) => onSettingChange('masterVolume', value)} />
          <Toggle label="Adaptive quality" checked={settings.adaptiveQuality} onChange={(value) => onSettingChange('adaptiveQuality', value)} />
          <Toggle label="Effects + telegraphs" checked={settings.effects} onChange={(value) => onSettingChange('effects', value)} />
          <Toggle label="Show mounted attachments" checked={settings.showMountedAttachments} onChange={(value) => onSettingChange('showMountedAttachments', value)} />
          <Toggle label="Show fighter HP rings" checked={settings.showFighterHealthRings} onChange={(value) => onSettingChange('showFighterHealthRings', value)} />
          <Toggle label="Show damage numbers" checked={settings.showDamageNumbers} onChange={(value) => onSettingChange('showDamageNumbers', value)} />
          <Toggle label="Show battle intros" checked={settings.showBattleIntros} onChange={(value) => onSettingChange('showBattleIntros', value)} />
          <Toggle label="Neon arena background" checked={settings.arenaBackground} onChange={(value) => onSettingChange('arenaBackground', value)} />
          <Toggle label="Trails" checked={settings.trails} onChange={(value) => onSettingChange('trails', value)} />
          <Toggle label="Camera shake" checked={settings.cameraShake} onChange={(value) => onSettingChange('cameraShake', value)} />
          <Toggle label="Follow player" checked={settings.cameraFollow} onChange={(value) => onSettingChange('cameraFollow', value)} />
          <label className="field-label stacked-label" htmlFor="touch-controls-mode">Touch controls</label>
          <select id="touch-controls-mode" value={settings.touchControls} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('touchControls', event.target.value as TouchControlMode)}>
            <option value="auto">Auto · touch-first devices</option>
            <option value="always">Always show</option>
            <option value="never">Always hide</option>
          </select>
          <Toggle label="Impact freeze" checked={settings.impactFreeze} onChange={(value) => onSettingChange('impactFreeze', value)} />
          <Toggle label="Screen flashes" checked={settings.screenFlash} onChange={(value) => onSettingChange('screenFlash', value)} />
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => onSettingChange('reducedMotion', value)} />
          <Toggle label="High contrast UI" checked={settings.highContrast} onChange={(value) => onSettingChange('highContrast', value)} />
          <Toggle label="Large touch controls" checked={settings.largeTouchControls} onChange={(value) => onSettingChange('largeTouchControls', value)} />
          <Toggle label="Developer metrics panel" checked={settings.showPerformanceHud} onChange={(value) => onSettingChange('showPerformanceHud', value)} />
          <Toggle label="Audio" checked={settings.audio} onChange={(value) => onSettingChange('audio', value)} />
          <div className="settings-action-row">
            <NeonButton tone="utility" fullWidth onClick={onToggleFullscreen}>Fullscreen arena</NeonButton>
            <button className="text-button settings-reset-button" onClick={onRestoreSettings}>Reset recommended</button>
          </div>
        </div>
      </details>
    </aside>
  );
}
