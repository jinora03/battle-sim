import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from 'react';
import {
  rankBattleSeeds,
  type RankedSeedBattle,
  type ReplayExportSource,
  type SeedBatchProgress,
  type SeedBatchSize
} from '@kinetic/video-export';
import type { BattleSetup } from '../runtime/BattleSetup';
import { createBattleDefinition, normalizeBattleSeed } from '../runtime/createBattleDefinition';

type ConfiguredBattle = ReturnType<typeof createBattleDefinition>;

interface UseReplayVideoExportSeedControllerOptions {
  setup: BattleSetup;
  currentSeed: number;
  blocked: boolean;
  abortRef: MutableRefObject<AbortController | null>;
  setError: Dispatch<SetStateAction<string | null>>;
}

export interface ReplayVideoExportSeedController {
  generationSeedText: string;
  configuredBattle: ConfiguredBattle;
  configuredBattleKey: string;
  preparedReplayTick: number | null;
  batchProgress: SeedBatchProgress | null;
  batchSearching: boolean;
  batchSize: SeedBatchSize;
  batchResults: RankedSeedBattle[];
  setGenerationSeedText(value: string): void;
  randomizeSeed(): void;
  reuseCurrentSeed(): void;
  setBatchSize(size: SeedBatchSize): void;
  searchSeeds(): void;
  selectRankedSeed(seed: number): void;
  getPreparedSource(battleKey: string): ReplayExportSource | null;
  rememberPreparedSource(battleKey: string, source: ReplayExportSource): void;
}

export function useReplayVideoExportSeedController({
  setup,
  currentSeed,
  blocked,
  abortRef,
  setError
}: UseReplayVideoExportSeedControllerOptions): ReplayVideoExportSeedController {
  const [generationSeedText, setGenerationSeedTextState] = useState(() => String(normalizeBattleSeed(currentSeed)));
  const [batchSize, setBatchSize] = useState<SeedBatchSize>(10);
  const [batchResults, setBatchResults] = useState<RankedSeedBattle[]>([]);
  const [batchProgress, setBatchProgress] = useState<SeedBatchProgress | null>(null);
  const [batchSearching, setBatchSearching] = useState(false);
  const preparedSourceRef = useRef<{ key: string; source: ReplayExportSource } | null>(null);
  const [preparedSourceKey, setPreparedSourceKey] = useState<string | null>(null);

  const generationSeed = normalizeBattleSeed(Number(generationSeedText) || 1);
  const configuredBattle = useMemo(
    () => createBattleDefinition(setup, generationSeed),
    [generationSeed, setup]
  );
  const configuredBattleKey = useMemo(() => JSON.stringify(configuredBattle), [configuredBattle]);
  const configuredSetupKey = useMemo(() => JSON.stringify(setup), [setup]);
  const preparedReplayTick = preparedSourceKey === configuredBattleKey
    ? preparedSourceRef.current?.source.endTick ?? null
    : null;

  useEffect(() => {
    setBatchResults([]);
    setBatchProgress(null);
  }, [configuredSetupKey]);

  const setGenerationSeedText = useCallback((value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setGenerationSeedTextState(digitsOnly);
  }, []);

  const randomizeSeed = useCallback(() => {
    setGenerationSeedTextState(String(generateRandomSeed()));
  }, []);

  const reuseCurrentSeed = useCallback(() => {
    setGenerationSeedTextState(String(normalizeBattleSeed(currentSeed)));
  }, [currentSeed]);

  const selectRankedSeed = useCallback((seed: number) => {
    setGenerationSeedTextState(String(normalizeBattleSeed(seed)));
  }, []);

  const getPreparedSource = useCallback((battleKey: string): ReplayExportSource | null => {
    const prepared = preparedSourceRef.current;
    return prepared?.key === battleKey ? prepared.source : null;
  }, []);

  const rememberPreparedSource = useCallback((battleKey: string, source: ReplayExportSource) => {
    preparedSourceRef.current = { key: battleKey, source };
    setPreparedSourceKey(battleKey);
  }, []);

  const searchSeeds = useCallback(() => {
    if (blocked || batchSearching || abortRef.current) return;

    const abortController = new AbortController();
    abortRef.current = abortController;
    setError(null);
    setBatchResults([]);
    setBatchProgress(null);
    setBatchSearching(true);

    const run = async () => {
      const results = await rankBattleSeeds(configuredBattle, {
        count: batchSize,
        startSeed: generationSeed,
        signal: abortController.signal,
        onProgress: setBatchProgress
      });
      setBatchResults(results);
      if (results[0]) setGenerationSeedTextState(String(results[0].seed));
    };

    void run().catch((reason: unknown) => {
      if (abortController.signal.aborted) {
        setBatchProgress((current) => current ? {
          ...current,
          phase: 'cancelled',
          message: 'Seed search cancelled.'
        } : null);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Seed search failed.');
    }).finally(() => {
      setBatchSearching(false);
      if (abortRef.current === abortController) abortRef.current = null;
    });
  }, [abortRef, batchSearching, batchSize, blocked, configuredBattle, generationSeed, setError]);

  return {
    generationSeedText,
    configuredBattle,
    configuredBattleKey,
    preparedReplayTick,
    batchProgress,
    batchSearching,
    batchSize,
    batchResults,
    setGenerationSeedText,
    randomizeSeed,
    reuseCurrentSeed,
    setBatchSize,
    searchSeeds,
    selectRankedSeed,
    getPreparedSource,
    rememberPreparedSource
  };
}

function generateRandomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}
