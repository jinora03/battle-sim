import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { ArenaDefinition, FighterDefinition } from '@kinetic/content';
import {
  MATCHUP_MATRIX_SAMPLE_SIZES,
  analyzeRosterMatchups,
  getFighterMatchupWinRate,
  getMatchupCell,
  type FighterBalanceSummary,
  type MatchupMatrixCell,
  type MatchupMatrixProgress,
  type MatchupMatrixResult,
  type MatchupMatrixSampleSize
} from '@kinetic/video-export';
import { createBattleDefinition } from '../../runtime/createBattleDefinition';
import type { BattleSetup } from '../../runtime/BattleSetup';

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
  const [progress, setProgress] = useState<MatchupMatrixProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Run the roster to measure baseline 1v1 balance across deterministic seeds.');
  const [selectedPair, setSelectedPair] = useState<{ fighterAId: string; fighterBId: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!active) return null;

  const totalPairings = (builtInFighters.length * Math.max(0, builtInFighters.length - 1)) / 2;
  const projectedBattles = totalPairings * sampleSize;
  const selectedCell = result && selectedPair
    ? getMatchupCell(result, selectedPair.fighterAId, selectedPair.fighterBId)
    : null;

  const runMatrix = async () => {
    if (running || builtInFighters.length < 2) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResult(null);
    setSelectedPair(null);
    setProgress(null);
    setMessage(`Analyzing ${totalPairings} unique matchups…`);
    const startSeed = normalizeSeedInput(seedText);

    try {
      const matrix = await analyzeRosterMatchups(
        builtInFighters.map((fighter) => ({ id: fighter.id, name: fighter.name })),
        {
          sampleSize,
          startSeed,
          signal: controller.signal,
          createBattle: (fighterAId, fighterBId, seed) => createBaselineDuel(fighterAId, fighterBId, arenaId, seed),
          onProgress: setProgress
        }
      );
      setResult(matrix);
      setResultArenaId(arenaId);
      const first = matrix.cells[0];
      if (first) setSelectedPair({ fighterAId: first.fighterAId, fighterBId: first.fighterBId });
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

  return (
    <section className="battle-intelligence-view">
      <header className="battle-intelligence-hero">
        <div>
          <p className="eyebrow">Stage 9A.2 · Battle Intelligence</p>
          <h2>Roster matchup matrix</h2>
          <p>Measure the built-in roster with AI-vs-AI duel simulations. Every matchup is side-balanced across both team/spawn orientations, and modules are disabled so this pass measures base kits only.</p>
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
            <input value={seedText} inputMode="numeric" pattern="[0-9]*" disabled={running} onChange={(event) => setSeedText(event.target.value)} />
          </label>
          <div className="battle-intelligence-run-control">
            <small>Baseline</small>
            <strong>AI vs AI · Duel · Standard · No modules</strong>
            <button type="button" onClick={running ? cancelMatrix : () => void runMatrix()}>
              {running ? 'Cancel analysis' : `Run ${projectedBattles.toLocaleString()} battles`}
            </button>
          </div>
        </div>

        <div className="battle-intelligence-status" role="status" aria-live="polite">
          <span>{message}</span>
          {progress && (
            <>
              <div className="battle-intelligence-progress-track" aria-hidden="true"><i style={{ width: `${Math.round(progress.progress * 100)}%` }} /></div>
              <small>{progress.message} · {Math.round(progress.progress * 100)}%</small>
            </>
          )}
        </div>
      </section>

      {result && (
        <>
          <section className="panel-section battle-intelligence-matrix-card">
            <div className="battle-intelligence-section-heading">
              <div><p className="eyebrow">Win-rate matrix</p><h2>{arenaName(arenas, resultArenaId)} · {result.sampleSizePerMatchup} samples each</h2></div>
              <span>Rows show that fighter's win rate</span>
            </div>
            <div className="battle-intelligence-matrix-scroll">
              <div className="battle-intelligence-matrix" style={{ '--matrix-size': result.fighters.length } as CSSProperties}>
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
            <MatchupDetail cell={selectedCell} fighterNames={fighterNames} />
            <FighterRanking summaries={result.fighterSummaries} fighterNames={fighterNames} onSelect={(fighterId, opponentId) => setSelectedPair({ fighterAId: fighterId, fighterBId: opponentId })} />
          </section>
        </>
      )}
    </section>
  );
}

function MatchupDetail({ cell, fighterNames }: { cell: MatchupMatrixCell | null; fighterNames: Map<string, string> }) {
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
      {cell.bestCreatorSeed !== null && <small className="battle-intelligence-seed-note">Best seed score {cell.bestCreatorScore?.toFixed(1)} · {cell.bestCreatorOrientation === 'reverse' ? `${fighterBName} spawned Team 1` : `${fighterAName} spawned Team 1`}</small>}
    </section>
  );
}

function FighterRanking({
  summaries,
  fighterNames,
  onSelect
}: {
  summaries: FighterBalanceSummary[];
  fighterNames: Map<string, string>;
  onSelect(fighterId: string, opponentId: string): void;
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

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
