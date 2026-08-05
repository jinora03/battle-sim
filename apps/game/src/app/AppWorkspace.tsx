import type { CSSProperties, SyntheticEvent } from 'react';
import { getAbility, getFighter } from '@kinetic/content';
import type { AbilityRejectionReason } from '@kinetic/protocol';
import type { ReleaseView } from '../ReleaseHome';
import { ProfileView } from '../ProfileView';
import { ReleaseHome } from '../ReleaseHome';
import { RosterView } from '../RosterView';
import { TrainingLabView } from '../TrainingLabView';
import { AppNavigation, DrawerScrim, NeonButton } from '../ui/NeonUI';
import { BattleIntroOverlay } from '../BattleIntroOverlay';
import { DisclosureGroup, Metric, hexColor } from '../ui/FormControls';
import { BattleSetupDrawer } from '../features/battle/BattleSetupDrawer';
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
    dismissToast,
    setPerformanceHudVisibility,
    appRenderCountRef
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
    perfPanelOpen,
    setPerfPanelOpen,
    landscapeHintDismissed,
    setLandscapeHintDismissed,
    battleDrawerOpen,
    setBattleDrawerOpen,
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
    activeArena,
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
    enableAudio,
    exportReplay,
    updateAppSetting,
    selectQualityPreset,
    restoreRecommendedSettings,
    toggleFullscreenBattle,
    launchReleaseBattle,
    playAsFighter,
    setRosterOpponent,
    openBattleSetup,
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
      className={`app-shell view-${view} viewport-${viewportMetrics.viewportClass} orientation-${viewportMetrics.orientation} ${viewportMetrics.shortLandscape ? 'short-landscape' : ''} ${settings.fullscreenBattle ? 'battle-focus-mode' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}
      style={{ '--touch-control-opacity': settings.touchControlOpacity } as CSSProperties}
    >
      <section className="hero-panel">
        <div>
          <p className="eyebrow">v1.2 Stage 8.0 · Fighter identity and controlled loadouts</p>
          <h1>Kinetic Battle Engine</h1>
          <p className="subtitle">Developer-authored fighters now support character-specific passives, setup-and-payoff skill combos, approved modules and visible attachments without branching the simulation per fighter.</p>
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
            onClose={() => setBattleDrawerOpen(false)}
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
          <DrawerScrim open={battleDrawerOpen} onClose={() => setBattleDrawerOpen(false)} label="Close battle setup" className="battle-drawer-scrim" />

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

              <div className={`battle-objective-bar ${diagnostics.objective.kind}`}>
                <span className="objective-summary"><small>{activeMode?.name} · {diagnostics.objective.label}</small><strong>{getFighter(activeSetup.fighterAId).name} vs {getFighter(activeSetup.fighterBId).name}</strong></span>
                {activeMode?.victory === 'LAST_TEAM_STANDING' ? (
                  <span className="objective-progress elimination-progress" aria-label="Team health and fighters remaining">
                    {eliminationProgress.teams.map((team) => (
                      <span className="team-progress-lane" key={team.team} title={`Team ${team.team}: ${Math.round(team.hpRatio * 100)}% health, ${team.alive} of ${team.total} fighters alive`}>
                        <span className="team-progress-heading"><b>Team {team.team}</b><small>{team.alive}/{team.total} alive</small></span>
                        <span className="team-progress-track"><span className="team-progress-fill" style={{ width: `${team.hp > 0 ? Math.max(2, team.hpRatio * 100) : 0}%` }} /></span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="objective-progress"><i style={{ width: `${Math.max(2, diagnostics.objective.progress * 100)}%` }} /></span>
                )}
                <span className="objective-meta">
                  {diagnostics.objective.remainingTicks !== null && <b>{Math.ceil(diagnostics.objective.remainingTicks / 60)}s</b>}
                  {(diagnostics.battleEnded || activeMode?.victory !== 'LAST_TEAM_STANDING') && (
                    <em>{diagnostics.battleEnded ? resultPresentation.compact : `${diagnostics.entities.length} active`}</em>
                  )}
                </span>
              </div>

              <div className="arena-wrap" onPointerMove={aimFromPointer} onPointerDown={aimAndFireFromPointer} onPointerLeave={handleArenaPointerLeave}>
                <div className="arena-frame" ref={attachBattleHost} />
                {!ready && !bootError && <div className="arena-loading" role="status"><span className="loading-spinner" /><strong>Preparing battle renderer…</strong><small>Loading arena, content recipes and mobile quality profile.</small></div>}
                {bootError && <div className="arena-loading error" role="alert"><strong>Battle renderer failed</strong><small>{bootError}</small><button onClick={retryBoot}>Retry renderer</button></div>}
                {ready && battleLaunchPhase !== 'running' && (
                  <BattleIntroOverlay
                    phase={battleLaunchPhase}
                    fighterA={introFighterA}
                    fighterB={introFighterB}
                    moduleIdsA={introSetup.moduleIdsA}
                    moduleIdsB={introSetup.moduleIdsB}
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
                  <div className="landscape-hint-badge" role="note">
                    <span>Rotate to landscape for a wider battle view</span>
                    <button type="button" onClick={() => setLandscapeHintDismissed(true)} aria-label="Dismiss landscape suggestion">×</button>
                  </div>
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
                  <DirectionPad onDirection={movePlayer} />
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

            {deviceCapabilities.touchFirst && (
              <div className="mobile-battle-dock" aria-label="Quick battle controls">
                <NeonButton tone="random" size="small" onClick={startRandomMatchup}>Random</NeonButton>
                <NeonButton tone={pausedByUser ? 'success' : 'pause'} size="small" onClick={toggleBattlePaused} disabled={diagnostics.battleEnded || pausedBySystem || battleLaunchPhase !== 'running'}>{pausedByUser ? 'Resume' : 'Pause'}</NeonButton>
                <NeonButton tone="ghost" size="small" onClick={openBattleSetup} aria-controls="battle-setup-drawer" aria-expanded={battleDrawerOpen}>Setup</NeonButton>
                <NeonButton tone="utility" size="small" onClick={() => void toggleFullscreenBattle()}>Fullscreen</NeonButton>
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
            <details
              className="panel-section battle-debug-panel"
              open={perfPanelOpen}
              onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => {
                const open = event.currentTarget.open;
                setPerfPanelOpen(open);
                if (open !== settings.showPerformanceHud) {
                  setPerformanceHudVisibility(open);
                }
              }}
            >
              <summary className="panel-summary"><span><small>Developer</small><strong>Performance & simulation metrics</strong></span></summary>
              <div className="debug-panel-fps-tile">
                <small>Render FPS</small>
                <strong>{diagnostics.performance.renderFps.toFixed(0)}</strong>
                <span>live presentation frame rate</span>
              </div>
              <div className="metric-group-list">
                <DisclosureGroup eyebrow="Rendering" title="Frame pacing & canvas" summary={`${diagnostics.performance.renderFps.toFixed(0)} FPS`} defaultOpen className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="Render FPS" value={diagnostics.performance.renderFps.toFixed(0)} />
                    <Metric label="Render ms" value={diagnostics.performance.renderMs.toFixed(2)} />
                    <Metric label="Render p95" value={`${diagnostics.performance.renderP95Ms.toFixed(2)} ms`} />
                    <Metric label="Frame p95" value={`${diagnostics.performance.frameP95Ms.toFixed(2)} ms`} />
                    <Metric label="Pressure" value={`${diagnostics.performance.pressure} · ${diagnostics.performance.bottleneck}`} />
                    <Metric label="Adaptive scale" value={`${Math.round(diagnostics.performance.qualityScale * 100)}%`} />
                    <Metric label="Effective resolution" value={`${diagnostics.renderDiagnostics.resolution.toFixed(2)}×`} />
                    <Metric label="Device DPR" value={`${diagnostics.renderDiagnostics.devicePixelRatio.toFixed(2)}×`} />
                    <Metric label="Render scale" value={`${Math.round(diagnostics.renderDiagnostics.renderScale * 100)}%`} />
                    <Metric label="Canvas CSS size" value={`${diagnostics.renderDiagnostics.cssWidth}×${diagnostics.renderDiagnostics.cssHeight}`} />
                    <Metric label="Canvas pixel size" value={`${diagnostics.renderDiagnostics.pixelWidth}×${diagnostics.renderDiagnostics.pixelHeight}`} />
                    <Metric label="Viewport" value={`${viewportMetrics.width}×${viewportMetrics.height} · ${viewportMetrics.orientation}`} />
                    <Metric label="Resize passes" value={diagnostics.renderDiagnostics.resizeCount.toLocaleString()} />
                    <Metric label="Graphics context" value={diagnostics.renderDiagnostics.contextLost ? 'lost' : 'ready'} />
                    <Metric label="React renders" value={appRenderCountRef.current.toLocaleString()} />
                    <Metric label="Render target" value={`${diagnostics.renderDiagnostics.targetRenderFps} FPS`} />
                    <Metric label="Visual LOD" value={diagnostics.renderDiagnostics.lod} />
                    <Metric label="Mass render tier" value={diagnostics.renderDiagnostics.renderTier} />
                  </div>
                </DisclosureGroup>

                <DisclosureGroup eyebrow="Simulation" title="Runtime & tick health" summary={`${diagnostics.performance.simulationMs.toFixed(2)} ms`} defaultOpen className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="Tick" value={diagnostics.tick.toLocaleString()} />
                    <Metric label="Registered fighters" value={fighters.length.toString()} />
                    <Metric label="Living fighters" value={diagnostics.entities.length.toString()} />
                    <Metric label="Simulation total" value={`${diagnostics.performance.simulationMs.toFixed(2)} ms`} />
                    <Metric label="Simulation core" value={`${diagnostics.performance.simulationCoreMs.toFixed(2)} ms`} />
                    <Metric label="Runtime snapshot reuse" value={`${diagnostics.performance.snapshotMs.toFixed(2)} ms`} />
                    <Metric label="Post simulation" value={`${diagnostics.performance.postSimulationMs.toFixed(2)} ms`} />
                    <Metric label="Diagnostics/UI prep" value={`${diagnostics.performance.diagnosticsMs.toFixed(2)} ms`} />
                    <Metric label="Simulation p95" value={`${diagnostics.performance.simulationP95Ms.toFixed(2)} ms`} />
                    <Metric label="Simulation steps" value={diagnostics.performance.stepsLastFrame.toString()} />
                    <Metric label="Dropped sim ticks" value={diagnostics.performance.droppedSimulationTicks.toLocaleString()} />
                  </div>
                </DisclosureGroup>

                <DisclosureGroup eyebrow="Controllers" title="AI & player input" summary={`${diagnostics.aiWorkload.aiEntities} AI`} className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="AI" value={`${diagnostics.performance.aiMs.toFixed(2)} ms`} />
                    <Metric label="Player input" value={`${diagnostics.performance.playerInputMs.toFixed(2)} ms`} />
                    <Metric label="AI fighters" value={diagnostics.aiWorkload.aiEntities.toLocaleString()} />
                    <Metric label="AI attack checks/tick" value={diagnostics.aiWorkload.attackEvaluations.toLocaleString()} />
                    <Metric label="AI steering refreshes/tick" value={diagnostics.aiWorkload.reactionRefreshes.toLocaleString()} />
                    <Metric label="AI aim refreshes/tick" value={diagnostics.aiWorkload.aimRefreshes.toLocaleString()} />
                    <Metric label="AI attack cadence" value={`every ${diagnostics.aiWorkload.attackDecisionInterval}t`} />
                    <Metric label="AI steering floor" value={`${diagnostics.aiWorkload.reactionIntervalFloor}t`} />
                    <Metric label="AI cluster refresh" value={`every ${diagnostics.aiWorkload.clusterRefreshInterval}t`} />
                    <Metric label="AI hostile queries/tick" value={diagnostics.aiWorkload.hostileQueries.toLocaleString()} />
                    <Metric label="AI area candidates/tick" value={diagnostics.aiWorkload.areaCandidateChecks.toLocaleString()} />
                  </div>
                  <div className="ai-decision-debug">
                    <h3>AI action selection</h3>
                    {diagnostics.aiDecisions.length === 0 ? <p className="ai-decision-empty-state">No AI decision sampled yet.</p> : diagnostics.aiDecisions.slice(0, 8).map((decision) => (
                      <div className="ai-decision-row" key={decision.entityId}>
                        <b>#{decision.entityId}</b>
                        <span>{decision.kind === 'ability' ? `${decision.slot?.toUpperCase()} · ${decision.abilityId}` : decision.kind}</span>
                        <small>{decision.reason}</small>
                      </div>
                    ))}
                  </div>
                </DisclosureGroup>

                <DisclosureGroup eyebrow="Physics" title="Collisions & broadphase" summary={`${diagnostics.simulationMetrics.contactsResolved} contacts`} className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="Candidate pairs" value={diagnostics.simulationMetrics.candidatePairs.toLocaleString()} />
                    <Metric label="Broadphase cells" value={diagnostics.simulationMetrics.occupiedBroadphaseCells.toLocaleString()} />
                    <Metric label="Largest cell" value={diagnostics.simulationMetrics.maxBroadphaseBucket.toLocaleString()} />
                    <Metric label="Projectile checks" value={diagnostics.simulationMetrics.projectileEntityChecks.toLocaleString()} />
                    <Metric label="Obstacle checks" value={diagnostics.simulationMetrics.projectileObstacleChecks.toLocaleString()} />
                    <Metric label="Numeric recoveries" value={diagnostics.simulationMetrics.invalidNumericStates.toLocaleString()} />
                    <Metric label="Contacts" value={diagnostics.simulationMetrics.contactsResolved.toLocaleString()} />
                    <Metric label="Arena objects" value={diagnostics.obstacles.filter((item) => item.alive).length.toString()} />
                  </div>
                </DisclosureGroup>

                <DisclosureGroup eyebrow="Presentation" title="VFX, views & audio" summary={`${diagnostics.renderDiagnostics.activeParticles} particles`} className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="Active fighter views" value={diagnostics.renderDiagnostics.fighterViews.toLocaleString()} />
                    <Metric label="Pooled fighter views" value={diagnostics.renderDiagnostics.pooledFighterViews.toLocaleString()} />
                    <Metric label="View reuse count" value={diagnostics.renderDiagnostics.reusedFighterViews.toLocaleString()} />
                    <Metric label="Presented events" value={diagnostics.renderDiagnostics.presentationEvents.toLocaleString()} />
                    <Metric label="Projectile visuals" value={diagnostics.renderDiagnostics.projectileVisuals.toLocaleString()} />
                    <Metric label="VFX quality" value={diagnostics.renderDiagnostics.vfxQuality} />
                    <Metric label="Particles" value={diagnostics.renderDiagnostics.activeParticles.toLocaleString()} />
                    <Metric label="Ground marks" value={diagnostics.renderDiagnostics.groundMarks.toLocaleString()} />
                    <Metric label="Residual FX" value={diagnostics.renderDiagnostics.residualParticles.toLocaleString()} />
                    <Metric label="Weapon FX" value={diagnostics.renderDiagnostics.weaponEffects.toLocaleString()} />
                    <Metric label="Projectile trails" value={diagnostics.renderDiagnostics.projectileTrails.toLocaleString()} />
                    <Metric label="Audio voices" value={`${diagnostics.audioDiagnostics.activeVoices}/${diagnostics.audioDiagnostics.voiceLimit}`} />
                  </div>
                </DisclosureGroup>

                <DisclosureGroup eyebrow="Replay" title="Determinism & storage" summary={`${diagnostics.replayFrames} frames`} className="metric-disclosure-group">
                  <div className="debug-metric-grid">
                    <Metric label="Checksum" value={diagnostics.checksum} mono />
                    <Metric label="Replay frames" value={diagnostics.replayFrames.toLocaleString()} />
                    <Metric label="Replay commands" value={diagnostics.replayCommands.toLocaleString()} />
                    <Metric label="Replay stored" value={diagnostics.replayStoredCommands.toLocaleString()} />
                    <Metric label="Replay reduction" value={`${Math.round(diagnostics.replayCompressionRatio * 100)}%`} />
                    <Metric label="Replay record" value={`${diagnostics.performance.replayMs.toFixed(2)} ms`} />
                  </div>
                </DisclosureGroup>
              </div>
              <div className="debug-export-row"><NeonButton tone="utility" size="small" className="debug-export" onClick={exportReplay}>Export replay JSON</NeonButton></div>
            </details>

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
