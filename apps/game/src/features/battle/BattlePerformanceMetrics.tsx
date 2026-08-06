import { useRef } from 'react';
import { DisclosureGroup, Metric } from '../../ui/FormControls';
import type { AppController } from '../../app/AppController';

type BattleDiagnostics = AppController['battle']['diagnostics'];
type ViewportMetrics = AppController['shell']['viewportMetrics'];

export function BattlePerformanceMetrics({
  diagnostics,
  viewportMetrics,
  fighterCount
}: {
  diagnostics: BattleDiagnostics;
  viewportMetrics: ViewportMetrics;
  fighterCount: number;
}) {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  return (
    <details className="panel-section battle-debug-panel">
      <summary className="panel-summary">
        <span><small>Developer</small><strong>Performance &amp; simulation metrics</strong></span>
        <em>{diagnostics.performance.renderFps.toFixed(0)} FPS</em>
      </summary>
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
            <Metric label="Metrics renders" value={renderCountRef.current.toLocaleString()} />
            <Metric label="Render target" value={`${diagnostics.renderDiagnostics.targetRenderFps} FPS`} />
            <Metric label="Visual LOD" value={diagnostics.renderDiagnostics.lod} />
            <Metric label="Mass render tier" value={diagnostics.renderDiagnostics.renderTier} />
          </div>
        </DisclosureGroup>

        <DisclosureGroup eyebrow="Simulation" title="Runtime & tick health" summary={`${diagnostics.performance.simulationMs.toFixed(2)} ms`} defaultOpen className="metric-disclosure-group">
          <div className="debug-metric-grid">
            <Metric label="Tick" value={diagnostics.tick.toLocaleString()} />
            <Metric label="Registered fighters" value={fighterCount.toString()} />
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
            {diagnostics.aiDecisions.length === 0 ? (
              <p className="ai-decision-empty-state">No AI decision sampled yet.</p>
            ) : diagnostics.aiDecisions.slice(0, 8).map((decision) => (
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
    </details>
  );
}
