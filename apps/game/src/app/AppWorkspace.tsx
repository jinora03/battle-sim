import type { CSSProperties } from 'react';
import { getAbility, getFighter } from '@kinetic/content';
import type { AbilityRejectionReason } from '@kinetic/protocol';
import type { ReleaseView } from '../ReleaseHome';
import { ProfileView } from '../ProfileView';
import { ReleaseHome } from '../ReleaseHome';
import { RosterView } from '../RosterView';
import { TrainingLabView } from '../TrainingLabView';
import { AppNavigation, DrawerScrim, NeonButton } from '../ui/NeonUI';
import { BattleIntroOverlay } from '../BattleIntroOverlay';
import { hexColor } from '../ui/FormControls';
import { BattleObjectiveHeader } from '../features/battle/BattleObjectiveHeader';
import { BattlePerformanceMetrics } from '../features/battle/BattlePerformanceMetrics';
import { BattleSetupDrawer } from '../features/battle/BattleSetupDrawer';
import { LandscapeHint } from '../features/battle/LandscapeHint';
import { DirectionPad, FighterCard, SkillIndicator } from '../features/battle/BattleFighterControls';
import { DeveloperFighterWorkshop } from '../features/creator/DeveloperFighterWorkshop';
import type { AppController } from './AppController';

export function AppWorkspace({ controller }: { controller: AppController }) {
  const { shell, catalog, battle, progression, creator } = controller;
  const {
    view,
    setView,
    settings,
    deviceCapabilities,
    viewportMetrics,
    touchControlsVisible,
    toastNotices,
    dismissToast
  } = shell;
  const { fighters, abilities, aiProfiles, primaryAttacks, arenas, gameModes } = catalog;
  const {
    battleStageRef,
    setupPanelRef,
    seedText,
    setSeedText,
    setup,
    activeSetup,
    setupPanelOpen,
    setSetupPanelOpen,
    landscapeHintDismissed,
    setLandscapeHintDismissed,
    battleDrawerOpen,
    pausedByUser,
    battleLaunchPhase,
    diagnostics,
    ready,
    bootError,
    pausedBySystem,
    attachBattleHost,
    retryBoot,
    playerEntity,
    movePlayer,
    activate,
    previewAbility,
    aimFromPointer,
    aimAndFireFromPointer,
    handleArenaPointerLeave,
    configuredArena,
    configuredMode,
    configuredFighterA,
    configuredFighterB,
    activeMode,
    introSetup,
    introFighterA,
    introFighterB,
    introMode,
    setupDirty,
    skillActivity,
    resultPresentation,
    eliminationProgress,
    replaySameBattle,
    rematchBattle,
    startRandomMatchup,
    returnToSetup,
    updateSetup,
    setController,
    setFighter,
    setFighterModule,
    applyTypedSeed,
    toggleBattlePaused,
    updateAppSetting,
    selectQualityPreset,
    restoreRecommendedSettings,
    toggleFullscreenBattle,
    launchReleaseBattle,
    playAsFighter,
    setRosterOpponent,
    openBattleSetup,
    closeBattleSetup,
    startConfiguredBattle
  } = battle;
  const {
    profile,
    progressNotices,
    changeDifficulty,
    changeProfileName,
    saveCurrentLoadout,
    applyLoadout,
    deleteLoadout,
    unlockAllFighters,
    importProfile,
    resetProfile
  } = progression;
  const {
    customBundles,
    draft,
    setDraft,
    validation,
    creatorMessage,
    setCreatorMessage,
    importText,
    setImportText,
    sourceFighterId,
    setSourceFighterId,
    saveDraft,
    testDraft,
    exportDraft,
    importBundle,
    duplicateFighter,
    deleteDraft,
    syncIdentity,
    createBlankDraft
  } = creator;
  return (
    <main
      className={`app-shell view-${view} viewport-${viewportMetrics.viewportClass} orientation-${viewportMetrics.orientation} display-${viewportMetrics.displayShape} ${viewportMetrics.shortLandscape ? 'short-landscape' : ''} ${settings.fullscreenBattle ? 'battle-focus-mode' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}
      style={{ '--touch-control-opacity': settings.touchControlOpacity } as CSSProperties}
    >
      <section className="hero-panel">
        <div>
          <p className="eyebrow">v1.3 Stage 8.9A · Round-screen safe battle UI</p>
          <h1>Kinetic Battle Engine</h1>
          <p className="subtitle">Battle, Ability Lab and setup surfaces now adapt to round and near-square displays while preserving the same deterministic simulation and rectangular arena.</p>
        </div>
      </section>

      <AppNavigation<ReleaseView>
        value={view}
        onChange={setView}
        items={[
          { id: 'home', label: 'Home', shortLabel: 'Home' },
          { id: 'battle', label: 'Fight', shortLabel: 'Fight' },
          { id: 'training', label: 'Lab', shortLabel: 'Lab' },
          { id: 'roster', label: 'Roster', shortLabel: 'Roster', badge: fighters.length },
          { id: 'creator', label: 'Create Fighter', shortLabel: 'Create' },
          { id: 'profile', label: 'Profile', shortLabel: 'Profile', badge: `Lv ${profile.level}` }
        ]}
      />

      {toastNotices.length > 0 && (
        <div className="progress-toast-stack" aria-live="polite" aria-label="Recent notifications">
          {toastNotices.slice(-3).reverse().map((notice) => (
            <div className={`progress-toast ${notice.kind}`} key={notice.id}>
              <span>{notice.kind === 'achievement' ? '★' : notice.kind === 'fighter' ? '◆' : notice.kind === 'level' ? '↑' : notice.kind === 'challenge' ? '✓' : '•'}</span>
              <div><strong>{notice.title}</strong><small>{notice.description}</small></div>
              <button className="toast-dismiss" onClick={() => dismissToast(notice.id)} aria-label={`Dismiss ${notice.title}`}>×</button>
            </div>
          ))}
        </div>
      )}

      <>
        <div className={view === 'home' ? '' : 'view-hidden'}>
          <ReleaseHome profile={profile} fighters={fighters} arenaCount={arenas.length} modeCount={gameModes.length} onNavigate={setView} onStart={launchReleaseBattle} />
        </div>
        <div className={view === 'roster' ? '' : 'view-hidden'}>
          <RosterView fighters={fighters} profile={profile} onPlayAs={playAsFighter} onSetOpponent={setRosterOpponent} />
        </div>
        <TrainingLabView fighters={fighters} settings={settings} active={view === 'training'} onSettingChange={updateAppSetting} />
        <section className={`${view === 'battle' ? 'workspace' : 'workspace battle-workspace-dormant'} ${battleDrawerOpen ? 'battle-drawer-open' : ''}`}>
          <BattleSetupDrawer
            open={battleDrawerOpen}
            onClose={closeBattleSetup}
            setupPanelRef={setupPanelRef}
            setupPanelOpen={setupPanelOpen}
            onSetupPanelToggle={setSetupPanelOpen}
            setupDirty={setupDirty}
            setup={setup}
            fighters={fighters}
            arenas={arenas}
            gameModes={gameModes}
            profile={profile}
            configuredFighterA={configuredFighterA}
            configuredFighterB={configuredFighterB}
            configuredMode={configuredMode}
            configuredArena={configuredArena}
            playerEntity={playerEntity}
            settings={settings}
            seedText={seedText}
            onSeedTextChange={setSeedText}
            onApplySeed={applyTypedSeed}
            onFighterChange={setFighter}
            onModuleChange={setFighterModule}
            onControllerChange={setController}
            onSetupChange={updateSetup}
            onDifficultyChange={changeDifficulty}
            onQualityPresetChange={selectQualityPreset}
            onSettingChange={updateAppSetting}
            onToggleFullscreen={() => void toggleFullscreenBattle()}
            onRestoreSettings={restoreRecommendedSettings}
            onStartConfiguredBattle={startConfiguredBattle}
          />
          <DrawerScrim open={battleDrawerOpen} onClose={closeBattleSetup} label="Close battle setup" className="battle-drawer-scrim" />

          <div className="arena-column">
            <section className={`battle-stage ${deviceCapabilities.touchFirst ? 'mobile-commandless' : ''}`} ref={battleStageRef}>
              {!deviceCapabilities.touchFirst && (
                <div className="battle-command-bar" aria-label="Battle actions">
                  <div className="battle-command-actions">
                    <NeonButton tone="random" onClick={startRandomMatchup}>New random battle</NeonButton>
                    <NeonButton tone="utility" onClick={replaySameBattle}>Replay same seed</NeonButton>
                    {viewportMetrics.width <= 900 && (
                      <NeonButton tone="ghost" className="setup-jump" onClick={openBattleSetup} aria-controls="battle-setup-drawer" aria-expanded={battleDrawerOpen}>Battle setup</NeonButton>
                    )}
                    <NeonButton
                      tone={pausedByUser ? 'success' : 'pause'}
                      className={`playback-toggle ${pausedByUser ? 'paused' : ''}`}
                      onClick={toggleBattlePaused}
                      disabled={diagnostics.battleEnded || pausedBySystem || battleLaunchPhase !== 'running'}
                      aria-pressed={pausedByUser}
                      title={pausedBySystem ? 'The app is paused while it is in the background' : pausedByUser ? 'Resume the current battle' : 'Pause the current battle'}
                    >
                      {pausedByUser ? '▶ Resume battle' : 'Ⅱ Pause battle'}
                    </NeonButton>
                  </div>
                </div>
              )}

              <BattleObjectiveHeader
                kind={diagnostics.objective.kind}
                modeName={activeMode?.name ?? 'Battle'}
                objectiveLabel={diagnostics.objective.label}
                fighterAName={getFighter(activeSetup.fighterAId).name}
                fighterBName={getFighter(activeSetup.fighterBId).name}
                lastTeamStanding={activeMode?.victory === 'LAST_TEAM_STANDING'}
                teams={eliminationProgress.teams}
                objectiveProgress={diagnostics.objective.progress}
                remainingTicks={diagnostics.objective.remainingTicks}
                battleEnded={diagnostics.battleEnded}
                resultLabel={resultPresentation.compact}
                activeEntityCount={diagnostics.entities.length}
              />

              <div className="arena-wrap" onPointerMove={aimFromPointer} onPointerDown={aimAndFireFromPointer} onPointerLeave={handleArenaPointerLeave}>
                <div className="arena-frame" ref={attachBattleHost} />
                {!ready && !bootError && <div className="arena-loading" role="status"><span className="loading-spinner" /><strong>Preparing battle renderer…</strong><small>Loading arena, content recipes and mobile quality profile.</small></div>}
                {bootError && <div className="arena-loading error" role="alert"><strong>Battle renderer failed</strong><small>{bootError}</small><button onClick={retryBoot}>Retry renderer</button></div>}
                {ready && battleLaunchPhase !== 'running' && (
                  <BattleIntroOverlay
                    phase={battleLaunchPhase}
                    fighterA={introFighterA}
                    fighterB={introFighterB}
                    teamSizeA={introSetup.teamSizeA}
                    teamSizeB={introSetup.teamSizeB}
                    modeName={introMode?.name ?? 'Battle'}
                    startDisabled={!ready || Boolean(bootError)}
                    onStart={startConfiguredBattle}
                  />
                )}
                {diagnostics.renderDiagnostics.contextLost && <div className="system-pause-badge renderer-recovery-badge">Graphics context interrupted · attempting recovery</div>}
                {pausedBySystem && <div className="system-pause-badge">Paused while the app is in the background</div>}
                {pausedByUser && !pausedBySystem && !diagnostics.battleEnded && <div className="system-pause-badge user-pause-badge">Battle paused · press Resume battle to continue</div>}
                {touchControlsVisible && viewportMetrics.orientation === 'portrait' && !diagnostics.battleEnded && !landscapeHintDismissed && (
                  <LandscapeHint onDismiss={() => setLandscapeHintDismissed(true)} />
                )}
                {diagnostics.battleEnded && diagnostics.result && (
                  <div className="match-result-overlay" role="dialog" aria-labelledby="match-result-title" aria-describedby="match-result-description">
                    <div className={`match-result-card ${diagnostics.result.reason}`}>
                      <p className="eyebrow">Battle complete</p>
                      <h2 id="match-result-title">{resultPresentation.title}</h2>
                      <p id="match-result-description">{resultPresentation.description}</p>
                      <div className="match-result-actions">
                        <NeonButton tone="success" onClick={rematchBattle} title="Same matchup and loadout with a fresh seed">Rematch</NeonButton>
                        <NeonButton tone="random" onClick={startRandomMatchup}>New random battle</NeonButton>
                        <NeonButton tone="ghost" fullWidth className="match-result-return" onClick={() => { returnToSetup(); openBattleSetup(); }}>Return to setup</NeonButton>
                      </div>
                    </div>
                  </div>
                )}
              {playerEntity && battleLaunchPhase === 'running' && !diagnostics.battleEnded && touchControlsVisible && (
                <div className="touch-controls">
                  <DirectionPad onDirection={movePlayer} sensitivity={settings.touchSteeringSensitivity} />
                  <div className="touch-skill-row">
                    {playerEntity.abilities.map((ability) => (
                      <SkillIndicator
                        key={`touch-${ability.slot}`}
                        state={ability}
                        entityId={playerEntity.id}
                        tick={diagnostics.tick}
                        recentSkills={diagnostics.recentSkills}
                        compact
                        controllable
                        onPreview={() => previewAbility(ability.slot)}
                        onActivate={() => activate(ability.slot)}
                      />
                    ))}
                  </div>
                </div>
              )}
              </div>
            </section>

            {deviceCapabilities.touchFirst && !battleDrawerOpen && (
              <div className="mobile-battle-dock" aria-label="Quick battle controls">
                <NeonButton tone="ghost" size="small" onClick={openBattleSetup} aria-controls="battle-setup-drawer" aria-expanded={battleDrawerOpen}>Setup</NeonButton>
                <NeonButton tone="random" size="small" onClick={startRandomMatchup}>Random</NeonButton>
                <NeonButton tone="utility" size="small" onClick={replaySameBattle}>Replay</NeonButton>
                <NeonButton
                  tone={pausedByUser ? 'success' : 'pause'}
                  size="small"
                  onClick={toggleBattlePaused}
                  disabled={diagnostics.battleEnded || pausedBySystem || battleLaunchPhase !== 'running'}
                  aria-pressed={pausedByUser}
                >
                  {pausedByUser ? 'Resume' : 'Pause'}
                </NeonButton>
              </div>
            )}

            {diagnostics.recentAbilityRejection && (
              <div className="ability-rejection-strip" role="status" aria-live="polite">
                <strong>{getAbility(diagnostics.recentAbilityRejection.abilityId).name}</strong>
                <span>{abilityRejectionMessage(diagnostics.recentAbilityRejection.reason)}</span>
              </div>
            )}

            <div className={`skill-activity-rail persistent ${skillActivity.totalCasts > 0 ? 'active' : 'idle'}`} aria-live="polite" aria-label={skillActivity.totalCasts > 0 ? `${skillActivity.totalCasts} skills casting` : 'No skills currently casting'}>
              <span className="skill-activity-label">Skill activity</span>
              <div className="skill-activity-items">
                {skillActivity.totalCasts === 0 ? (
                  <span className="skill-activity-idle">Waiting for the next cast · ultimates and grouped activations appear here</span>
                ) : skillActivity.visible.map((activity) => (
                  <div className={`skill-activity-chip ${activity.importance}`} key={`${activity.abilityId}-${activity.importance}`} style={{ '--skill-color': hexColor(activity.color) } as CSSProperties}>
                    <b>{activity.icon}</b>
                    <span><strong>{activity.abilityName}</strong><small>{activity.count > 1 ? `${activity.count} fighters` : activity.fighterNames[0]}</small></span>
                    <i><u style={{ width: `${Math.max(3, activity.progress * 100)}%` }} /></i>
                  </div>
                ))}
                {skillActivity.hiddenCount > 0 && <span className="skill-activity-more">+{skillActivity.hiddenCount} grouped</span>}
              </div>
            </div>

            {(diagnostics.performance.pressure === 'strained' || diagnostics.performance.pressure === 'critical') && !pausedBySystem && (
              <div className={`performance-pressure-strip ${diagnostics.performance.pressure}`} role="status">
                <strong>{diagnostics.performance.pressure === 'critical' ? 'Heavy performance load' : 'Performance load detected'}</strong>
                <span>{diagnostics.performance.bottleneck} bottleneck · presentation density is adapting while gameplay remains deterministic</span>
              </div>
            )}

            {playerEntity && (
              <div className="player-control-strip" aria-label="Player control status">
                <span><small>Player mode</small><strong>{getFighter(playerEntity.fighterId).name}</strong></span>
                <span className="player-control-hint">
                  {touchControlsVisible
                    ? 'Analog pad moves · tap a skill to attack the aimed enemy'
                    : settings.movementMode === 'mouse'
                      ? 'Pointer steering accelerates with distance · left click fires basic · 1–5 or Q/E/R/F activate skills'
                      : 'WASD / arrows move · pointer aims · left click fires basic · 1–5 or Q/E/R/F activate skills'}
                </span>
                <button className="ghost-inline" onClick={() => updateAppSetting('cameraFollow', !settings.cameraFollow)}>
                  Camera follow · {settings.cameraFollow ? 'on' : 'off'}
                </button>
              </div>
            )}

            <div className="team-summary-strip">
              {diagnostics.teams.map((team) => (
                <div className="team-summary" key={team.team}>
                  <strong>Team {team.team}</strong>
                  <span>{team.alive}/{team.total} alive</span>
                  <i><b style={{ width: `${team.maxHp > 0 ? Math.max(0, Math.min(100, team.hp / team.maxHp * 100)) : 0}%` }} /></i>
                </div>
              ))}
            </div>
            <div className="fighter-strip">
              {diagnostics.entities.slice(0, diagnostics.entities.length > 16 ? 12 : diagnostics.entities.length).map((entity) => (
                <FighterCard
                  key={entity.id}
                  entity={entity}
                  tick={diagnostics.tick}
                  stats={diagnostics.stats[entity.id]}
                  recentSkills={diagnostics.recentSkills}
                  onActivate={entity.controller === 'player' ? activate : undefined}
                  onPreview={entity.controller === 'player' ? previewAbility : undefined}
                />
              ))}
              {diagnostics.entities.length > 16 && <div className="roster-overflow">+{diagnostics.entities.length - 12} fighters represented in the arena</div>}
            </div>
          </div>


          <div className="battle-secondary-panels">
            <BattlePerformanceMetrics diagnostics={diagnostics} viewportMetrics={viewportMetrics} fighterCount={fighters.length} />

            <details className="panel-section battle-activity-panel" open>
              <summary className="panel-summary"><span><small>Battle log</small><strong>Arena activity & achievements</strong></span><em>{diagnostics.recentArenaActivity.length}</em></summary>
              <div className="battle-activity-grid">
                <div>
                  <p className="eyebrow">Arena activity</p>
                  {diagnostics.recentArenaActivity.length === 0 ? <p className="empty-feed-note">Enter a zone or break an object to populate this feed.</p> : diagnostics.recentArenaActivity.slice(-6).reverse().map((item, index) => <strong key={`${item.tick}-${index}`}>• {item.label}</strong>)}
                </div>
                <div>
                  <p className="eyebrow">Achievements this battle</p>
                  {diagnostics.achievements.length === 0 ? <span className="small-note">No new achievement yet.</span> : diagnostics.achievements.map((name) => <strong key={name}>★ {name}</strong>)}
                </div>
              </div>
            </details>

            <details className="panel-section developer-notes-panel" open>
              <summary className="panel-summary"><span><small>Developer information</small><strong>Architecture & implementation proof</strong></span></summary>
              <div className="developer-notes-grid">
                <div>
                  {['Built-in fighters use the same modular content pipeline','Six arenas range from compact ricochet pits to mass-war fields','Player, AI, replay and future network control share one command protocol','Unique skill telegraphs, cast motion, resolve FX, cooldown UI and audio','Duel, teams, battle royale, boss raid, survival and mass skirmish modes','Achievements, challenges, unlocks, history and local profile persistence','Developer Fighter Workshop remains an internal authoring tool; players choose only approved fighters and loadouts','Standard, minimal and debug render profiles with adaptive mobile quality','New battles randomize seed while explicit replay preserves exact inputs','Simulation remains headless, fixed-step and independent from PixiJS','Ability Lab reuses the real combat runner with deterministic training-only rules','Stage 7 pools live runtime snapshots and fighter views while preserving immutable diagnostic snapshots','Adaptive quality changes only presentation; simulation ticks, AI, damage and winners remain untouched'].map((item) => <div className="architecture-item" key={item}><span>✓</span>{item}</div>)}
                </div>
                <div className="note-card-inline"><strong>Architecture proof</strong><p>The release layers remain replaceable: content feeds a headless simulation, commands select the controller, semantic events drive visuals/audio/meta systems, and the browser/mobile app only wires those packages together.</p><NeonButton tone="ghost" size="small" className="developer-workshop-button" onClick={() => setView('creator')}>Open developer Fighter Workshop</NeonButton></div>
              </div>
            </details>
          </div>
        </section>
        <div className={view === 'profile' ? '' : 'view-hidden'}>
          <ProfileView
            profile={profile}
            fighters={fighters}
            currentSetup={setup}
            notices={progressNotices}
            onChangeName={changeProfileName}
            onChangeDifficulty={changeDifficulty}
            onSaveLoadout={saveCurrentLoadout}
            onApplyLoadout={applyLoadout}
            onDeleteLoadout={deleteLoadout}
            onUnlockAll={unlockAllFighters}
            onImportProfile={importProfile}
            onResetProfile={resetProfile}
          />
        </div>
        <DeveloperFighterWorkshop
          active={view === 'creator'}
          fighters={fighters}
          customBundles={customBundles}
          draft={draft}
          setDraft={setDraft}
          validation={validation}
          creatorMessage={creatorMessage}
          setCreatorMessage={setCreatorMessage}
          importText={importText}
          setImportText={setImportText}
          sourceFighterId={sourceFighterId}
          setSourceFighterId={setSourceFighterId}
          primaryAttacks={primaryAttacks}
          abilities={abilities}
          aiProfiles={aiProfiles}
          onDuplicate={duplicateFighter}
          onCreateBlank={createBlankDraft}
          onSave={saveDraft}
          onTest={testDraft}
          onExport={exportDraft}
          onDelete={deleteDraft}
          onImport={importBundle}
          onSyncIdentity={syncIdentity}
        />
      </>

    </main>
  );
}

function abilityRejectionMessage(reason: AbilityRejectionReason): string {
  switch (reason) {
    case 'busy': return 'Another attack or skill is already in progress.';
    case 'cooldown': return 'This skill is still cooling down.';
    case 'target-required': return 'Aim at an enemy before activating this skill.';
    case 'invalid-target': return 'The selected target is no longer valid.';
    case 'out-of-range': return 'Move closer to bring the target into range.';
    case 'line-of-sight': return 'An arena obstacle is blocking this skill.';
    case 'aim-tolerance': return 'Aim closer to the selected target.';
    case 'minimum-targets': return 'There are not enough enemies in the effect area.';
    case 'requirements-not-met': return 'Build the required status or resource first.';
  }
}
