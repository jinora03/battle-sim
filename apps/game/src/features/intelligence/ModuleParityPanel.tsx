import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  listCompatibleModules,
  summarizeRosterModuleParity,
  type ArenaDefinition,
  type FighterDefinition,
  type FighterModuleDefinition
} from '@kinetic/content';
import {
  MODULE_IMPACT_SAMPLE_SIZES,
  analyzeFighterModuleImpact,
  type ModuleImpactProgress,
  type ModuleImpactResult,
  type ModuleImpactSampleSize
} from '@kinetic/video-export';
import { createBattleDefinition } from '../../runtime/createBattleDefinition';
import type { BattleSetup } from '../../runtime/BattleSetup';

export function ModuleParityPanel({
  fighters,
  arenas
}: {
  fighters: readonly FighterDefinition[];
  arenas: readonly ArenaDefinition[];
}) {
  const parity = useMemo(() => summarizeRosterModuleParity(fighters), [fighters]);
  const fighterNames = useMemo(() => new Map(fighters.map((fighter) => [fighter.id, fighter.name])), [fighters]);
  const initialFighter = fighters.find((fighter) => listCompatibleModules(fighter).length > 0) ?? fighters[0] ?? null;
  const initialArenaId = arenas.find((arena) => arena.id === 'iron-pit')?.id ?? arenas[0]?.id ?? 'iron-pit';
  const [fighterId, setFighterId] = useState(initialFighter?.id ?? '');
  const [moduleId, setModuleId] = useState(initialFighter ? listCompatibleModules(initialFighter)[0]?.id ?? '' : '');
  const [arenaId, setArenaId] = useState(initialArenaId);
  const [sampleSize, setSampleSize] = useState<ModuleImpactSampleSize>(4);
  const [seedText, setSeedText] = useState('19001');
  const [result, setResult] = useState<ModuleImpactResult | null>(null);
  const [progress, setProgress] = useState<ModuleImpactProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Compare a module against the standard configuration using identical deterministic seeds.');
  const abortRef = useRef<AbortController | null>(null);

  const selectedFighter = fighters.find((fighter) => fighter.id === fighterId) ?? initialFighter;
  const modules = selectedFighter ? listCompatibleModules(selectedFighter) : [];
  const selectedModule = modules.find((module) => module.id === moduleId) ?? modules[0] ?? null;
  const opponentIds = selectedFighter ? fighters.filter((fighter) => fighter.id !== selectedFighter.id).map((fighter) => fighter.id) : [];
  const projectedBattles = opponentIds.length * sampleSize * 2;

  const selectFighter = (nextFighterId: string) => {
    const fighter = fighters.find((candidate) => candidate.id === nextFighterId) ?? null;
    const firstModule = fighter ? listCompatibleModules(fighter)[0] : undefined;
    setFighterId(nextFighterId);
    setModuleId(firstModule?.id ?? '');
    setResult(null);
  };

  const runImpact = async () => {
    if (running || !selectedFighter || !selectedModule || opponentIds.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    flushSync(() => {
      setRunning(true);
      setResult(null);
      setProgress({
        phase: 'searching',
        completedBattles: 0,
        totalBattles: projectedBattles,
        progress: 0,
        activeOpponentId: null,
        activeScenario: null,
        message: 'Preparing module comparison'
      });
      setMessage(`Comparing ${selectedModule.name} against ${selectedFighter.name}'s standard configuration…`);
    });

    try {
      await waitForBrowserPaint();
      const impact = await analyzeFighterModuleImpact({
        fighterId: selectedFighter.id,
        moduleId: selectedModule.id,
        opponentIds,
        sampleSize,
        startSeed: normalizeSeed(seedText),
        signal: controller.signal,
        createBattle: (fighterAId, fighterBId, seed, moduleIdsA, moduleIdsB) => createModuleDuel(
          fighterAId,
          fighterBId,
          arenaId,
          seed,
          moduleIdsA,
          moduleIdsB
        ),
        onProgress: (update) => flushSync(() => setProgress(update))
      });
      setResult(impact);
      setMessage(`${impact.totalBattles.toLocaleString()} deterministic comparison battles complete.`);
    } catch (error) {
      if (controller.signal.aborted) setMessage('Module comparison cancelled.');
      else setMessage(error instanceof Error ? error.message : 'Could not complete module comparison.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  };

  return (
    <section className="panel-section module-parity-panel">
      <div className="battle-intelligence-section-heading">
        <div>
          <p className="eyebrow">Stage 9B · Roster &amp; Module Parity</p>
          <h2>Every fighter gets a complete loadout identity</h2>
        </div>
        <span>{parity.fullyCoveredFighters}/{parity.totalFighters} fighters cover all four module slots</span>
      </div>

      <div className="module-parity-overview">
        <div><small>Roster coverage</small><strong>{formatPercent(parity.coverageRate)}</strong></div>
        <div><small>Total module choices</small><strong>{parity.totalModules}</strong></div>
        <div><small>Mounted / visible</small><strong>{formatPercent(parity.mountedModuleRate)}</strong></div>
        <div><small>Stage 9B baseline</small><strong>O · D · M · U</strong></div>
      </div>

      <div className="module-parity-roster" aria-label="Roster module coverage">
        {parity.fighters.map((fighter) => (
          <article key={fighter.fighterId} data-complete={fighter.hasFullSlotCoverage ? 'true' : 'false'}>
            <strong>{fighter.fighterName}</strong>
            <div>
              <span>O {fighter.slotCounts.offense}</span>
              <span>D {fighter.slotCounts.defense}</span>
              <span>M {fighter.slotCounts.mobility}</span>
              <span>U {fighter.slotCounts.utility}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="module-impact-controls">
        <label>
          <span>Fighter</span>
          <select disabled={running} value={selectedFighter?.id ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => selectFighter(event.target.value)}>
            {fighters.map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}
          </select>
        </label>
        <label>
          <span>Module</span>
          <select disabled={running || modules.length === 0} value={selectedModule?.id ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setModuleId(event.target.value); setResult(null); }}>
            {modules.map((module) => <option key={module.id} value={module.id}>{slotLabel(module)} · {module.name}</option>)}
          </select>
        </label>
        <label>
          <span>Arena</span>
          <select disabled={running} value={arenaId} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setArenaId(event.target.value); setResult(null); }}>
            {arenas.map((arena) => <option key={arena.id} value={arena.id}>{arena.name}</option>)}
          </select>
        </label>
        <label>
          <span>Samples / scenario / opponent</span>
          <select disabled={running} value={sampleSize} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSampleSize(Number(event.target.value) as ModuleImpactSampleSize)}>
            {MODULE_IMPACT_SAMPLE_SIZES.map((size) => <option key={size} value={size}>{size} · {fighters.length > 1 ? (fighters.length - 1) * size * 2 : 0} total battles</option>)}
          </select>
        </label>
        <label>
          <span>Base seed</span>
          <input disabled={running} value={seedText} inputMode="numeric" pattern="[0-9]*" onChange={(event) => setSeedText(event.target.value)} />
        </label>
        <div className="module-impact-run">
          <small>Same seeds · both spawn sides</small>
          <strong>{selectedModule?.description ?? 'No module available'}</strong>
          <button type="button" disabled={!selectedModule} onClick={running ? () => abortRef.current?.abort() : () => void runImpact()}>
            {running ? 'Cancel comparison' : `Run ${projectedBattles.toLocaleString()} battles`}
          </button>
        </div>
      </div>

      <div className="battle-intelligence-status module-impact-status" role="status" aria-live="polite">
        <span>{message}</span>
        {progress && (
          <>
            <div className="battle-intelligence-progress-track" aria-hidden="true"><i style={{ width: `${progress.progress * 100}%`, minWidth: progress.progress > 0 ? '3px' : 0 }} /></div>
            <small>{progress.message} · {formatProgress(progress.progress)}</small>
          </>
        )}
      </div>

      {result && <ModuleImpactResultView result={result} fighterNames={fighterNames} module={selectedModule} />}
    </section>
  );
}

function ModuleImpactResultView({
  result,
  fighterNames,
  module
}: {
  result: ModuleImpactResult;
  fighterNames: Map<string, string>;
  module: FighterModuleDefinition | null;
}) {
  return (
    <div className="module-impact-results">
      <div className="module-impact-summary">
        <div><small>Standard win rate</small><strong>{formatPercent(result.baseline.winRate)}</strong></div>
        <div><small>{module?.name ?? 'Equipped'} win rate</small><strong>{formatPercent(result.equipped.winRate)}</strong></div>
        <div data-direction={result.winRateDelta >= 0 ? 'up' : 'down'}><small>Win-rate delta</small><strong>{formatSignedPercentPoints(result.winRateDelta)}</strong></div>
        <div><small>Fight duration delta</small><strong>{formatSignedSeconds(result.averageDurationDeltaSeconds)}</strong></div>
      </div>

      <div className="module-impact-findings">
        {result.findings.map((finding) => (
          <article key={finding.id} data-severity={finding.severity}>
            <span>{finding.severity}</span>
            <div><strong>{finding.title}</strong><p>{humanize(finding.detail, fighterNames)}</p></div>
          </article>
        ))}
      </div>

      <div className="module-impact-table-scroll">
        <div className="module-impact-table">
          <div className="module-impact-table-head"><span>Opponent</span><span>Standard</span><span>Equipped</span><span>Delta</span><span>Duration Δ</span></div>
          {result.opponents.map((opponent) => (
            <div className="module-impact-row" key={opponent.opponentId}>
              <strong>{fighterNames.get(opponent.opponentId) ?? opponent.opponentId}</strong>
              <span>{formatPercent(opponent.baselineWinRate)}</span>
              <span>{formatPercent(opponent.equippedWinRate)}</span>
              <b data-direction={opponent.winRateDelta >= 0 ? 'up' : 'down'}>{formatSignedPercentPoints(opponent.winRateDelta)}</b>
              <span>{formatSignedSeconds(opponent.durationDeltaSeconds)}</span>
            </div>
          ))}
        </div>
      </div>
      <small className="battle-ability-note">Module comparison changes only the tested loadout. Base fighter values, AI and the Stage 9A baseline matrix remain untouched.</small>
    </div>
  );
}

function createModuleDuel(
  fighterAId: string,
  fighterBId: string,
  arenaId: string,
  seed: number,
  moduleIdsA: readonly string[],
  moduleIdsB: readonly string[]
) {
  const setup: BattleSetup = {
    fighterAId,
    fighterBId,
    moduleIdsA: [...moduleIdsA],
    moduleIdsB: [...moduleIdsB],
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

function slotLabel(module: FighterModuleDefinition): string {
  return module.slot.slice(0, 1).toUpperCase() + module.slot.slice(1);
}

function humanize(value: string, fighterNames: Map<string, string>): string {
  let text = value;
  for (const [id, name] of fighterNames) text = text.replaceAll(id, name);
  return text;
}

function normalizeSeed(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.trunc(parsed) >>> 0 || 1;
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatSignedPercentPoints(value: number): string {
  const points = Math.round(value * 100);
  return `${points >= 0 ? '+' : ''}${points} pp`;
}

function formatSignedSeconds(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}s`;
}

function formatProgress(value: number): string {
  const percent = Math.max(0, Math.min(100, value * 100));
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

async function waitForBrowserPaint(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
