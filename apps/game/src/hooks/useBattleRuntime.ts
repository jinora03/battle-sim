import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from 'react';
import type { AppSettings } from '@kinetic/platform';
import type { ReleaseView } from '../ReleaseHome';
import {
  BattleRuntime,
  type RuntimeDiagnostics,
  type RuntimeMetaCallbacks
} from '../runtime/BattleRuntime';
import type { BattleSetup } from '../runtime/BattleSetup';
import {
  battleIntroDurationMs,
  battleLaunchPausesSimulation,
  type BattleLaunchPhase
} from '../ui/battleLaunch';
import { shouldPauseBattle } from '../ui/presentation';

const initialDiagnostics: RuntimeDiagnostics = {
  tick: 0,
  checksum: '--------',
  battleEnded: false,
  winningTeam: null,
  result: null,
  entities: [],
  obstacles: [],
  objective: { kind: 'elimination', label: 'Last team standing', progress: 0, remainingTicks: null },
  stats: {},
  achievements: [],
  replayFrames: 0,
  replayCommands: 0,
  replayStoredCommands: 0,
  replayCompressionRatio: 0,
  recentSkills: [],
  recentArenaActivity: [],
  recentAbilityRejection: null,
  playerEntityIds: [],
  simulationMetrics: {
    activeEntities: 0,
    commandsProcessed: 0,
    candidatePairs: 0,
    contactsResolved: 0,
    sameTeamContacts: 0,
    occupiedBroadphaseCells: 0,
    maxBroadphaseBucket: 0,
    projectileEntityChecks: 0,
    projectileObstacleChecks: 0,
    invalidNumericStates: 0
  },
  renderDiagnostics: {
    lod: 'hero',
    fighterViews: 0,
    pooledFighterViews: 0,
    createdFighterViews: 0,
    reusedFighterViews: 0,
    particleScale: 1,
    activeParticles: 0,
    vfxQuality: 'high',
    groundMarks: 0,
    residualParticles: 0,
    weaponEffects: 0,
    projectileTrails: 0,
    qualityScale: 1,
    resolution: 1,
    devicePixelRatio: 1,
    renderScale: 1,
    cssWidth: 1,
    cssHeight: 1,
    pixelWidth: 1,
    pixelHeight: 1,
    orientation: 'landscape',
    resizeCount: 0,
    contextLost: false,
    renderTier: 'full',
    targetRenderFps: 60,
    presentationEvents: 0,
    projectileVisuals: 0
  },
  audioDiagnostics: { eventsConsidered: 0, eventsSelected: 0, activeVoices: 0, voiceLimit: 22 },
  performance: {
    simulationMs: 0,
    aiMs: 0,
    playerInputMs: 0,
    replayMs: 0,
    simulationCoreMs: 0,
    snapshotMs: 0,
    postSimulationMs: 0,
    diagnosticsMs: 0,
    renderMs: 0,
    frameMs: 0,
    simulationP95Ms: 0,
    renderP95Ms: 0,
    frameP95Ms: 0,
    renderFps: 0,
    qualityScale: 1,
    slowFrames: 0,
    droppedSimulationTicks: 0,
    longFrameStreak: 0,
    stepsLastFrame: 0,
    pressure: 'healthy',
    bottleneck: 'balanced'
  },
  teams: [],
  aiDecisions: [],
  aiWorkload: {
    aiEntities: 0,
    reactionRefreshes: 0,
    attackEvaluations: 0,
    aimRefreshes: 0,
    clusterRefreshes: 0,
    hostileQueries: 0,
    areaCandidateChecks: 0,
    reactionIntervalFloor: 1,
    attackDecisionInterval: 1,
    aimRefreshInterval: 1,
    clusterRefreshInterval: 1
  }
};

interface InitialRuntimeConfiguration {
  seed: number;
  settings: AppSettings;
  setup: BattleSetup;
  metaCallbacks: RuntimeMetaCallbacks;
  unlockedAchievementIds: readonly string[];
}

export interface UseBattleRuntimeOptions {
  initialSeed: number;
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  view: ReleaseView;
  activeSetup: BattleSetup;
  difficulty: BattleSetup['difficulty'];
  unlockedAchievementIds: readonly string[];
  touchControlsVisible: boolean;
  pausedByUser: boolean;
  battleLaunchPhase: BattleLaunchPhase;
  setBattleLaunchPhase: Dispatch<SetStateAction<BattleLaunchPhase>>;
  metaCallbacks: RuntimeMetaCallbacks;
}

export interface BattleRuntimeController {
  runtimeRef: RefObject<BattleRuntime | null>;
  diagnostics: RuntimeDiagnostics;
  ready: boolean;
  bootError: string | null;
  pausedBySystem: boolean;
  attachBattleHost(node: HTMLDivElement | null): void;
  restartBattleWhenReady(seed: number, setup: BattleSetup): void;
  retryBoot(): void;
}

export function useBattleRuntime(options: UseBattleRuntimeOptions): BattleRuntimeController {
  const {
    initialSeed,
    settings,
    setSettings,
    view,
    activeSetup,
    difficulty,
    unlockedAchievementIds,
    touchControlsVisible,
    pausedByUser,
    battleLaunchPhase,
    setBattleLaunchPhase,
    metaCallbacks
  } = options;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<BattleRuntime | null>(null);
  const runtimeBootRef = useRef<Promise<void> | null>(null);
  const runtimeReadyRef = useRef(false);
  const pendingBattleRef = useRef<{ seed: number; setup: BattleSetup } | null>(null);
  const initialConfigurationRef = useRef<InitialRuntimeConfiguration>({
    seed: initialSeed,
    settings,
    setup: { ...activeSetup, difficulty },
    metaCallbacks,
    unlockedAchievementIds
  });

  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics>(initialDiagnostics);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [pausedBySystem, setPausedBySystem] = useState(false);

  const battlePaused = shouldPauseBattle(pausedByUser, pausedBySystem)
    || battleLaunchPausesSimulation(battleLaunchPhase)
    || view !== 'battle';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const initial = initialConfigurationRef.current;
    const runtime = new BattleRuntime(
      host,
      initial.seed,
      initial.settings,
      setDiagnostics,
      initial.setup,
      initial.metaCallbacks,
      initial.unlockedAchievementIds
    );
    runtimeRef.current = runtime;
    return () => {
      setReady(false);
      runtimeBootRef.current = null;
      runtimeReadyRef.current = false;
      pendingBattleRef.current = null;
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    runtimeRef.current?.setPointerAimEnabled(!touchControlsVisible);
  }, [touchControlsVisible]);

  useEffect(() => {
    const strength = { off: 0, light: 0.35, medium: 0.6, strong: 0.9 } as const;
    runtimeRef.current?.setAimAssist(strength[settings.aimAssist]);
  }, [settings.aimAssist]);

  useEffect(() => {
    if (!settings.audio) return;
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void runtimeRef.current?.enableAudio().catch(() => {
        unlocked = false;
      });
    };
    window.setTimeout(unlock, 0);
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [settings.audio]);

  useEffect(() => {
    const handleVisibility = () => setPausedBySystem(document.visibilityState !== 'visible');
    const handlePageHide = () => setPausedBySystem(true);
    const handlePageShow = () => setPausedBySystem(document.visibilityState !== 'visible');
    const handleFullscreen = () => {
      setSettings((current) => ({ ...current, fullscreenBattle: Boolean(document.fullscreenElement) }));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [setSettings]);

  useEffect(() => {
    runtimeRef.current?.setPaused(battlePaused);
  }, [battlePaused]);

  useEffect(() => {
    let settleTimer = 0;
    const refresh = () => {
      runtimeRef.current?.refreshRendererLayout();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => runtimeRef.current?.refreshRendererLayout(), 220);
    };
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
    window.visualViewport?.addEventListener('resize', refresh, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    if (view !== 'battle' || battleLaunchPhase !== 'intro') return;
    const timer = window.setTimeout(
      () => setBattleLaunchPhase('running'),
      battleIntroDurationMs(settings.reducedMotion)
    );
    return () => window.clearTimeout(timer);
  }, [battleLaunchPhase, setBattleLaunchPhase, settings.reducedMotion, view]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (view !== 'battle') {
      runtime.setActive(false);
      return;
    }

    let cancelled = false;
    let layoutFrame = 0;
    const afterVisibleLayout = () => new Promise<void>((resolve, reject) => {
      const check = (attempt: number) => {
        layoutFrame = window.requestAnimationFrame(() => {
          if (cancelled) {
            resolve();
            return;
          }
          const host = hostRef.current;
          const rect = host?.getBoundingClientRect();
          const width = rect?.width || host?.clientWidth || 0;
          const height = rect?.height || host?.clientHeight || 0;
          if (host?.isConnected && width >= 32 && height >= 32) {
            resolve();
            return;
          }
          if (attempt >= 40) {
            reject(new Error('The battle arena is still waiting for a visible layout.'));
            return;
          }
          check(attempt + 1);
        });
      };
      check(0);
    });

    const boot = async () => {
      setReady(false);
      setBootError(null);
      await afterVisibleLayout();
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) throw new Error('Battle arena host is not available.');
      runtime.attachHost(host);
      runtime.setActive(true);
      const bootPromise = runtimeBootRef.current ?? runtime.start();
      runtimeBootRef.current = bootPromise;
      await bootPromise;
      if (cancelled) return;
      const currentHost = hostRef.current;
      if (currentHost) runtime.attachHost(currentHost);
      runtime.setActive(true);
      runtimeReadyRef.current = true;
      const pending = pendingBattleRef.current;
      if (pending) {
        pendingBattleRef.current = null;
        runtime.restart(pending.seed, pending.setup);
      }
      setReady(true);
    };

    void boot().catch((reason: unknown) => {
      if (cancelled) return;
      runtimeBootRef.current = null;
      runtimeReadyRef.current = false;
      setReady(false);
      setBootError(reason instanceof Error ? reason.message : 'Battle renderer failed to start.');
    });

    return () => {
      cancelled = true;
      if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
      runtime.setActive(false);
    };
  }, [bootAttempt, view]);

  useEffect(() => {
    if (!bootError) return;
    let done = false;
    const retry = () => {
      if (done) return;
      done = true;
      setBootAttempt((attempt) => attempt + 1);
    };
    const timer = window.setTimeout(retry, 700);
    window.addEventListener('resize', retry, { passive: true });
    window.addEventListener('orientationchange', retry, { passive: true });
    window.visualViewport?.addEventListener('resize', retry, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', retry);
      window.removeEventListener('orientationchange', retry);
      window.visualViewport?.removeEventListener('resize', retry);
    };
  }, [bootError]);

  useEffect(() => {
    runtimeRef.current?.setUnlockedAchievements(unlockedAchievementIds);
  }, [unlockedAchievementIds]);

  const attachBattleHost = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node;
    if (node) runtimeRef.current?.attachHost(node);
  }, []);

  const restartBattleWhenReady = useCallback((seed: number, setup: BattleSetup) => {
    const runtime = runtimeRef.current;
    if (!runtimeReadyRef.current || !runtime) {
      pendingBattleRef.current = { seed, setup };
      return;
    }
    runtime.restart(seed, setup);
  }, []);

  const retryBoot = useCallback(() => {
    setBootAttempt((attempt) => attempt + 1);
  }, []);

  return {
    runtimeRef,
    diagnostics,
    ready,
    bootError,
    pausedBySystem,
    attachBattleHost,
    restartBattleWhenReady,
    retryBoot
  };
}
