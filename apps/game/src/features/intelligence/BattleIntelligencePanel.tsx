import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { ArenaDefinition, FighterDefinition } from '@kinetic/content';
import {
  MATCHUP_MATRIX_SAMPLE_SIZES,
  analyzeRosterMatchups,
  createBattleIntelExport,
  createBattleIntelExportFilename,
  getFighterAbilityAnalytics,
  getFighterAiDecisionAnalytics,
  getFighterPacingAnalytics,
  getFighterMatchupWinRate,
  getMatchupCell,
  serializeBattleIntelExport,
  type AbilityUsageSummary,
  type AiActionDecisionAnalytics,
  type BattleIntelligenceFinding,
  type BattlePacingAnalytics,
  type FighterAbilityAnalytics,
  type FighterAiDecisionAnalytics,
  type FighterPacingAnalytics,
  type FighterBalanceSummary,
  type MatchupMatrixCell,
  type MatchupMatrixProgress,
  type MatchupMatrixResult,
  type MatchupMatrixSampleSize
} from '@kinetic/video-export';
import { createBattleDefinition } from '../../runtime/createBattleDefinition';
import type { BattleSetup } from '../../runtime/BattleSetup';
import { ModuleParityPanel } from './ModuleParityPanel';

export function BattleIntelligencePanel({
  active,
  fighters,
  arenas
}: {
  active: boolean;
  fighters: FighterDefinition[];
  arenas: ArenaDefinition[];
}) {
  const builtInFighters = useMemo(
    () => fighters.filter((fighter) => !fighter.classification.traits.includes('custom')),
    [fighters]
  );
  const fighterNames = useMemo(
    () => new Map(builtInFighters.map((fighter) => [fighter.id, fighter.name])),
    [builtInFighters]
  );
  const defaultArenaId = arenas.find((arena) => arena.id === 'iron-pit')?.id ?? arenas[0]?.id ?? 'iron-pit';
  const [arenaId, setArenaId] = useState(defaultArenaId);
  const [sampleSize, setSampleSize] = useState<MatchupMatrixSampleSize>(10);
  const [seedText, setSeedText] = useState('9001');
  const [result, setResult] = useState<MatchupMatrixResult | null>(null);
  const [resultArenaId, setResultArenaId] = useState(defaultArenaId);
  const [resultBaseSeed, setResultBaseSeed] = useState(9001);
  const [progress, setProgress] = useState<MatchupMatrixProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Run the roster to measure baseline 1v1 balance across deterministic seeds.');
  const [selectedPair, setSelectedPair] = useState<{ fighterAId: string; fighterBId: string } | null>(null);
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [matrixZoom, setMatrixZoom] = useState(1);

  if (!active) return null;

  const totalPairings = (builtInFighters.length * Math.max(0, builtInFighters.length - 1)) / 2;
  const projectedBattles = totalPairings * sampleSize;
  const selectedCell = result && selectedPair
    ? getMatchupCell(result, selectedPair.fighterAId, selectedPair.fighterBId)
    : null;
  const selectedAbilityAnalytics = result && selectedFighterId
    ? getFighterAbilityAnalytics(result.abilityAnalytics, selectedFighterId)
    : null;
  const selectedAiDecisionAnalytics = result && selectedFighterId
    ? getFighterAiDecisionAnalytics(result.aiDecisionAnalytics, selectedFighterId)
    : null;
  const selectedPacingAnalytics = result && selectedFighterId
    ? getFighterPacingAnalytics(result.pacingAnalytics, selectedFighterId)
    : null;

  const runMatrix = async () => {
    if (running || builtInFighters.length < 2) return;
    const controller = new AbortController();
    abortRef.current = controller;
    flushSync(() => {
      setRunning(true);
      setResult(null);
      setSelectedPair(null);
      setSelectedFighterId(null);
      setProgress({
        phase: 'searching',
        completedPairings: 0,
        totalPairings,
        completedBattles: 0,
        totalBattles: projectedBattles,
        progress: 0,
        activeFighterAId: null,
        activeFighterBId: null,
        activeSeed: null,
        message: 'Preparing first matchup'
      });
      setMessage(`Analyzing ${totalPairings} unique matchups…`);
    });
    const startSeed = normalizeSeedInput(seedText);

    try {
      await waitForBrowserPaint();
      const matrix = await analyzeRosterMatchups(
        builtInFighters.map((fighter) => ({ id: fighter.id, name: fighter.name })),
        {
          sampleSize,
          startSeed,
          signal: controller.signal,
          createBattle: (fighterAId, fighterBId, seed) => createBaselineDuel(fighterAId, fighterBId, arenaId, seed),
          onProgress: (update) => {
            flushSync(() => setProgress(update));
          }
        }
      );
      setResult(matrix);
      setResultArenaId(arenaId);
      setResultBaseSeed(startSeed);
      const first = matrix.cells[0];
      if (first) setSelectedPair({ fighterAId: first.fighterAId, fighterBId: first.fighterBId });
      setSelectedFighterId(matrix.fighters[0]?.id ?? null);
      setMessage(`${matrix.totalBattles.toLocaleString()} deterministic battles analyzed. No gameplay values were changed.`);
    } catch (error) {
      if (controller.signal.aborted) setMessage('Matrix analysis cancelled. No partial result was committed.');
      else setMessage(error instanceof Error ? error.message : 'Could not complete matchup analysis.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  };

  const cancelMatrix = () => {
    abortRef.current?.abort();
  };

  const randomizeSeed = () => {
    if (running) return;
    const nextSeed = createRandomIntelSeed();
    setSeedText(String(nextSeed));
    setMessage(`Randomized base seed to ${nextSeed.toLocaleString()}.`);
  };

  const exportIntel = () => {
    if (!result) return;
    const exportDocument = createBattleIntelExport(result, {
      arenaId: resultArenaId,
      arenaName: arenaName(arenas, resultArenaId),
      baseSeed: resultBaseSeed,
      selectedFighterId,
      selectedMatchup: selectedPair
    });
    downloadTextFile(
      createBattleIntelExportFilename(exportDocument),
      serializeBattleIntelExport(exportDocument),
      'application/json'
    );
    setMessage('Battle Intel JSON exported. Upload that file here and I can analyze the full Stage 9A dataset directly.');
  };

  const copyBestSeed = (seed: number) => {
    const normalized = normalizeSeedInput(String(seed));
    const text = String(normalized);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => setMessage(`Best creator seed ${normalized.toLocaleString()} copied.`),
        () => {
          setSeedText(text);
          setMessage(`Clipboard unavailable. Best creator seed ${normalized.toLocaleString()} was loaded into the seed field instead.`);
        }
      );
      return;
    }
    setSeedText(text);
    setMessage(`Best creator seed ${normalized.toLocaleString()} was loaded into the seed field.`);
  };

  return (
    <section className="battle-intelligence-view">
      <header className="battle-intelligence-hero">
        <div>
          <p className="eyebrow">Stage 9A complete · Stage 9B active</p>
          <h2>Complete roster diagnostics</h2>
          <p>Measure baseline matchup balance, kit usage, AI decisions, battle pacing and diagnostic findings from one deterministic roster scan. Intelligence remains read-only and never changes gameplay values.</p>
        </div>
        <div className="battle-intelligence-hero-stats">
          <span><strong>{builtInFighters.length}</strong>fighters</span>
          <span><strong>{totalPairings}</strong>pairings</span>
          <span><strong>{projectedBattles.toLocaleString()}</strong>battles/run</span>
        </div>
      </header>

      <section className="panel-section battle-intelligence-controls">
        <div className="battle-intelligence-control-grid">
          <label>
            <span>Arena</span>
            <select value={arenaId} disabled={running} onChange={(event: ChangeEvent<HTMLSelectElement>) => setArenaId(event.target.value)}>
              {arenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}
            </select>
          </label>
          <label>
            <span>Samples / matchup</span>
            <select value={sampleSize} disabled={running} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSampleSize(Number(event.target.value) as MatchupMatrixSampleSize)}>
              {MATCHUP_MATRIX_SAMPLE_SIZES.map((size) => (
                <option key={size} value={size}>{size} battles · {size / 2} each side</option>
              ))}
            </select>
          </label>
          <label>
            <span>Base seed</span>
            <div className="battle-intelligence-seed-input">
              <input value={seedText} inputMode="numeric" pattern="[0-9]*" disabled={running} onChange={(event) => setSeedText(event.target.value)} />
              <button type="button" disabled={running} onClick={randomizeSeed}>Randomize</button>
            </div>
          </label>
          <div className="battle-intelligence-run-control">
            <small>Baseline</small>
            <strong>AI vs AI · Duel · Standard · No modules</strong>
            <div className="battle-intelligence-run-actions">
              <button type="button" onClick={running ? cancelMatrix : () => void runMatrix()}>
                {running ? 'Cancel analysis' : `Run ${projectedBattles.toLocaleString()} battles`}
              </button>
              <button type="button" disabled={!result || running} onClick={exportIntel}>Export Intel JSON</button>
            </div>
          </div>
        </div>

        <div className="battle-intelligence-status" role="status" aria-live="polite">
          <span>{message}</span>
          {progress && (
            <>
              <div className="battle-intelligence-progress-track" aria-hidden="true">
                <i
                  style={{
                    width: `${progress.progress * 100}%`,
                    minWidth: progress.progress > 0 ? '3px' : 0
                  }}
                />
              </div>
              <small>{progress.message} · {formatProgressPercent(progress.progress)}</small>
            </>
          )}
        </div>
      </section>

      <ModuleParityPanel fighters={builtInFighters} arenas={arenas} />

      {result && (
        <>
          <section className="panel-section battle-intelligence-matrix-card">
            <div className="battle-intelligence-section-heading">
              <div><p className="eyebrow">Win-rate matrix</p><h2>{arenaName(arenas, resultArenaId)} · {result.sampleSizePerMatchup} samples each · seed {resultBaseSeed.toLocaleString()}</h2></div>
              <div className="battle-intelligence-matrix-tools">
                <span>Rows show that fighter's win rate</span>
                <div className="battle-intelligence-zoom-controls" aria-label="Matrix zoom controls">
                  <button type="button" aria-label="Zoom matrix out" disabled={matrixZoom <= 0.7} onClick={() => setMatrixZoom((value) => clampMatrixZoom(value - 0.1))}>−</button>
                  <button type="button" className="zoom-value" title="Reset matrix zoom" onClick={() => setMatrixZoom(1)}>{Math.round(matrixZoom * 100)}%</button>
                  <button type="button" aria-label="Zoom matrix in" disabled={matrixZoom >= 1.5} onClick={() => setMatrixZoom((value) => clampMatrixZoom(value + 0.1))}>+</button>
                </div>
              </div>
            </div>
            <div className="battle-intelligence-matrix-scroll">
              <div
                className="battle-intelligence-matrix"
                style={{
                  '--matrix-size': result.fighters.length,
                  '--matrix-row-width': `${Math.round(88 * matrixZoom)}px`,
                  '--matrix-cell-width': `${Math.round(58 * matrixZoom)}px`,
                  '--matrix-cell-height': `${Math.round(42 * matrixZoom)}px`,
                  '--matrix-cell-font': `${Math.max(8, Math.round(10 * matrixZoom))}px`,
                  '--matrix-label-font': `${Math.max(7, Math.round(8 * matrixZoom))}px`,
                  minWidth: `${Math.round((88 + result.fighters.length * 58) * matrixZoom)}px`
                } as CSSProperties}
              >
                <div className="matrix-corner">VS</div>
                {result.fighters.map((fighter) => <div className="matrix-column-label" key={`column-${fighter.id}`} title={fighter.name}>{shortName(fighter.name)}</div>)}
                {result.fighters.flatMap((row) => [
                  <div className="matrix-row-label" key={`row-${row.id}`} title={row.name}>{shortName(row.name)}</div>,
                  ...result.fighters.map((column) => {
                    if (row.id === column.id) return <div className="matrix-cell self" key={`${row.id}-${column.id}`}>—</div>;
                    const cell = getMatchupCell(result, row.id, column.id);
                    if (!cell) return <div className="matrix-cell empty" key={`${row.id}-${column.id}`}>—</div>;
                    const rate = getFighterMatchupWinRate(cell, row.id);
                    const selected = selectedPair && samePair(selectedPair, row.id, column.id);
                    return (
                      <button
                        type="button"
                        key={`${row.id}-${column.id}`}
                        className={`matrix-cell ${selected ? 'selected' : ''}`}
                        data-band={winRateBand(rate)}
                        onClick={() => setSelectedPair({ fighterAId: row.id, fighterBId: column.id })}
                        title={`${row.name} vs ${column.name}: ${formatPercent(rate)}`}
                      >
                        {formatPercent(rate)}
                      </button>
                    );
                  })
                ])}
              </div>
            </div>
          </section>

          <section className="battle-intelligence-lower-grid">
            <MatchupDetail cell={selectedCell} fighterNames={fighterNames} onCopyBestSeed={copyBestSeed} />
            <FighterRanking
              summaries={result.fighterSummaries}
              fighterNames={fighterNames}
              onSelect={(fighterId, opponentId) => setSelectedPair({ fighterAId: fighterId, fighterBId: opponentId })}
              onInspect={setSelectedFighterId}
            />
          </section>

          <AbilityAnalyticsPanel
            analytics={selectedAbilityAnalytics}
            fighters={result.fighters}
            fighterNames={fighterNames}
            selectedFighterId={selectedFighterId}
            onSelect={setSelectedFighterId}
          />

          <AiDecisionAnalyticsPanel
            analytics={selectedAiDecisionAnalytics}
            fighterName={selectedFighterId ? fighterNames.get(selectedFighterId) ?? selectedFighterId : 'Fighter'}
          />

          <PacingAnalyticsPanel
            overall={result.pacingAnalytics.overall}
            fighter={selectedPacingAnalytics}
            fighterName={selectedFighterId ? fighterNames.get(selectedFighterId) ?? selectedFighterId : 'Fighter'}
          />

          <FindingsPanel findings={result.findings} fighterNames={fighterNames} onInspect={setSelectedFighterId} onMatchup={(fighterId, opponentId) => setSelectedPair({ fighterAId: fighterId, fighterBId: opponentId })} />
        </>
      )}
    </section>
  );
}

function MatchupDetail({ cell, fighterNames, onCopyBestSeed }: { cell: MatchupMatrixCell | null; fighterNames: Map<string, string>; onCopyBestSeed(seed: number): void }) {
  if (!cell) {
    return <section className="panel-section battle-intelligence-detail"><p className="eyebrow">Matchup detail</p><h2>Select a matrix cell</h2><p>Click any matchup to inspect pacing, closeness, draw rate and the strongest creator seed found during the same scan.</p></section>;
  }
  const fighterAName = fighterNames.get(cell.fighterAId) ?? cell.fighterAId;
  const fighterBName = fighterNames.get(cell.fighterBId) ?? cell.fighterBId;
  return (
    <section className="panel-section battle-intelligence-detail">
      <p className="eyebrow">Matchup detail</p>
      <h2>{fighterAName} vs {fighterBName}</h2>
      <div className="battle-intelligence-versus">
        <div><small>{fighterAName}</small><strong>{formatPercent(cell.fighterAWinRate)}</strong><span>{cell.fighterAWins} wins</span></div>
        <b>VS</b>
        <div><small>{fighterBName}</small><strong>{formatPercent(cell.fighterBWinRate)}</strong><span>{cell.fighterBWins} wins</span></div>
      </div>
      <div className="battle-intelligence-detail-grid">
        <Metric label="Median fight" value={formatDuration(cell.medianDurationSeconds)} />
        <Metric label="Close fights" value={formatPercent(cell.closeFightRate)} />
        <Metric label="One-sided" value={formatPercent(cell.oneSidedFightRate)} />
        <Metric label="Draws" value={formatPercent(cell.drawRate)} />
        <Metric label="Timeout / limit" value={formatPercent(cell.timeoutRate + cell.safetyLimitRate)} />
        <Metric label="Avg damage" value={Math.round(cell.averageTotalDamage).toLocaleString()} />
        <Metric label="Avg ultimates" value={cell.averageUltimates.toFixed(1)} />
        <Metric label="Best creator seed" value={cell.bestCreatorSeed?.toLocaleString() ?? '—'} />
      </div>
      {cell.bestCreatorSeed !== null && (
        <div className="battle-intelligence-best-seed">
          <small className="battle-intelligence-seed-note">Best seed score {cell.bestCreatorScore?.toFixed(1)} · {cell.bestCreatorOrientation === 'reverse' ? `${fighterBName} spawned Team 1` : `${fighterAName} spawned Team 1`}</small>
          <button type="button" onClick={() => onCopyBestSeed(cell.bestCreatorSeed!)}>Copy best seed</button>
        </div>
      )}
    </section>
  );
}

function FighterRanking({
  summaries,
  fighterNames,
  onSelect,
  onInspect
}: {
  summaries: FighterBalanceSummary[];
  fighterNames: Map<string, string>;
  onSelect(fighterId: string, opponentId: string): void;
  onInspect(fighterId: string): void;
}) {
  const ranked = [...summaries].sort((a, b) => b.winRate - a.winRate || a.fighterId.localeCompare(b.fighterId));
  return (
    <section className="panel-section battle-intelligence-ranking">
      <div className="battle-intelligence-section-heading"><div><p className="eyebrow">Roster summary</p><h2>Overall baseline win rate</h2></div><span>All opponents combined</span></div>
      <div className="battle-intelligence-ranking-list">
        {ranked.map((summary, index) => {
          const strongest = summary.strongestOpponentId ? fighterNames.get(summary.strongestOpponentId) ?? summary.strongestOpponentId : '—';
          const weakest = summary.weakestOpponentId ? fighterNames.get(summary.weakestOpponentId) ?? summary.weakestOpponentId : '—';
          return (
            <article key={summary.fighterId}>
              <b>#{index + 1}</b>
              <div><strong>{fighterNames.get(summary.fighterId) ?? summary.fighterId}</strong><small>{summary.wins}W · {summary.losses}L · {summary.draws}D</small></div>
              <span data-band={winRateBand(summary.winRate)}>{formatPercent(summary.winRate)}</span>
              <div className="ranking-opponents">
                <button type="button" onClick={() => onInspect(summary.fighterId)}>Kit stats</button>
                {summary.strongestOpponentId && <button type="button" onClick={() => onSelect(summary.fighterId, summary.strongestOpponentId!)}>Best {shortName(strongest)} {formatPercent(summary.strongestOpponentWinRate)}</button>}
                {summary.weakestOpponentId && <button type="button" onClick={() => onSelect(summary.fighterId, summary.weakestOpponentId!)}>Worst {shortName(weakest)} {formatPercent(summary.weakestOpponentWinRate)}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}


function AbilityAnalyticsPanel({
  analytics,
  fighters,
  fighterNames,
  selectedFighterId,
  onSelect
}: {
  analytics: FighterAbilityAnalytics | null;
  fighters: Array<{ id: string; name: string }>;
  fighterNames: Map<string, string>;
  selectedFighterId: string | null;
  onSelect(fighterId: string): void;
}) {
  return (
    <section className="panel-section battle-ability-analytics">
      <div className="battle-intelligence-section-heading battle-ability-heading">
        <div>
          <p className="eyebrow">Stage 9A.3 · Ability usage</p>
          <h2>{selectedFighterId ? fighterNames.get(selectedFighterId) ?? selectedFighterId : 'Fighter kit telemetry'}</h2>
        </div>
        <label>
          <span>Inspect fighter</span>
          <select value={selectedFighterId ?? ''} onChange={(event) => onSelect(event.target.value)}>
            {fighters.map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}
          </select>
        </label>
      </div>

      {!analytics ? (
        <p className="battle-ability-empty">Run the matrix to collect ability telemetry from the same battles.</p>
      ) : (
        <>
          <div className="battle-ability-summary">
            <Metric label="Battle samples" value={analytics.battleSamples.toLocaleString()} />
            <Metric label="Damage / battle" value={analytics.battleSamples > 0 ? Math.round(analytics.totalDamage / analytics.battleSamples).toLocaleString() : '0'} />
            <Metric label="Damage attributed" value={formatPercent(analytics.attributedDamageRate)} />
            <Metric label="Primary uses / battle" value={analytics.primaryAttack.usesPerBattle.toFixed(1)} />
          </div>

          <div className="battle-ability-table-scroll">
            <div className="battle-ability-table">
              <div className="battle-ability-table-head">
                <span>Action</span><span>Use / battle</span><span>Battles used</span><span>Resolved</span><span>Hits / use</span><span>Damage</span><span>First use</span><span>KOs</span>
              </div>
              {[analytics.primaryAttack, ...analytics.abilities].map((action) => (
                <AbilityUsageRow key={`${action.kind}-${action.actionId}`} action={action} />
              ))}
            </div>
          </div>

          <small className="battle-ability-note">
            Damage attribution follows primary hits, skill-projectile IDs and the active/resolving ability event stream. Any damage that cannot be identified safely remains unattributed instead of being guessed.
          </small>
        </>
      )}
    </section>
  );
}

function AbilityUsageRow({ action }: { action: AbilityUsageSummary }) {
  const flag = action.kind === 'ability' ? abilityUsageFlag(action) : null;
  return (
    <article className="battle-ability-row">
      <div className="battle-ability-name">
        <span>{action.kind === 'primary' ? 'BASIC' : slotLabel(action.slot)}</span>
        <strong>{action.name}</strong>
        {flag && <small data-flag={flag.tone}>{flag.label}</small>}
      </div>
      <b>{action.usesPerBattle.toFixed(2)}</b>
      <b>{formatPercent(action.usageRate)}</b>
      <b>{action.kind === 'primary' ? '—' : formatPercent(action.completionRate)}</b>
      <b>{action.hitsPerUse.toFixed(2)}</b>
      <b>{formatPercent(action.damageContribution)}</b>
      <b>{action.averageFirstUseSeconds === null ? '—' : formatDuration(action.averageFirstUseSeconds)}</b>
      <b>{action.kills}</b>
    </article>
  );
}

function abilityUsageFlag(action: AbilityUsageSummary): { label: string; tone: 'warn' | 'info' } | null {
  if (action.battleSamples >= 5 && action.neverUsedRate >= 0.4) return { label: `Unused ${formatPercent(action.neverUsedRate)}`, tone: 'warn' };
  if (action.uses >= 5 && action.completionRate < 0.8) return { label: 'Interrupted casts', tone: 'warn' };
  if (action.usesPerBattle >= 2.5) return { label: 'Frequent', tone: 'info' };
  return null;
}

function slotLabel(slot: AbilityUsageSummary['slot']): string {
  if (slot === 'skill1') return 'S1';
  if (slot === 'skill2') return 'S2';
  if (slot === 'skill3') return 'S3';
  if (slot === 'ultimate') return 'ULT';
  return 'BASIC';
}

function AiDecisionAnalyticsPanel({
  analytics,
  fighterName
}: {
  analytics: FighterAiDecisionAnalytics | null;
  fighterName: string;
}) {
  return (
    <section className="panel-section battle-ai-analytics">
      <div className="battle-intelligence-section-heading">
        <div>
          <p className="eyebrow">Stage 9A.4 · AI decisions</p>
          <h2>{fighterName} decision profile</h2>
        </div>
        <span>Why actions are chosen or blocked</span>
      </div>

      {!analytics ? (
        <p className="battle-ability-empty">Run the matrix to collect AI decision telemetry.</p>
      ) : (
        <>
          <div className="battle-ai-summary">
            <Metric label="Decisions / battle" value={analytics.decisionsPerBattle.toFixed(1)} />
            <Metric label="Skills selected" value={formatPercent(analytics.abilitySelectionRate)} />
            <Metric label="Primary selected" value={formatPercent(analytics.primarySelectionRate)} />
            <Metric label="Reposition decisions" value={formatPercent(analytics.repositionRate)} />
          </div>

          <div className="battle-ai-table-scroll">
            <div className="battle-ai-table">
              <div className="battle-ai-table-head">
                <span>Action</span><span>Valid windows</span><span>Chosen when valid</span><span>Ready skipped</span><span>Blocked</span><span>Top blocker</span>
              </div>
              {analytics.actions.map((action) => <AiDecisionRow key={action.actionId} action={action} />)}
            </div>
          </div>
          <small className="battle-ability-note">
            “Ready skipped” means an action was valid during an AI evaluation but another valid action scored higher. Blockers come directly from the existing action-selection rules; this telemetry does not alter those rules.
          </small>
        </>
      )}
    </section>
  );
}

function AiDecisionRow({ action }: { action: AiActionDecisionAnalytics }) {
  const topBlock = action.blockReasons[0];
  return (
    <article className="battle-ai-row">
      <div className="battle-ability-name">
        <span>{slotLabel(action.slot)}</span>
        <strong>{action.name}</strong>
      </div>
      <b>{formatPercent(action.validOpportunityRate)}</b>
      <b>{formatPercent(action.selectionRateWhenValid)}</b>
      <b>{formatPercent(action.readyButSkippedRate)}</b>
      <b>{formatPercent(action.blockedRate)}</b>
      <div className="battle-ai-blocker">
        <strong>{topBlock ? blockReasonLabel(topBlock.category) : '—'}</strong>
        <small>{topBlock ? `${formatPercent(topBlock.rate)} of blocks` : 'No blocker sampled'}</small>
      </div>
    </article>
  );
}

function blockReasonLabel(category: AiActionDecisionAnalytics['blockReasons'][number]['category']): string {
  switch (category) {
    case 'cooldown-or-busy': return 'Cooldown / busy';
    case 'opening-lockout': return 'Opening lockout';
    case 'range': return 'Range';
    case 'targeting': return 'No target';
    case 'health-gate': return 'Health gate';
    case 'status-gate': return 'Status gate';
    case 'resource-gate': return 'Resource gate';
    case 'prediction': return 'Predicted range';
    case 'line-of-sight': return 'Line of sight';
    case 'target-count': return 'Target count';
    default: return 'Other';
  }
}


function PacingAnalyticsPanel({
  overall,
  fighter,
  fighterName
}: {
  overall: BattlePacingAnalytics;
  fighter: FighterPacingAnalytics | null;
  fighterName: string;
}) {
  return (
    <section className="panel-section battle-pacing-analytics">
      <div className="battle-intelligence-section-heading">
        <div>
          <p className="eyebrow">Stage 9A.5 · Battle pacing</p>
          <h2>Combat rhythm and inactivity</h2>
        </div>
        <span>{overall.battleSamples.toLocaleString()} battles sampled</span>
      </div>

      <div className="battle-pacing-summary">
        <Metric label="Median fight" value={formatDuration(overall.medianDurationSeconds)} />
        <Metric label="First damage" value={formatNullableDuration(overall.averageFirstDamageSeconds)} />
        <Metric label="First skill" value={formatNullableDuration(overall.averageFirstSkillSeconds)} />
        <Metric label="First ultimate" value={formatNullableDuration(overall.averageFirstUltimateSeconds)} />
        <Metric label="Under 10s" value={formatPercent(overall.shortFightRate)} />
        <Metric label="Over 45s" value={formatPercent(overall.longFightRate)} />
        <Metric label="6s+ quiet gap" value={formatPercent(overall.stallBattleRate)} />
        <Metric label="Quiet time" value={formatPercent(overall.averageQuietTimeRatio)} />
      </div>

      {fighter && (
        <div className="battle-pacing-fighter">
          <div>
            <small>Selected fighter</small>
            <strong>{fighterName}</strong>
          </div>
          <Metric label="First damage dealt" value={formatNullableDuration(fighter.averageFirstDamageDealtSeconds)} />
          <Metric label="First skill use" value={formatNullableDuration(fighter.averageFirstSkillUseSeconds)} />
          <Metric label="First ult use" value={formatNullableDuration(fighter.averageFirstUltimateUseSeconds)} />
          <Metric label="Stall battles" value={formatPercent(fighter.stallBattleRate)} />
        </div>
      )}

      <small className="battle-ability-note">
        A quiet gap means at least 3 seconds without damage, weapon contact, a weapon start or a skill activation. The stall signal flags battles containing a 6-second-or-longer combat-quiet gap.
      </small>
    </section>
  );
}

function FindingsPanel({
  findings,
  fighterNames,
  onInspect,
  onMatchup
}: {
  findings: BattleIntelligenceFinding[];
  fighterNames: Map<string, string>;
  onInspect(fighterId: string): void;
  onMatchup(fighterId: string, opponentId: string): void;
}) {
  return (
    <section className="panel-section battle-intelligence-findings">
      <div className="battle-intelligence-section-heading">
        <div>
          <p className="eyebrow">Stage 9A.6 · Findings</p>
          <h2>Signals worth investigating</h2>
        </div>
        <span>Conservative thresholds · no automatic balance changes</span>
      </div>
      <div className="battle-intelligence-findings-list">
        {findings.map((finding) => (
          <article key={finding.id} data-severity={finding.severity}>
            <div className="finding-meta">
              <span>{finding.severity}</span>
              <b>{finding.category}</b>
            </div>
            <div className="finding-copy">
              <strong>{finding.title}</strong>
              <p>{humanizeFindingDetail(finding.detail, fighterNames)}</p>
            </div>
            {(finding.fighterId || finding.opponentId) && (
              <div className="finding-actions">
                {finding.fighterId && <button type="button" onClick={() => onInspect(finding.fighterId!)}>Inspect {shortName(fighterNames.get(finding.fighterId) ?? finding.fighterId)}</button>}
                {finding.fighterId && finding.opponentId && <button type="button" onClick={() => onMatchup(finding.fighterId!, finding.opponentId!)}>Open matchup</button>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function humanizeFindingDetail(detail: string, fighterNames: Map<string, string>): string {
  let resolved = detail;
  for (const [fighterId, name] of fighterNames) {
    resolved = resolved.replaceAll(fighterId, name);
  }
  return resolved;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function createBaselineDuel(fighterAId: string, fighterBId: string, arenaId: string, seed: number) {
  const setup: BattleSetup = {
    fighterAId,
    fighterBId,
    moduleIdsA: [],
    moduleIdsB: [],
    controllerA: 'ai',
    controllerB: 'ai',
    arenaId,
    modeId: 'duel',
    teamSizeA: 1,
    teamSizeB: 1,
    friendlyFire: false,
    teamCollision: 'full',
    difficulty: 'standard'
  };
  return createBattleDefinition(setup, seed);
}

function samePair(pair: { fighterAId: string; fighterBId: string }, fighterAId: string, fighterBId: string): boolean {
  return (pair.fighterAId === fighterAId && pair.fighterBId === fighterBId)
    || (pair.fighterAId === fighterBId && pair.fighterBId === fighterAId);
}


async function waitForBrowserPaint(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function formatProgressPercent(progress: number): string {
  const percent = Math.max(0, Math.min(100, progress * 100));
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

function clampMatrixZoom(value: number): number {
  return Math.round(Math.max(0.7, Math.min(1.5, value)) * 10) / 10;
}

function createRandomIntelSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] || 1;
  }
  return (Math.floor(Math.random() * 0x1_0000_0000) >>> 0) || 1;
}

function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizeSeedInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.trunc(parsed) >>> 0 || 1;
}

function arenaName(arenas: readonly ArenaDefinition[], arenaId: string): string {
  return arenas.find((arena) => arena.id === arenaId)?.name ?? arenaId;
}

function shortName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return name.slice(0, 8);
  return words.map((word) => word[0]).join('').slice(0, 5).toUpperCase();
}

function winRateBand(rate: number): 'low' | 'below' | 'even' | 'above' | 'high' {
  if (rate < 0.4) return 'low';
  if (rate < 0.48) return 'below';
  if (rate <= 0.52) return 'even';
  if (rate <= 0.6) return 'above';
  return 'high';
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatNullableDuration(seconds: number | null): string {
  return seconds === null ? '—' : formatDuration(seconds);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
