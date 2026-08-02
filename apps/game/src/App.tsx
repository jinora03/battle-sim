import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
  type SyntheticEvent
} from 'react';
import {
  ATTACK_FORM_BEHAVIORS,
  getAbility,
  getAbilityActivationProfile,
  getFighter,
  getFighterModule,
  getPrimaryAttack,
  getPrimaryAttackActivationProfile,
  isCustomFighter,
  listAbilities,
  listAiProfiles,
  listArenas,
  listCompatibleModules,
  listFighters,
  listGameModes,
  listPrimaryAttacks,
  removeCustomFighter,
  type AttackForm,
  type FighterDefinition,
  type PrimaryAttackDefinition,
  type GameModeDefinition
} from '@kinetic/content';
import {
  parseFighterBundle,
  registerFighterBundle,
  serializeFighterBundle,
  slugifyFighterId,
  validateFighterBundle,
  type FighterBundle
} from '@kinetic/creator';
import {
  applyAchievementToProfile,
  createDefaultPlayerProfile,
  parsePlayerProfile,
  recordBattleToProfile,
  removeBattlePreset,
  unlockAllFightersForTesting,
  upsertBattlePreset,
  type AchievementUnlock,
  type BattleCompletionSummary,
  type PlayerProfile,
  type ProgressionNotice,
  type SavedBattlePreset
} from '@kinetic/meta';
import type { AbilitySlot, AbilityStateSnapshot, ControllerKind, Element, EntitySnapshot, ModuleSlot, Vec2 } from '@kinetic/protocol';
import {
  applyQualityPreset,
  detectDeviceCapabilities,
  detectViewportMetrics,
  qualityPresets,
  shouldShowTouchControls,
  type AppSettings,
  type DeviceCapabilities,
  type ViewportMetrics,
  type QualityPresetId,
  type TouchControlMode,
  type MovementMode,
  type AimAssistLevel
} from '@kinetic/platform';
import {
  getMotionRecipe,
  getSkillPresentation,
  getVisualRecipe,
  removeCustomMotionRecipe,
  removeCustomVisualRecipe,
  type MotionRecipe,
  type VisualRecipe
} from '@kinetic/visual-engine';
import { BattleRuntime, type BattleSetup, type RecentSkillActivity, type RuntimeDiagnostics } from './runtime/BattleRuntime';
import { ProfileView } from './ProfileView';
import { loadPlayerProfile, savePlayerProfile } from './profile/ProfileStore';
import { loadAppSettings, resetAppSettings, saveAppSettings } from './settings/SettingsStore';
import { ReleaseHome, type ReleaseView } from './ReleaseHome';
import { RosterView } from './RosterView';
import { TrainingLabView } from './TrainingLabView';
import { AppNavigation, DrawerHeader, DrawerScrim, NeonButton } from './ui/NeonUI';
import { BattleIntroOverlay } from './BattleIntroOverlay';
import { battleIntroDurationMs, battleLaunchPausesSimulation, initialLaunchPhase, type BattleLaunchPhase } from './ui/battleLaunch';
import {
  aggregateActiveCasts,
  formatModeCapacity,
  noticeDurationMs,
  resolveEliminationProgress,
  shouldPauseBattle,
  shouldSuppressNoticeOnCompactViewport,
  type TimedNotice
} from './ui/presentation';

const STORAGE_KEY = 'kinetic.custom-fighter-bundles.v1';
const ELEMENTS: Element[] = ['neutral', 'fire', 'water', 'ice', 'electric', 'metal', 'nature', 'void'];
const SKILL_SLOTS: AbilitySlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];

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
  renderDiagnostics: { lod: 'hero', fighterViews: 0, pooledFighterViews: 0, createdFighterViews: 0, reusedFighterViews: 0, particleScale: 1, activeParticles: 0, vfxQuality: 'high', groundMarks: 0, residualParticles: 0, weaponEffects: 0, projectileTrails: 0, qualityScale: 1, resolution: 1, devicePixelRatio: 1, renderScale: 1, cssWidth: 1, cssHeight: 1, pixelWidth: 1, pixelHeight: 1, orientation: 'landscape', resizeCount: 0, contextLost: false, renderTier: 'full', targetRenderFps: 60, presentationEvents: 0, projectileVisuals: 0 },
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

const DEFAULT_SETUP: BattleSetup = {
  fighterAId: 'gunner',
  fighterBId: 'bomber',
  moduleIdsA: [],
  moduleIdsB: [],
  controllerA: 'player',
  controllerB: 'ai',
  arenaId: 'iron-pit',
  modeId: 'duel',
  teamSizeA: 1,
  teamSizeB: 1,
  friendlyFire: false,
  teamCollision: 'full',
  difficulty: 'standard'
};

const skillKeyMap: Record<string, AbilitySlot> = {
  ' ': 'basic',
  '1': 'basic',
  q: 'skill1',
  '2': 'skill1',
  e: 'skill2',
  '3': 'skill2',
  r: 'skill3',
  '4': 'skill3',
  f: 'ultimate',
  '5': 'ultimate'
};

function createStarterBundle(name = 'Arc Prototype', requestedId?: string): FighterBundle {
  const id = requestedId ?? slugifyFighterId(name);
  return {
    schemaVersion: 2,
    fighter: {
      id,
      name,
      classification: { archetype: 'striker', elements: ['electric'], traits: ['custom', 'experimental'] },
      physics: { radius: 28, mass: 1.25, restitution: 0.94, linearDamping: 0.993, maxSpeed: 12.2 },
      stats: { maxHp: 225, moveAcceleration: 0.2 },
      aiProfileId: 'ranged-gunner',
      abilitySlots: {
        skill1: 'surge-dash',
        skill2: 'kinetic-pulse',
        skill3: 'undertow',
        ultimate: 'reactor-overdrive'
      },
      resistances: { electric: 0.75, metal: 0.9 },
      visualRecipeId: `${id}-visual`,
      animationRecipeId: `${id}-motion`,
      audioProfileId: 'custom-hybrid',
      primaryAttackId: 'arc-emitter'
    },
    visualRecipe: {
      id: `${id}-visual`,
      shape: 'orb',
      bodyColor: 0x6f58dd,
      bodyDarkColor: 0x241b55,
      coreColor: 0xfff26c,
      auraColor: 0xb46cff,
      accentColor: 0x66efff,
      horns: false
    },
    motionRecipe: {
      id: `${id}-motion`,
      speedStretch: 0.17,
      impactSquash: 0.2,
      lean: 0.14,
      pulseAmount: 0.04,
      pulseSpeed: 3.1,
      weaponSpin: 2.2
    }
  };
}

function restoreCustomBundles(): FighterBundle[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as unknown[];
    const restored: FighterBundle[] = [];
    for (const item of Array.isArray(items) ? items : []) {
      try {
        restored.push(registerFighterBundle(item, true));
      } catch {
        // Ignore stale or malformed local content; the creator can import it manually for diagnostics.
      }
    }
    return restored;
  } catch {
    return [];
  }
}

export default function App() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const battleStageRef = useRef<HTMLElement | null>(null);
  const setupPanelRef = useRef<HTMLDetailsElement | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const toastCounterRef = useRef(0);
  const runtimeRef = useRef<BattleRuntime | null>(null);
  const runtimeBootRef = useRef<Promise<void> | null>(null);
  const runtimeReadyRef = useRef(false);
  const pendingBattleRef = useRef<{ seed: number; setup: BattleSetup } | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const appRenderCountRef = useRef(0);
  appRenderCountRef.current += 1;
  const [customBundles, setCustomBundles] = useState<FighterBundle[]>(restoreCustomBundles);
  const [fighterRevision, setFighterRevision] = useState(0);
  const fighters = useMemo(() => listFighters(), [fighterRevision]);
  const abilities = useMemo(() => listAbilities(), []);
  const aiProfiles = useMemo(() => listAiProfiles(), []);
  const primaryAttacks = useMemo(() => listPrimaryAttacks(), []);
  const arenas = useMemo(() => listArenas().filter((arena) => arena.id !== 'training-grid'), []);
  const gameModes = useMemo(() => listGameModes().filter((mode) => mode.id !== 'training'), []);
  const [view, setView] = useState<ReleaseView>('home');
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities);
  const [viewportMetrics, setViewportMetrics] = useState(detectViewportMetrics);
  const [seedText, setSeedText] = useState(() => String(generateRandomSeed()));
  const [setup, setSetup] = useState<BattleSetup>(DEFAULT_SETUP);
  const [activeSetup, setActiveSetup] = useState<BattleSetup>(DEFAULT_SETUP);
  const [setupPanelOpen, setSetupPanelOpen] = useState(true);
  const [perfPanelOpen, setPerfPanelOpen] = useState(true);
  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState(false);
  const [battleDrawerOpen, setBattleDrawerOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics>(initialDiagnostics);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [pausedBySystem, setPausedBySystem] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [battleLaunchPhase, setBattleLaunchPhase] = useState<BattleLaunchPhase>('ready');
  const [draft, setDraft] = useState<FighterBundle>(() => customBundles[0] ?? createStarterBundle());
  const [creatorMessage, setCreatorMessage] = useState('Edit the recipe, validate it, then save or test the fighter.');
  const [importText, setImportText] = useState('');
  const [sourceFighterId, setSourceFighterId] = useState('water-shaper');
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const profileRef = useRef(profile);
  const [progressNotices, setProgressNotices] = useState<ProgressionNotice[]>([]);
  const [toastNotices, setToastNotices] = useState<TimedNotice[]>([]);

  const validation = useMemo(() => validateFighterBundle(draft), [draft]);
  const activeCasts = diagnostics.entities.flatMap((entity) =>
    entity.abilities
      .filter((ability) => ability.phase === 'casting')
      .map((ability) => ({ entity, ability }))
  );
  const playerEntity = diagnostics.entities.find((entity) => entity.controller === 'player');
  const configuredArena = arenas.find((arena) => arena.id === setup.arenaId) ?? arenas[0];
  const configuredMode = gameModes.find((mode) => mode.id === setup.modeId) ?? gameModes[0];
  const configuredFighterA = getFighter(setup.fighterAId);
  const configuredFighterB = getFighter(setup.fighterBId);
  const activeArena = arenas.find((arena) => arena.id === activeSetup.arenaId) ?? configuredArena;
  const activeMode = gameModes.find((mode) => mode.id === activeSetup.modeId) ?? configuredMode;
  const introSetup = battleLaunchPhase === 'ready' ? setup : activeSetup;
  const introFighterA = getFighter(introSetup.fighterAId);
  const introFighterB = getFighter(introSetup.fighterBId);
  const introMode = gameModes.find((mode) => mode.id === introSetup.modeId) ?? configuredMode;
  const setupDirty = !sameBattleSetup(setup, activeSetup);
  const activeSkillEntries = activeCasts.map(({ entity, ability }) => {
    const presentation = activityPresentation(ability.abilityId, ability.source === 'primaryAttack');
    return {
      entityId: entity.id,
      fighterName: getFighter(entity.fighterId).name,
      abilityId: ability.abilityId,
      abilityName: presentation.shortName,
      icon: presentation.icon,
      color: presentation.color,
      importance: presentation.importance,
      slot: ability.slot,
      progress: ability.castTotalTicks > 0 ? 1 - ability.castRemainingTicks / ability.castTotalTicks : 1
    };
  });
  const activeSkillKeys = new Set(activeSkillEntries.map((entry) => `${entry.entityId}:${entry.abilityId}`));
  const recentSkillEntries = diagnostics.recentSkills
    .filter((entry) => !activeSkillKeys.has(`${entry.entityId}:${entry.abilityId}`))
    .map((entry) => {
      const presentation = activityPresentation(entry.abilityId, entry.slot === 'basic');
      const fighterName = fighters.find((fighter) => fighter.id === entry.fighterId)?.name ?? `Fighter #${entry.entityId}`;
      return {
        entityId: entry.entityId,
        fighterName,
        abilityId: entry.abilityId,
        abilityName: presentation.shortName,
        icon: presentation.icon,
        color: presentation.color,
        importance: presentation.importance,
        slot: entry.slot,
        progress: 1
      };
    });
  const skillActivity = aggregateActiveCasts([...activeSkillEntries, ...recentSkillEntries], diagnostics.entities.length > 24 ? 2 : 3);
  const resultPresentation = describeBattleResult(diagnostics, activeMode);
  const eliminationProgress = useMemo(() => resolveEliminationProgress(diagnostics.teams), [diagnostics.teams]);
  const battlePaused = shouldPauseBattle(pausedByUser, pausedBySystem)
    || battleLaunchPausesSimulation(battleLaunchPhase)
    || view !== 'battle';
  const touchControlsVisible = shouldShowTouchControls(settings.touchControls, deviceCapabilities);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customBundles));
  }, [customBundles]);

  useEffect(() => {
    profileRef.current = profile;
    savePlayerProfile(profile);
  }, [profile]);

  useEffect(() => {
    saveAppSettings(settings);
    document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.touchSize = settings.largeTouchControls ? 'large' : 'normal';
  }, [settings]);


  useEffect(() => {
    let refreshRaf = 0;
    const refreshEnvironment = () => {
      if (refreshRaf !== 0) return;
      refreshRaf = window.requestAnimationFrame(() => {
        refreshRaf = 0;
        const nextCapabilities = detectDeviceCapabilities();
        const nextViewport = detectViewportMetrics();
        setDeviceCapabilities((current) => sameDeviceCapabilities(current, nextCapabilities) ? current : nextCapabilities);
        setViewportMetrics((current) => sameViewportMetrics(current, nextViewport) ? current : nextViewport);
      });
    };
    const queries = [
      window.matchMedia?.('(pointer: coarse)'),
      window.matchMedia?.('(any-pointer: coarse)'),
      window.matchMedia?.('(hover: hover)'),
      window.matchMedia?.('(display-mode: standalone)')
    ].filter((query): query is MediaQueryList => Boolean(query));
    window.addEventListener('resize', refreshEnvironment, { passive: true });
    window.addEventListener('orientationchange', refreshEnvironment, { passive: true });
    window.visualViewport?.addEventListener('resize', refreshEnvironment, { passive: true });
    document.addEventListener('fullscreenchange', refreshEnvironment);
    for (const query of queries) query.addEventListener?.('change', refreshEnvironment);
    refreshEnvironment();
    return () => {
      if (refreshRaf !== 0) window.cancelAnimationFrame(refreshRaf);
      window.removeEventListener('resize', refreshEnvironment);
      window.removeEventListener('orientationchange', refreshEnvironment);
      window.visualViewport?.removeEventListener('resize', refreshEnvironment);
      document.removeEventListener('fullscreenchange', refreshEnvironment);
      for (const query of queries) query.removeEventListener?.('change', refreshEnvironment);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.orientation = viewportMetrics.orientation;
    document.documentElement.dataset.viewport = viewportMetrics.viewportClass;
    document.documentElement.dataset.shortLandscape = viewportMetrics.shortLandscape ? 'true' : 'false';
    document.documentElement.dataset.touchFirst = deviceCapabilities.touchFirst ? 'true' : 'false';
  }, [deviceCapabilities.touchFirst, viewportMetrics]);


  useEffect(() => {
    if (view !== 'battle') setBattleDrawerOpen(false);
  }, [view]);

  useEffect(() => {
    if (!battleDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBattleDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [battleDrawerOpen]);

  useEffect(() => {
    setSetup((current) => current.difficulty === profile.difficulty ? current : { ...current, difficulty: profile.difficulty });
  }, [profile.difficulty]);

  useEffect(() => () => {
    for (const timer of toastTimersRef.current) window.clearTimeout(timer);
    toastTimersRef.current = [];
  }, []);

  const appendNotices = (items: readonly ProgressionNotice[]) => {
    if (items.length === 0) return;
    setProgressNotices((current) => [...current, ...items].slice(-12));
    const now = Date.now();
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const visible = items
      .filter((notice) => !shouldSuppressNoticeOnCompactViewport(notice.kind, viewportWidth))
      .map((notice) => {
        const id = ++toastCounterRef.current;
        const duration = noticeDurationMs(notice.kind);
        return { ...notice, id, createdAt: now, expiresAt: now + duration };
      });
    if (visible.length === 0) return;
    setToastNotices((current) => [...current, ...visible].slice(-4));
    for (const notice of visible) {
      const timer = window.setTimeout(() => {
        setToastNotices((current) => current.filter((item) => item.id !== notice.id));
      }, Math.max(500, notice.expiresAt - now));
      toastTimersRef.current.push(timer);
    }
  };

  const onAchievementUnlocked = (unlock: AchievementUnlock) => {
    const update = applyAchievementToProfile(profileRef.current, unlock);
    profileRef.current = update.profile;
    setProfile(update.profile);
    appendNotices(update.notices);
  };

  const onBattleCompleted = (summary: BattleCompletionSummary) => {
    const update = recordBattleToProfile(profileRef.current, summary);
    profileRef.current = update.profile;
    setProfile(update.profile);
    appendNotices(update.notices);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const runtime = new BattleRuntime(
      host,
      Number(seedText) || 1,
      settings,
      setDiagnostics,
      { ...activeSetup, difficulty: profile.difficulty },
      { onAchievementUnlocked, onBattleCompleted },
      profile.unlockedAchievementIds
    );
    runtimeRef.current = runtime;
    runtime.setDetailedDiagnosticsEnabled(settings.showPerformanceHud);
    return () => {
      setReady(false);
      runtimeBootRef.current = null;
      runtimeReadyRef.current = false;
      pendingBattleRef.current = null;
      runtime.destroy();
      runtimeRef.current = null;
    };
    // Runtime owns its lifetime. Updates use explicit methods below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    runtimeRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    runtimeRef.current?.setDetailedDiagnosticsEnabled(settings.showPerformanceHud);
  }, [settings.showPerformanceHud]);

  useEffect(() => {
    // Touch devices have no cursor: hide the aim crosshair and steer/aim from the stick.
    runtimeRef.current?.setPointerAimEnabled(!touchControlsVisible);
  }, [touchControlsVisible]);

  useEffect(() => {
    const strength: Record<AimAssistLevel, number> = { off: 0, light: 0.35, medium: 0.6, strong: 0.9 };
    runtimeRef.current?.setAimAssist(strength[settings.aimAssist]);
  }, [settings.aimAssist]);

  useEffect(() => {
    if (!settings.audio) return;
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void runtimeRef.current?.enableAudio().catch(() => { unlocked = false; });
    };
    // Attempt immediately for browsers that permit it, then transparently
    // retry on the first pointer or keyboard gesture when autoplay is blocked.
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
    const handleFullscreen = () => setSettings((current) => ({ ...current, fullscreenBattle: Boolean(document.fullscreenElement) }));
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
  }, []);

  useEffect(() => {
    runtimeRef.current?.setPaused(battlePaused);
  }, [battlePaused]);

  useEffect(() => {
    if (view !== 'battle' || battleLaunchPhase !== 'intro') return;
    const timer = window.setTimeout(
      () => setBattleLaunchPhase('running'),
      battleIntroDurationMs(settings.reducedMotion)
    );
    return () => window.clearTimeout(timer);
  }, [battleLaunchPhase, settings.reducedMotion, view]);

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
  }, [view, bootAttempt]);

  // Auto-recover from a renderer boot failure (e.g. a landscape rotation where the
  // arena layout wasn't ready yet): retry once the layout settles or resizes.
  useEffect(() => {
    if (!bootError) return;
    let done = false;
    const retry = () => { if (done) return; done = true; setBootAttempt((attempt) => attempt + 1); };
    const timer = window.setTimeout(retry, 700);
    window.addEventListener('resize', retry, { passive: true });
    window.addEventListener('orientationchange', retry, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', retry);
      window.removeEventListener('orientationchange', retry);
    };
  }, [bootError]);

  useEffect(() => {
    runtimeRef.current?.setUnlockedAchievements(profile.unlockedAchievementIds);
  }, [profile.unlockedAchievementIds]);

  useEffect(() => {
    const updateMovement = () => {
      if (settings.movementMode !== 'wasd') {
        runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
        return;
      }
      const keys = pressedKeysRef.current;
      const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      runtimeRef.current?.setPlayerMovement({ x, y });
    };
    const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || view !== 'battle' || battleLaunchPhase !== 'running') return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (settings.movementMode === 'wasd') {
          event.preventDefault();
          pressedKeysRef.current.add(key);
          updateMovement();
        }
      }
      const slot = skillKeyMap[key];
      if (slot && !event.repeat) {
        event.preventDefault();
        runtimeRef.current?.activatePlayerAbility(slot);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      pressedKeysRef.current.delete(key);
      updateMovement();
    };
    const stop = () => {
      pressedKeysRef.current.clear();
      runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stop);
    };
  }, [battleLaunchPhase, settings.movementMode, view]);

  const restartBattleWhenReady = (seed: number, nextSetup: BattleSetup) => {
    const runtime = runtimeRef.current;
    if (!runtimeReadyRef.current || !runtime) {
      pendingBattleRef.current = { seed, setup: nextSetup };
      return;
    }
    runtime.restart(seed, nextSetup);
  };

  const prepareBattleForStart = (seed: number, nextSetup: BattleSetup) => {
    setSeedText(String(seed));
    setActiveSetup(nextSetup);
    setPausedByUser(false);
    setBattleLaunchPhase('ready');
    restartBattleWhenReady(seed, nextSetup);
  };

  const launchBattle = (seed: number, nextSetup: BattleSetup) => {
    setSeedText(String(seed));
    setActiveSetup(nextSetup);
    setPausedByUser(false);
    restartBattleWhenReady(seed, nextSetup);
    setBattleLaunchPhase(initialLaunchPhase(settings.showBattleIntros));
  };

  const replaySameBattle = () => {
    launchBattle(Number(seedText) || 1, activeSetup);
  };

  const startNewBattle = (nextSetup: BattleSetup = setup) => {
    launchBattle(generateRandomSeed(), nextSetup);
  };

  const startRandomMatchup = () => {
    const available = fighters.filter((fighter) => isCustomFighter(fighter.id) || profile.unlockedFighterIds.includes(fighter.id));
    const randomSeed = generateRandomSeed();
    const pick = (offset: number) => available[(randomSeed + offset * 2654435761) % Math.max(1, available.length)]?.id;
    const compatibleArenas = arenas.filter((arena) => arena.allowedModes.includes(setup.modeId));
    const next: BattleSetup = {
      ...setup,
      fighterAId: pick(1) ?? setup.fighterAId,
      fighterBId: pick(2) ?? setup.fighterBId,
      moduleIdsA: [],
      moduleIdsB: [],
      arenaId: compatibleArenas[(randomSeed >>> 8) % Math.max(1, compatibleArenas.length)]?.id ?? setup.arenaId
    };
    if (next.fighterAId === next.fighterBId && available.length > 1) next.fighterBId = pick(3) ?? next.fighterBId;
    setSetup(next);
    launchBattle(randomSeed, next);
  };
  const returnToSetup = () => {
    setSetupPanelOpen(true);
    window.setTimeout(() => setupPanelRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'start' }), 0);
  };

  const updateSetup = (patch: Partial<BattleSetup>) => {
    const next: BattleSetup = { ...setup, ...patch };
    if (patch.modeId) {
      const compatible = arenas.filter((arena) => arena.allowedModes.includes(patch.modeId!));
      if (!compatible.some((arena) => arena.id === next.arenaId)) next.arenaId = compatible[0]?.id ?? next.arenaId;
      if (patch.modeId === 'duel') { next.teamSizeA = 1; next.teamSizeB = 1; }
      else if (patch.modeId === 'team-battle') { next.teamSizeA = Math.max(2, next.teamSizeA); next.teamSizeB = Math.max(2, next.teamSizeB); next.teamCollision = 'soft'; }
      else if (patch.modeId === 'mass-skirmish') { next.teamSizeA = Math.max(5, next.teamSizeA); next.teamSizeB = Math.max(5, next.teamSizeB); next.teamCollision = 'soft'; }
      else if (patch.modeId === 'battle-royale') { next.teamSizeA = Math.max(2, next.teamSizeA); next.teamSizeB = Math.max(1, next.teamSizeB); }
      else if (patch.modeId === 'boss-raid') { next.teamSizeA = Math.max(2, next.teamSizeA); next.teamSizeB = 1; }
      else { next.teamSizeA = 1; next.teamSizeB = Math.max(3, next.teamSizeB); }
    }
    if (patch.arenaId) {
      const arena = arenas.find((item) => item.id === patch.arenaId);
      if (arena && !arena.allowedModes.includes(next.modeId)) next.modeId = arena.allowedModes[0] ?? next.modeId;
    }
    setSetup(next);
  };

  const setController = (side: 'A' | 'B', controller: ControllerKind) => {
    if (side === 'A') {
      updateSetup({ controllerA: controller, ...(controller === 'player' ? { controllerB: 'ai' as const } : {}) });
    } else {
      updateSetup({ controllerB: controller, ...(controller === 'player' ? { controllerA: 'ai' as const } : {}) });
    }
  };

  const setFighter = (side: 'A' | 'B', fighterId: string) => {
    if (side === 'A') updateSetup({ fighterAId: fighterId, moduleIdsA: [] });
    else updateSetup({ fighterBId: fighterId, moduleIdsB: [] });
  };

  const setFighterModule = (side: 'A' | 'B', slot: ModuleSlot, moduleId: string) => {
    const currentIds = side === 'A' ? setup.moduleIdsA : setup.moduleIdsB;
    const nextIds = currentIds.filter((id) => safeModuleSlot(id) !== slot);
    if (moduleId) nextIds.push(moduleId);
    if (side === 'A') updateSetup({ moduleIdsA: nextIds });
    else updateSetup({ moduleIdsB: nextIds });
  };

  const applyTypedSeed = () => {
    launchBattle(Number(seedText) || 1, setup);
  };

  const toggleBattlePaused = () => {
    if (diagnostics.battleEnded || battleLaunchPhase !== 'running') return;
    setPausedByUser((current) => !current);
  };

  const enableAudio = async () => {
    try {
      await runtimeRef.current?.enableAudio();
      setSettings((current) => ({ ...current, audio: true }));
    } catch {
      // Browsers may reject audio until a direct gesture. The one-time gesture
      // listener below retries without interrupting the battle.
    }
  };

  const exportReplay = () => {
    const json = runtimeRef.current?.exportReplay();
    if (!json) return;
    downloadText(json, `kinetic-replay-${seedText}.json`);
  };

  const updateAppSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value, qualityPreset: 'custom' }));
  };

  const selectQualityPreset = (preset: QualityPresetId) => {
    setSettings((current) => applyQualityPreset(current, preset, detectDeviceCapabilities()));
  };

  const restoreRecommendedSettings = () => {
    const restored = resetAppSettings();
    setSettings(restored);
  };

  const toggleFullscreenBattle = async () => {
    const target = battleStageRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch (error) {
      appendNotices([{ kind: 'battle', title: 'Fullscreen unavailable', description: error instanceof Error ? error.message : 'The browser declined fullscreen mode.' }]);
    }
  };

  const saveDraft = (): FighterBundle | null => {
    const result = validateFighterBundle(draft);
    if (!result.success || !result.bundle) {
      setCreatorMessage(`Cannot save: ${result.errors.join(' · ')}`);
      return null;
    }
    try {
      const saved = registerFighterBundle(result.bundle, isCustomFighter(result.bundle.fighter.id));
      setCustomBundles((current) => [...current.filter((item) => item.fighter.id !== saved.fighter.id), saved]);
      setFighterRevision((value) => value + 1);
      setCreatorMessage(`${saved.fighter.name} saved and registered in the running content registry.`);
      return saved;
    } catch (error) {
      setCreatorMessage(error instanceof Error ? error.message : 'Could not register fighter.');
      return null;
    }
  };

  const openPreparedBattle = (next: BattleSetup) => {
    const seed = generateRandomSeed();
    setSetup(next);
    prepareBattleForStart(seed, next);
    setView('battle');
  };

  const testDraft = () => {
    const saved = saveDraft();
    if (!saved) return;
    const next: BattleSetup = { ...setup, fighterAId: saved.fighter.id, moduleIdsA: [], controllerA: 'player', controllerB: 'ai' };
    openPreparedBattle(next);
  };

  const exportDraft = () => {
    if (!validation.success || !validation.bundle) {
      setCreatorMessage(`Cannot export: ${validation.errors.join(' · ')}`);
      return;
    }
    downloadText(serializeFighterBundle(validation.bundle), `${validation.bundle.fighter.id}.fighter.json`);
  };

  const importBundle = () => {
    const result = parseFighterBundle(importText);
    if (!result.success || !result.bundle) {
      setCreatorMessage(`Import failed: ${result.errors.join(' · ')}`);
      return;
    }
    setDraft(result.bundle);
    setCreatorMessage(`${result.bundle.fighter.name} loaded into the editor. Save to register it.`);
  };

  const duplicateFighter = () => {
    const source = getFighter(sourceFighterId);
    const id = uniqueCustomId(`${source.id}-custom`, fighters.map((fighter) => fighter.id));
    setDraft({
      schemaVersion: 2,
      fighter: {
        ...structuredClone(source),
        id,
        name: `${source.name} Custom`,
        classification: { ...source.classification, traits: [...source.classification.traits, 'custom'] },
        visualRecipeId: `${id}-visual`,
        animationRecipeId: `${id}-motion`
      },
      visualRecipe: { ...getVisualRecipe(source.visualRecipeId), id: `${id}-visual` },
      motionRecipe: { ...getMotionRecipe(source.animationRecipeId), id: `${id}-motion` }
    });
    setCreatorMessage(`Duplicated ${source.name}. Its definition is independent from the built-in fighter.`);
  };

  const deleteDraft = () => {
    const id = draft.fighter.id;
    if (!isCustomFighter(id)) {
      setCreatorMessage('Only custom fighters can be deleted.');
      return;
    }
    const nextSetup: BattleSetup = {
      ...setup,
      fighterAId: setup.fighterAId === id ? 'water-shaper' : setup.fighterAId,
      fighterBId: setup.fighterBId === id ? 'bomber' : setup.fighterBId,
      moduleIdsA: setup.fighterAId === id ? [] : setup.moduleIdsA,
      moduleIdsB: setup.fighterBId === id ? [] : setup.moduleIdsB
    };
    removeCustomFighter(id);
    removeCustomVisualRecipe(draft.visualRecipe.id);
    removeCustomMotionRecipe(draft.motionRecipe.id);
    setCustomBundles((current) => current.filter((item) => item.fighter.id !== id));
    setFighterRevision((value) => value + 1);
    setSetup(nextSetup);
    prepareBattleForStart(generateRandomSeed(), nextSetup);
    setDraft(createStarterBundle());
    setCreatorMessage(`Deleted custom fighter ${id}.`);
  };

  const syncIdentity = (name: string, idText?: string) => {
    const id = slugifyFighterId(idText ?? name);
    setDraft((current) => ({
      ...current,
      fighter: { ...current.fighter, id, name, visualRecipeId: `${id}-visual`, animationRecipeId: `${id}-motion` },
      visualRecipe: { ...current.visualRecipe, id: `${id}-visual` },
      motionRecipe: { ...current.motionRecipe, id: `${id}-motion` }
    }));
  };

  const saveCurrentLoadout = (name: string) => {
    setProfile((current) => upsertBattlePreset(current, { ...setup, name, difficulty: current.difficulty }));
    appendNotices([{ kind: 'battle', title: 'Loadout saved', description: name }]);
  };

  const applyLoadout = (preset: SavedBattlePreset) => {
    const next: BattleSetup = {
      fighterAId: preset.fighterAId,
      fighterBId: preset.fighterBId,
      moduleIdsA: [...preset.moduleIdsA],
      moduleIdsB: [...preset.moduleIdsB],
      controllerA: preset.controllerA,
      controllerB: preset.controllerB,
      arenaId: preset.arenaId,
      modeId: preset.modeId,
      teamSizeA: preset.teamSizeA,
      teamSizeB: preset.teamSizeB,
      friendlyFire: preset.friendlyFire,
      teamCollision: preset.teamCollision,
      difficulty: preset.difficulty
    };
    setProfile((current) => ({ ...current, difficulty: preset.difficulty, selectedLoadoutId: preset.id, updatedAt: Date.now() }));
    openPreparedBattle(next);
  };

  const importProfile = (json: string) => {
    try {
      const imported = parsePlayerProfile(json);
      setProfile(imported);
      const safeSetup = { ...setup, difficulty: imported.difficulty };
      setSetup(safeSetup);
      runtimeRef.current?.setUnlockedAchievements(imported.unlockedAchievementIds);
      appendNotices([{ kind: 'battle', title: 'Profile imported', description: `${imported.displayName} · Level ${imported.level}` }]);
    } catch (error) {
      appendNotices([{ kind: 'battle', title: 'Import failed', description: error instanceof Error ? error.message : 'Invalid profile JSON.' }]);
    }
  };

  const resetProfile = () => {
    const fresh = createDefaultPlayerProfile();
    const next = { ...DEFAULT_SETUP, difficulty: fresh.difficulty };
    setProfile(fresh);
    setSetup(next);
    setProgressNotices([]);
    setToastNotices([]);
    appendNotices([{ kind: 'battle', title: 'Progression reset', description: 'A fresh local profile was created.' }]);
    openPreparedBattle(next);
  };

  const launchReleaseBattle = (next: BattleSetup) => {
    openPreparedBattle(next);
  };

  const playAsFighter = (fighterId: string) => launchReleaseBattle({
    ...setup,
    fighterAId: fighterId,
    moduleIdsA: [],
    controllerA: 'player',
    controllerB: 'ai',
    modeId: 'duel',
    arenaId: setup.arenaId === 'war-basin' ? 'pillar-court' : setup.arenaId,
    teamSizeA: 1,
    teamSizeB: 1
  });

  const setRosterOpponent = (fighterId: string) => launchReleaseBattle({
    ...setup,
    fighterBId: fighterId,
    moduleIdsB: [],
    controllerA: 'player',
    controllerB: 'ai',
    modeId: 'duel',
    arenaId: setup.arenaId === 'war-basin' ? 'pillar-court' : setup.arenaId,
    teamSizeA: 1,
    teamSizeB: 1
  });

  const movePlayer = (direction: Vec2) => {
    if (battleLaunchPhase !== 'running') return;
    runtimeRef.current?.setPlayerMovement(direction);
    // On touch, the analog stick is the only input, so it drives facing/aim too.
    if (touchControlsVisible && (Math.abs(direction.x) > 0.001 || Math.abs(direction.y) > 0.001)) {
      runtimeRef.current?.setPlayerAim(direction);
    }
  };
  const activate = (slot: AbilitySlot) => { if (battleLaunchPhase === 'running') runtimeRef.current?.activatePlayerAbility(slot); };
  const previewAbility = (slot: AbilitySlot) => { runtimeRef.current?.previewPlayerAbility(slot); };
  const stopPlayerMovement = () => { runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 }); };
  const attachBattleHost = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node;
    if (node) runtimeRef.current?.attachHost(node);
  }, []);
  const aimFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (battleLaunchPhase !== 'running') return;
    const target = event.target as HTMLElement;
    if (target.closest('.touch-controls')) return;
    // Touch devices steer and aim from the analog stick, so the arena stays
    // inert to touch (which also lets drags over it scroll the page).
    if (event.pointerType === 'touch') return;
    if (settings.movementMode === 'mouse' && playerEntity && event.pointerType === 'mouse') {
      runtimeRef.current?.setPlayerMouseDriveFromClient(event.clientX, event.clientY);
      return;
    }
    runtimeRef.current?.setPlayerAimFromClient(event.clientX, event.clientY);
  };
  const aimAndFireFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    aimFromPointer(event);
    if (event.pointerType === 'mouse' && event.button === 0 && playerEntity) activate('basic');
  };
  const handleArenaPointerLeave = () => {
    if (settings.movementMode === 'mouse') stopPlayerMovement();
  };


  const openBattleSetup = () => {
    setSetupPanelOpen(true);
    if (viewportMetrics.width <= 900) setBattleDrawerOpen(true);
    window.setTimeout(() => setupPanelRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'start' }), 0);
  };

  const startConfiguredBattle = () => {
    setBattleDrawerOpen(false);
    startNewBattle(setup);
  };

  return (
    <main className={`app-shell view-${view} viewport-${viewportMetrics.viewportClass} orientation-${viewportMetrics.orientation} ${viewportMetrics.shortLandscape ? 'short-landscape' : ''} ${settings.fullscreenBattle ? 'battle-focus-mode' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}>
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
          { id: 'profile', label: 'Profile', shortLabel: 'Profile', badge: `Lv ${profile.level}` }
        ]}
      />

      {toastNotices.length > 0 && (
        <div className="progress-toast-stack" aria-live="polite" aria-label="Recent notifications">
          {toastNotices.slice(-3).reverse().map((notice) => (
            <div className={`progress-toast ${notice.kind}`} key={notice.id}>
              <span>{notice.kind === 'achievement' ? '★' : notice.kind === 'fighter' ? '◆' : notice.kind === 'level' ? '↑' : notice.kind === 'challenge' ? '✓' : '•'}</span>
              <div><strong>{notice.title}</strong><small>{notice.description}</small></div>
              <button className="toast-dismiss" onClick={() => setToastNotices((current) => current.filter((item) => item.id !== notice.id))} aria-label={`Dismiss ${notice.title}`}>×</button>
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
        <TrainingLabView fighters={fighters} settings={settings} active={view === 'training'} />
        <section className={`${view === 'battle' ? 'workspace' : 'workspace battle-workspace-dormant'} ${battleDrawerOpen ? 'battle-drawer-open' : ''}`}>
          <aside className={`control-panel ui-mobile-drawer ${battleDrawerOpen ? 'open' : ''}`} id="battle-setup-drawer" aria-label="Battle configuration and settings">
            <DrawerHeader eyebrow="Battle Lab" title="Setup & settings" onClose={() => setBattleDrawerOpen(false)} />
            <details
              ref={setupPanelRef}
              className="panel-section collapsible-panel battle-setup-panel"
              open={setupPanelOpen}
              onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setSetupPanelOpen(event.currentTarget.open)}
            >
              <summary className="panel-summary">
                <span><small>Configure</small><strong>Battle setup</strong></span>
                <em>{setupDirty ? 'Changes ready' : formatModeCapacity(configuredMode)}</em>
              </summary>
              <div className="panel-content">
              <label className="field-label" htmlFor="fighter-a">Team 1 fighter</label>
              <select id="fighter-a" value={setup.fighterAId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFighter('A', event.target.value)}>
                {fighters.map((fighter) => { const locked = !isCustomFighter(fighter.id) && !profile.unlockedFighterIds.includes(fighter.id); return <option value={fighter.id} key={fighter.id} disabled={locked}>{fighter.name}{isCustomFighter(fighter.id) ? ' · custom' : locked ? ' · locked' : ''}</option>; })}
              </select>
              <FighterModuleSelectors
                fighter={configuredFighterA}
                selectedModuleIds={setup.moduleIdsA}
                side="A"
                onChange={setFighterModule}
              />
              <label className="field-label stacked-label" htmlFor="controller-a">Team 1 controller</label>
              <select id="controller-a" value={setup.controllerA} onChange={(event: ChangeEvent<HTMLSelectElement>) => setController('A', event.target.value as ControllerKind)}>
                <option value="player">Player</option>
                <option value="ai">AI</option>
              </select>

              <label className="field-label stacked-label" htmlFor="fighter-b">Team 2 fighter</label>
              <select id="fighter-b" value={setup.fighterBId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFighter('B', event.target.value)}>
                {fighters.map((fighter) => { const locked = !isCustomFighter(fighter.id) && !profile.unlockedFighterIds.includes(fighter.id); return <option value={fighter.id} key={fighter.id} disabled={locked}>{fighter.name}{isCustomFighter(fighter.id) ? ' · custom' : locked ? ' · locked' : ''}</option>; })}
              </select>
              <FighterModuleSelectors
                fighter={configuredFighterB}
                selectedModuleIds={setup.moduleIdsB}
                side="B"
                onChange={setFighterModule}
              />
              <label className="field-label stacked-label" htmlFor="controller-b">Team 2 controller</label>
              <select id="controller-b" value={setup.controllerB} onChange={(event: ChangeEvent<HTMLSelectElement>) => setController('B', event.target.value as ControllerKind)}>
                <option value="ai">AI</option>
                <option value="player">Player</option>
              </select>

              <label className="field-label stacked-label" htmlFor="mode">Game mode</label>
              <select id="mode" value={setup.modeId} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSetup({ modeId: event.target.value })}>
                {gameModes.map((mode) => <option value={mode.id} key={mode.id}>{mode.name} · {formatModeCapacity(mode)}</option>)}
              </select>
              <label className="field-label stacked-label" htmlFor="arena">Arena</label>
              <select id="arena" value={setup.arenaId} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSetup({ arenaId: event.target.value })}>
                {arenas.map((arena) => <option value={arena.id} key={arena.id}>{arena.name} · {arena.size}{arena.allowedModes.includes(setup.modeId) ? '' : ' · incompatible'}</option>)}
              </select>
              {setup.modeId !== 'duel' && (
                <div className="team-size-grid">
                  <CreatorField label={setup.modeId === 'boss-raid' ? 'Raiders' : setup.modeId === 'survival' ? 'Survivors' : 'Fighter A count'}>
                    <input type="number" min={1} max={50} value={setup.teamSizeA} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSetup({ teamSizeA: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} />
                  </CreatorField>
                  {setup.modeId !== 'boss-raid' && (
                    <CreatorField label={setup.modeId === 'survival' ? 'Enemy count' : 'Fighter B count'}>
                      <input type="number" min={1} max={50} value={setup.teamSizeB} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSetup({ teamSizeB: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} />
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
              <select id="difficulty" value={profile.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const difficulty = event.target.value as PlayerProfile['difficulty'];
                setProfile((current) => ({ ...current, difficulty, updatedAt: Date.now() }));
                updateSetup({ difficulty });
              }}>
                <option value="relaxed">Relaxed</option>
                <option value="standard">Standard</option>
                <option value="intense">Intense</option>
              </select>
              <div className="battle-rule-grid">
                <label className="field-label" htmlFor="team-collision">Ally collision</label>
                <select id="team-collision" value={setup.teamCollision} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSetup({ teamCollision: event.target.value as BattleSetup['teamCollision'] })}>
                  <option value="full">Full</option>
                  <option value="soft">Soft crowd collision</option>
                  <option value="ghost">Ghost through allies</option>
                </select>
                <Toggle label="Friendly fire" checked={setup.friendlyFire} onChange={(value) => updateSetup({ friendlyFire: value })} />
              </div>

              <details className="advanced-seed-panel">
                <summary>Advanced seed / debugging</summary>
                <label className="field-label seed-label" htmlFor="seed">Current seed</label>
                <div className="seed-row">
                  <input id="seed" value={seedText} onChange={(event: ChangeEvent<HTMLInputElement>) => setSeedText(event.target.value.replace(/\D/g, ''))} />
                  <div className="seed-actions">
                    <NeonButton tone="utility" size="small" onClick={applyTypedSeed}>Apply</NeonButton>
                    <NeonButton tone="random" size="small" onClick={() => setSeedText(String(generateRandomSeed()))}>Random unique</NeonButton>
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
              <select id="movement-mode" value={settings.movementMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAppSetting('movementMode', event.target.value as MovementMode)}>
                <option value="wasd">WASD / arrows move</option>
                <option value="mouse">Mouse move + aim</option>
              </select>
              <label className="field-label stacked-label" htmlFor="aim-assist">Aim assist</label>
              <select id="aim-assist" value={settings.aimAssist} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAppSetting('aimAssist', event.target.value as AimAssistLevel)}>
                <option value="off">Off</option>
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="strong">Strong</option>
              </select>
              <p className="small-note">Aim assist pulls your aim toward the nearest enemy in your aiming direction. Stronger levels widen the cone and pull harder. Applies to player fighters only.</p>
              <p className="small-note">Custom fighters use the same controller, cooldown, command and replay systems as built-in fighters.</p>
              </div>
            </details>

            <details className="panel-section collapsible-panel release-settings">
              <summary className="panel-summary"><span><small>Display</small><strong>Quality & accessibility</strong></span></summary>
              <div className="panel-content">
              <label className="field-label" htmlFor="quality-preset">Quality preset</label>
              <select id="quality-preset" value={settings.qualityPreset} onChange={(event: ChangeEvent<HTMLSelectElement>) => selectQualityPreset(event.target.value as QualityPresetId)}>
                <option value="auto">Auto · recommended for this device</option>
                <option value="battery">{qualityPresets.battery.label}</option>
                <option value="balanced">{qualityPresets.balanced.label}</option>
                <option value="high">{qualityPresets.high.label}</option>
                <option value="custom">Custom</option>
              </select>
              <p className="small-note">Auto resolves from device memory, CPU threads, data-saver and reduced-motion preferences.</p>
              <label className="field-label stacked-label" htmlFor="render-profile">Visual style</label>
              <select id="render-profile" value={settings.renderProfile} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAppSetting('renderProfile', event.target.value as AppSettings['renderProfile'])}>
                <option value="standard">Standard characters</option>
                <option value="minimal">Minimal shapes</option>
                <option value="debug">Debug renderer</option>
              </select>
              <label className="field-label stacked-label" htmlFor="target-fps">Render target</label>
              <select id="target-fps" value={settings.targetRenderFps} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAppSetting('targetRenderFps', Number(event.target.value) === 30 ? 30 : 60)}>
                <option value={60}>60 FPS</option>
                <option value={30}>30 FPS · battery saver</option>
              </select>
              <RangeField label={`Internal render scale · ${Math.round(settings.renderScale * 100)}%`} value={settings.renderScale} min={0.5} max={1} step={0.05} onChange={(value) => updateAppSetting('renderScale', value)} />
              <RangeField label={`Device pixel ratio cap · ${settings.maxDevicePixelRatio.toFixed(2)}×`} value={settings.maxDevicePixelRatio} min={0.75} max={3} step={0.25} onChange={(value) => updateAppSetting('maxDevicePixelRatio', value)} />
              <RangeField label={`Particle density · ${Math.round(settings.particleScale * 100)}%`} value={settings.particleScale} min={0} max={1.5} step={0.05} onChange={(value) => updateAppSetting('particleScale', value)} />
              <RangeField label={`Audio volume · ${Math.round(settings.masterVolume * 100)}%`} value={settings.masterVolume} min={0} max={1} step={0.05} onChange={(value) => updateAppSetting('masterVolume', value)} />
              <Toggle label="Adaptive quality" checked={settings.adaptiveQuality} onChange={(value) => updateAppSetting('adaptiveQuality', value)} />
              <Toggle label="Effects + telegraphs" checked={settings.effects} onChange={(value) => updateAppSetting('effects', value)} />
              <Toggle label="Show mounted attachments" checked={settings.showMountedAttachments} onChange={(value) => updateAppSetting('showMountedAttachments', value)} />
              <Toggle label="Show fighter HP rings" checked={settings.showFighterHealthRings} onChange={(value) => updateAppSetting('showFighterHealthRings', value)} />
              <Toggle label="Show damage numbers" checked={settings.showDamageNumbers} onChange={(value) => updateAppSetting('showDamageNumbers', value)} />
              <Toggle label="Show battle intros" checked={settings.showBattleIntros} onChange={(value) => updateAppSetting('showBattleIntros', value)} />
              <Toggle label="Neon arena background" checked={settings.arenaBackground} onChange={(value) => updateAppSetting('arenaBackground', value)} />
              <Toggle label="Trails" checked={settings.trails} onChange={(value) => updateAppSetting('trails', value)} />
              <Toggle label="Camera shake" checked={settings.cameraShake} onChange={(value) => updateAppSetting('cameraShake', value)} />
              <Toggle label="Follow player" checked={settings.cameraFollow} onChange={(value) => updateAppSetting('cameraFollow', value)} />
              <label className="field-label stacked-label" htmlFor="touch-controls-mode">Touch controls</label>
              <select id="touch-controls-mode" value={settings.touchControls} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateAppSetting('touchControls', event.target.value as TouchControlMode)}>
                <option value="auto">Auto · touch-first devices</option>
                <option value="always">Always show</option>
                <option value="never">Always hide</option>
              </select>
              <Toggle label="Impact freeze" checked={settings.impactFreeze} onChange={(value) => updateAppSetting('impactFreeze', value)} />
              <Toggle label="Screen flashes" checked={settings.screenFlash} onChange={(value) => updateAppSetting('screenFlash', value)} />
              <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => updateAppSetting('reducedMotion', value)} />
              <Toggle label="High contrast UI" checked={settings.highContrast} onChange={(value) => updateAppSetting('highContrast', value)} />
              <Toggle label="Large touch controls" checked={settings.largeTouchControls} onChange={(value) => updateAppSetting('largeTouchControls', value)} />
              <Toggle label="Developer metrics panel" checked={settings.showPerformanceHud} onChange={(value) => updateAppSetting('showPerformanceHud', value)} />
              <Toggle label="Audio" checked={settings.audio} onChange={(value) => updateAppSetting('audio', value)} />
              <div className="settings-action-row">
                <NeonButton tone="utility" fullWidth onClick={() => void toggleFullscreenBattle()}>Fullscreen arena</NeonButton>
                <button className="text-button settings-reset-button" onClick={restoreRecommendedSettings}>Reset recommended</button>
              </div>
              </div>
            </details>

          </aside>
          <DrawerScrim open={battleDrawerOpen} onClose={() => setBattleDrawerOpen(false)} label="Close battle setup" className="battle-drawer-scrim" />

          <div className="arena-column">
            <section className="battle-stage" ref={battleStageRef}>
              <div className="battle-command-bar" aria-label="Battle actions">
                <div className="battle-command-actions">
                  <NeonButton tone="success" className="battle-start-button" onClick={startConfiguredBattle}>{setupDirty ? 'Start configured battle' : 'Start new battle'}</NeonButton>
                  <NeonButton tone="random" onClick={startRandomMatchup}>New random battle</NeonButton>
                  <NeonButton tone="utility" onClick={replaySameBattle}>Replay same battle</NeonButton>
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
                  <em>{diagnostics.battleEnded ? resultPresentation.compact : activeMode?.victory === 'LAST_TEAM_STANDING' ? (viewportMetrics.compact ? '' : `${eliminationProgress.alive}/${eliminationProgress.total} alive · Win by elimination`) : `${diagnostics.entities.length} active`}</em>
                </span>
              </div>

              <div className="arena-wrap" onPointerMove={aimFromPointer} onPointerDown={aimAndFireFromPointer} onPointerLeave={handleArenaPointerLeave}>
                <div className="arena-frame" ref={attachBattleHost} />
                {!ready && !bootError && <div className="arena-loading" role="status"><span className="loading-spinner" /><strong>Preparing battle renderer…</strong><small>Loading arena, content recipes and mobile quality profile.</small></div>}
                {bootError && <div className="arena-loading error" role="alert"><strong>Battle renderer failed</strong><small>{bootError}</small><button onClick={() => setBootAttempt((attempt) => attempt + 1)}>Retry renderer</button></div>}
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
                        <NeonButton tone="success" onClick={replaySameBattle}>Rematch</NeonButton>
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

            {touchControlsVisible && (
              <div className="mobile-battle-dock" aria-label="Quick battle controls">
                <NeonButton tone="random" size="small" onClick={startRandomMatchup}>Random</NeonButton>
                <NeonButton tone={pausedByUser ? 'success' : 'pause'} size="small" onClick={toggleBattlePaused} disabled={diagnostics.battleEnded || pausedBySystem || battleLaunchPhase !== 'running'}>{pausedByUser ? 'Resume' : 'Pause'}</NeonButton>
                <NeonButton tone="ghost" size="small" onClick={openBattleSetup} aria-controls="battle-setup-drawer" aria-expanded={battleDrawerOpen}>Setup</NeonButton>
                <NeonButton tone="utility" size="small" onClick={() => void toggleFullscreenBattle()}>Fullscreen</NeonButton>
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
                  setSettings((current) => ({ ...current, showPerformanceHud: open }));
                }
              }}
            >
              <summary className="panel-summary"><span><small>Developer</small><strong>Performance & simulation metrics</strong></span></summary>
              <div className="debug-panel-fps-tile">
                <small>Render FPS</small>
                <strong>{diagnostics.performance.renderFps.toFixed(0)}</strong>
                <span>live presentation frame rate</span>
              </div>
              <div className="debug-metric-grid">
                <Metric label="Tick" value={diagnostics.tick.toLocaleString()} />
                <Metric label="Checksum" value={diagnostics.checksum} mono />
                <Metric label="Replay frames" value={diagnostics.replayFrames.toLocaleString()} />
                <Metric label="Replay commands" value={diagnostics.replayCommands.toLocaleString()} />
                <Metric label="Replay stored" value={diagnostics.replayStoredCommands.toLocaleString()} />
                <Metric label="Replay reduction" value={`${Math.round(diagnostics.replayCompressionRatio * 100)}%`} />
                <Metric label="Registered fighters" value={fighters.length.toString()} />
                <Metric label="Living fighters" value={diagnostics.entities.length.toString()} />
                <Metric label="Simulation total" value={`${diagnostics.performance.simulationMs.toFixed(2)} ms`} />
                <Metric label="AI" value={`${diagnostics.performance.aiMs.toFixed(2)} ms`} />
                <Metric label="AI fighters" value={diagnostics.aiWorkload.aiEntities.toLocaleString()} />
                <Metric label="AI attack checks/tick" value={diagnostics.aiWorkload.attackEvaluations.toLocaleString()} />
                <Metric label="AI steering refreshes/tick" value={diagnostics.aiWorkload.reactionRefreshes.toLocaleString()} />
                <Metric label="AI aim refreshes/tick" value={diagnostics.aiWorkload.aimRefreshes.toLocaleString()} />
                <Metric label="AI attack cadence" value={`every ${diagnostics.aiWorkload.attackDecisionInterval}t`} />
                <Metric label="AI steering floor" value={`${diagnostics.aiWorkload.reactionIntervalFloor}t`} />
                <Metric label="AI cluster refresh" value={`every ${diagnostics.aiWorkload.clusterRefreshInterval}t`} />
                <Metric label="AI hostile queries/tick" value={diagnostics.aiWorkload.hostileQueries.toLocaleString()} />
                <Metric label="AI area candidates/tick" value={diagnostics.aiWorkload.areaCandidateChecks.toLocaleString()} />
                <Metric label="Player input" value={`${diagnostics.performance.playerInputMs.toFixed(2)} ms`} />
                <Metric label="Simulation core" value={`${diagnostics.performance.simulationCoreMs.toFixed(2)} ms`} />
                <Metric label="Runtime snapshot reuse" value={`${diagnostics.performance.snapshotMs.toFixed(2)} ms`} />
                <Metric label="Replay record" value={`${diagnostics.performance.replayMs.toFixed(2)} ms`} />
                <Metric label="Post simulation" value={`${diagnostics.performance.postSimulationMs.toFixed(2)} ms`} />
                <Metric label="Diagnostics/UI prep" value={`${diagnostics.performance.diagnosticsMs.toFixed(2)} ms`} />
                <Metric label="Simulation p95" value={`${diagnostics.performance.simulationP95Ms.toFixed(2)} ms`} />
                <Metric label="Render ms" value={diagnostics.performance.renderMs.toFixed(2)} />
                <Metric label="Render p95" value={`${diagnostics.performance.renderP95Ms.toFixed(2)} ms`} />
                <Metric label="Frame p95" value={`${diagnostics.performance.frameP95Ms.toFixed(2)} ms`} />
                <Metric label="Render FPS" value={diagnostics.performance.renderFps.toFixed(0)} />
                <Metric label="Pressure" value={`${diagnostics.performance.pressure} · ${diagnostics.performance.bottleneck}`} />
                <Metric label="Simulation steps" value={diagnostics.performance.stepsLastFrame.toString()} />
                <Metric label="Dropped sim ticks" value={diagnostics.performance.droppedSimulationTicks.toLocaleString()} />
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
                <Metric label="Candidate pairs" value={diagnostics.simulationMetrics.candidatePairs.toLocaleString()} />
                <Metric label="Broadphase cells" value={diagnostics.simulationMetrics.occupiedBroadphaseCells.toLocaleString()} />
                <Metric label="Largest cell" value={diagnostics.simulationMetrics.maxBroadphaseBucket.toLocaleString()} />
                <Metric label="Projectile checks" value={diagnostics.simulationMetrics.projectileEntityChecks.toLocaleString()} />
                <Metric label="Obstacle checks" value={diagnostics.simulationMetrics.projectileObstacleChecks.toLocaleString()} />
                <Metric label="Numeric recoveries" value={diagnostics.simulationMetrics.invalidNumericStates.toLocaleString()} />
                <Metric label="Contacts" value={diagnostics.simulationMetrics.contactsResolved.toLocaleString()} />
                <Metric label="Active fighter views" value={diagnostics.renderDiagnostics.fighterViews.toLocaleString()} />
                <Metric label="Pooled fighter views" value={diagnostics.renderDiagnostics.pooledFighterViews.toLocaleString()} />
                <Metric label="View reuse count" value={diagnostics.renderDiagnostics.reusedFighterViews.toLocaleString()} />
                <Metric label="Visual LOD" value={diagnostics.renderDiagnostics.lod} />
                <Metric label="Mass render tier" value={diagnostics.renderDiagnostics.renderTier} />
                <Metric label="Render target" value={`${diagnostics.renderDiagnostics.targetRenderFps} FPS`} />
                <Metric label="Presented events" value={diagnostics.renderDiagnostics.presentationEvents.toLocaleString()} />
                <Metric label="Projectile visuals" value={diagnostics.renderDiagnostics.projectileVisuals.toLocaleString()} />
                <Metric label="VFX quality" value={diagnostics.renderDiagnostics.vfxQuality} />
                <Metric label="Particles" value={diagnostics.renderDiagnostics.activeParticles.toLocaleString()} />
                <Metric label="Ground marks" value={diagnostics.renderDiagnostics.groundMarks.toLocaleString()} />
                <Metric label="Residual FX" value={diagnostics.renderDiagnostics.residualParticles.toLocaleString()} />
                <Metric label="Weapon FX" value={diagnostics.renderDiagnostics.weaponEffects.toLocaleString()} />
                <Metric label="Projectile trails" value={diagnostics.renderDiagnostics.projectileTrails.toLocaleString()} />
                <Metric label="Audio voices" value={`${diagnostics.audioDiagnostics.activeVoices}/${diagnostics.audioDiagnostics.voiceLimit}`} />
                <Metric label="Arena objects" value={diagnostics.obstacles.filter((item) => item.alive).length.toString()} />
              </div>
              <div className="ai-decision-debug">
                <h3>AI action selection</h3>
                {diagnostics.aiDecisions.length === 0 ? <span className="small-note">No AI decision sampled yet.</span> : diagnostics.aiDecisions.slice(0, 8).map((decision) => (
                  <div className="ai-decision-row" key={decision.entityId}>
                    <b>#{decision.entityId}</b>
                    <span>{decision.kind === 'ability' ? `${decision.slot?.toUpperCase()} · ${decision.abilityId}` : decision.kind}</span>
                    <small>{decision.reason}</small>
                  </div>
                ))}
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
                <div className="note-card-inline"><strong>Architecture proof</strong><p>The release layers remain replaceable: content feeds a headless simulation, commands select the controller, semantic events drive visuals/audio/meta systems, and the browser/mobile app only wires those packages together.</p><NeonButton tone="ghost" size="small" onClick={() => setView('creator')}>Open developer Fighter Workshop</NeonButton></div>
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
            onChangeName={(displayName) => setProfile((current) => ({ ...current, displayName: displayName || 'Arena Pilot', updatedAt: Date.now() }))}
            onChangeDifficulty={(difficulty) => {
              setProfile((current) => ({ ...current, difficulty, updatedAt: Date.now() }));
              const next = { ...setup, difficulty };
              setSetup(next);
            }}
            onSaveLoadout={saveCurrentLoadout}
            onApplyLoadout={applyLoadout}
            onDeleteLoadout={(id) => setProfile((current) => removeBattlePreset(current, id))}
            onUnlockAll={() => setProfile((current) => unlockAllFightersForTesting(current, fighters.filter((fighter) => !isCustomFighter(fighter.id)).map((fighter) => fighter.id)))}
            onImportProfile={importProfile}
            onResetProfile={resetProfile}
          />
        </div>
        <section className={view === 'creator' ? 'creator-workspace' : 'creator-workspace view-hidden'}>
          <aside className="creator-form-column">
            <div className="panel-section creator-source-row">
              <h2>Developer Fighter Workshop</h2><p className="small-note">Internal authoring only. Player-facing fighter creation is intentionally disabled; publish only reviewed fighter definitions and approved modules.</p>
              <select value={sourceFighterId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSourceFighterId(event.target.value)}>
                {fighters.map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}
              </select>
              <button className="secondary" onClick={duplicateFighter}>Duplicate into editable recipe</button>
              <button className="ghost-button" onClick={() => { setDraft(createStarterBundle()); setCreatorMessage('Started a clean Arc Prototype recipe.'); }}>New blank prototype</button>
            </div>

            <CreatorSection title="Identity & classification">
              <CreatorField label="Name"><input value={draft.fighter.name} onChange={(event: ChangeEvent<HTMLInputElement>) => syncIdentity(event.target.value)} /></CreatorField>
              <CreatorField label="ID"><input value={draft.fighter.id} onChange={(event: ChangeEvent<HTMLInputElement>) => syncIdentity(draft.fighter.name, event.target.value)} /></CreatorField>
              <CreatorField label="Archetype"><input value={draft.fighter.classification.archetype} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, archetype: event.target.value } } }))} /></CreatorField>
              <CreatorField label="Primary element">
                <select value={draft.fighter.classification.elements[0]} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, elements: [event.target.value as Element] } } }))}>
                  {ELEMENTS.map((element) => <option key={element} value={element}>{element}</option>)}
                </select>
              </CreatorField>
              <CreatorField label="Traits"><input value={draft.fighter.classification.traits.join(', ')} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, traits: splitTags(event.target.value) } } }))} /></CreatorField>
            </CreatorSection>

            <CreatorSection title="Physics & combat stats">
              <RangeField label="HP" value={draft.fighter.stats.maxHp} min={40} max={2000} step={5} onChange={(value) => updateFighterStats(setDraft, draft, 'maxHp', value)} />
              <RangeField label="Radius" value={draft.fighter.physics.radius} min={12} max={100} step={1} onChange={(value) => updateFighterPhysics(setDraft, draft, 'radius', value)} />
              <RangeField label="Mass" value={draft.fighter.physics.mass} min={0.2} max={15} step={0.05} onChange={(value) => updateFighterPhysics(setDraft, draft, 'mass', value)} />
              <RangeField label="Bounce" value={draft.fighter.physics.restitution} min={0} max={1.2} step={0.01} onChange={(value) => updateFighterPhysics(setDraft, draft, 'restitution', value)} />
              <RangeField label="Damping" value={draft.fighter.physics.linearDamping} min={0.95} max={1} step={0.001} onChange={(value) => updateFighterPhysics(setDraft, draft, 'linearDamping', value)} />
              <RangeField label="Max speed" value={draft.fighter.physics.maxSpeed} min={2} max={30} step={0.1} onChange={(value) => updateFighterPhysics(setDraft, draft, 'maxSpeed', value)} />
              <RangeField label="Acceleration" value={draft.fighter.stats.moveAcceleration} min={0.02} max={0.8} step={0.01} onChange={(value) => updateFighterStats(setDraft, draft, 'moveAcceleration', value)} />
            </CreatorSection>

            <CreatorSection title="Primary attack identity">
              {(() => {
                const attack = getPrimaryAttack(draft.fighter.primaryAttackId);
                const forms = [...new Set(primaryAttacks.map((item) => item.form))];
                const behaviors = ATTACK_FORM_BEHAVIORS[attack.form];
                const selectAttack = (nextAttack: PrimaryAttackDefinition) => {
                  setDraft((current) => ({ ...current, fighter: { ...current.fighter, primaryAttackId: nextAttack.id } }));
                };
                return (
                  <>
                    <CreatorField label="Attack source / form">
                      <select value={attack.form} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const form = event.target.value as AttackForm;
                        const next = primaryAttacks.find((item) => item.form === form) ?? attack;
                        selectAttack(next);
                      }}>
                        {forms.map((form) => <option key={form} value={form}>{form}</option>)}
                      </select>
                    </CreatorField>
                    <CreatorField label="Attack behavior">
                      <select value={attack.behavior} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const behavior = event.target.value as PrimaryAttackDefinition['behavior'];
                        const next = primaryAttacks.find((item) => item.form === attack.form && item.behavior === behavior);
                        if (next) selectAttack(next);
                      }}>
                        {behaviors.map((behavior) => {
                          const available = primaryAttacks.some((item) => item.form === attack.form && item.behavior === behavior);
                          return <option key={behavior} value={behavior} disabled={!available}>{behavior}{available ? '' : ' · add definition first'}</option>;
                        })}
                      </select>
                    </CreatorField>
                    <CreatorField label="Primary attack">
                      <select value={attack.id} onChange={(event: ChangeEvent<HTMLSelectElement>) => selectAttack(getPrimaryAttack(event.target.value))}>
                        {primaryAttacks.filter((item) => item.form === attack.form && item.behavior === attack.behavior).map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </CreatorField>
                    <div className="weapon-spec-grid">
                      <Metric label="Form" value={attack.form} />
                      <Metric label="Behavior" value={attack.behavior} />
                      <Metric label="Range" value={`${attack.minRange}–${attack.range}`} />
                      <Metric label="Damage" value={attack.damage.toFixed(1)} />
                      <Metric label="Visual scale" value={`${attack.visualScale.toFixed(2)}×`} />
                      <Metric label="Cadence" value={attack.burstCount && attack.burstCount > 1 ? `${attack.burstCount}-round burst` : `${attack.cooldownTicks} ticks`} />
                    </div>
                    <p className="small-note">The primary attack is the fighter’s Basic and the only weapon or elemental source rendered on the body. Melee stays still while idle; only Spin and Orbit behaviors rotate during an active attack.</p>
                  </>
                );
              })()}
            </CreatorSection>

            <CreatorSection title="AI & skill loadout">
              <CreatorField label="AI profile">
                <select value={draft.fighter.aiProfileId ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, aiProfileId: event.target.value || null } }))}>
                  <option value="">No AI profile</option>
                  {aiProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.id} · {profile.movementStyle}</option>)}
                </select>
              </CreatorField>
              <CreatorField label="Basic">
                <div className="primary-basic-summary"><small>Basic</small><strong>{getPrimaryAttack(draft.fighter.primaryAttackId).name}</strong><span>Generated from the primary attack</span></div>
              </CreatorField>
              {SKILL_SLOTS.map((slot) => (
                <CreatorField label={slot === 'ultimate' ? 'Ultimate' : `Skill ${slot.slice(-1)}`} key={slot}>
                  <select value={draft.fighter.abilitySlots[slot] ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, abilitySlots: { ...current.fighter.abilitySlots, [slot]: event.target.value || null } } }))}>
                    <option value="">Empty</option>
                    {abilities.filter((ability) => ability.slot === slot).map((ability) => <option key={ability.id} value={ability.id}>{ability.name}</option>)}
                  </select>
                </CreatorField>
              ))}
            </CreatorSection>
          </aside>

          <div className="creator-preview-column">
            <div className="creator-preview-card">
              <div className="creator-preview-heading">
                <div><p className="eyebrow">Live recipe preview</p><h2>{draft.fighter.name || 'Unnamed Fighter'}</h2></div>
                <span className={`validation-badge ${validation.success ? 'valid' : 'invalid'}`}>{validation.success ? 'VALID' : `${validation.errors.length} ISSUES`}</span>
              </div>
              <FighterRecipePreview fighter={draft.fighter} visual={draft.visualRecipe} motion={draft.motionRecipe} />
              <div className="creator-summary-grid">
                <Metric label="HP" value={String(draft.fighter.stats.maxHp)} />
                <Metric label="Radius" value={draft.fighter.physics.radius.toFixed(0)} />
                <Metric label="Mass" value={draft.fighter.physics.mass.toFixed(2)} />
                <Metric label="Speed" value={draft.fighter.physics.maxSpeed.toFixed(1)} />
                <Metric label="Primary attack" value={getPrimaryAttack(draft.fighter.primaryAttackId).name} />
              </div>
              <div className="creator-skill-summary">
                <span><small>basic</small><strong>{getPrimaryAttack(draft.fighter.primaryAttackId).name}</strong></span>
                {SKILL_SLOTS.map((slot) => {
                  const abilityId = draft.fighter.abilitySlots[slot];
                  const ability = abilityId ? abilities.find((item) => item.id === abilityId) : null;
                  return <span key={slot}><small>{slot}</small><strong>{ability?.name ?? 'Empty'}</strong></span>;
                })}
              </div>
            </div>

            <CreatorSection title="Visual recipe">
              <div className="creator-grid two-column">
                <CreatorField label="Body template">
                  <select value={draft.visualRecipe.shape} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateVisual(setDraft, draft, { shape: event.target.value as VisualRecipe['shape'] })}>
                    <option value="orb">Orb</option><option value="mech">Mech</option><option value="water">Water</option><option value="bomber">Bomber</option>
                  </select>
                </CreatorField>
                <ColorField label="Body" value={draft.visualRecipe.bodyColor} onChange={(value) => updateVisual(setDraft, draft, { bodyColor: value })} />
                <ColorField label="Body dark" value={draft.visualRecipe.bodyDarkColor} onChange={(value) => updateVisual(setDraft, draft, { bodyDarkColor: value })} />
                <ColorField label="Core" value={draft.visualRecipe.coreColor} onChange={(value) => updateVisual(setDraft, draft, { coreColor: value })} />
                <ColorField label="Aura" value={draft.visualRecipe.auraColor} onChange={(value) => updateVisual(setDraft, draft, { auraColor: value })} />
                <ColorField label="Accent" value={draft.visualRecipe.accentColor} onChange={(value) => updateVisual(setDraft, draft, { accentColor: value })} />
                <Toggle label="Horns" checked={draft.visualRecipe.horns} onChange={(value) => updateVisual(setDraft, draft, { horns: value })} />
              </div>
            </CreatorSection>

            <CreatorSection title="Motion recipe">
              <RangeField label="Speed stretch" value={draft.motionRecipe.speedStretch} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'speedStretch', value)} />
              <RangeField label="Impact squash" value={draft.motionRecipe.impactSquash} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'impactSquash', value)} />
              <RangeField label="Lean" value={draft.motionRecipe.lean} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'lean', value)} />
              <RangeField label="Idle pulse" value={draft.motionRecipe.pulseAmount} min={0} max={0.15} step={0.005} onChange={(value) => updateMotion(setDraft, draft, 'pulseAmount', value)} />
              <RangeField label="Pulse speed" value={draft.motionRecipe.pulseSpeed} min={0} max={8} step={0.1} onChange={(value) => updateMotion(setDraft, draft, 'pulseSpeed', value)} />
              <RangeField label="Weapon spin" value={draft.motionRecipe.weaponSpin} min={0} max={12} step={0.1} onChange={(value) => updateMotion(setDraft, draft, 'weaponSpin', value)} />
            </CreatorSection>
          </div>

          <aside className="creator-output-column">
            <div className="panel-section creator-actions">
              <p className="eyebrow">Content pipeline</p>
              <h2>Validate, save, test</h2>
              <p className="creator-message">{creatorMessage}</p>
              <button onClick={saveDraft} disabled={!validation.success}>Save to engine</button>
              <button className="accent-button" onClick={testDraft} disabled={!validation.success}>Save & test fight</button>
              <button className="secondary" onClick={exportDraft} disabled={!validation.success}>Export fighter JSON</button>
              <button className="danger-button" onClick={deleteDraft} disabled={!isCustomFighter(draft.fighter.id)}>Delete custom fighter</button>
            </div>

            <div className="panel-section">
              <h2>Validation</h2>
              {validation.success ? <div className="validation-ok">✓ Schema and content references are valid.</div> : validation.errors.map((error) => <div className="validation-error" key={error}>• {error}</div>)}
            </div>

            <div className="panel-section">
              <h2>Import bundle</h2>
              <textarea className="import-textarea" value={importText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setImportText(event.target.value)} placeholder="Paste a .fighter.json bundle here" />
              <button className="secondary" onClick={importBundle}>Load into editor</button>
              <label className="file-import-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => void readImportFile(event, setImportText, setCreatorMessage)} /></label>
            </div>

            <div className="panel-section custom-library">
              <h2>Custom library</h2>
              {customBundles.length === 0 ? <p className="small-note">No saved custom fighters yet.</p> : customBundles.map((bundle) => (
                <button className="custom-library-item" key={bundle.fighter.id} onClick={() => { setDraft(bundle); setCreatorMessage(`${bundle.fighter.name} loaded from the local library.`); }}>
                  <span style={{ background: hexColor(bundle.visualRecipe.bodyColor) }} />
                  <strong>{bundle.fighter.name}</strong>
                  <small>{bundle.fighter.id}</small>
                </button>
              ))}
            </div>

            <details className="panel-section json-preview">
              <summary>Generated JSON</summary>
              <pre>{serializeFighterBundle(draft)}</pre>
            </details>
          </aside>
        </section>
      </>

    </main>
  );
}

function DirectionPad({ onDirection }: { onDirection: (direction: Vec2) => void }) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const onDirectionRef = useRef(onDirection);
  const targetStickRef = useRef<Vec2>({ x: 0, y: 0 });
  const currentStickRef = useRef<Vec2>({ x: 0, y: 0 });
  const targetDirectionRef = useRef<Vec2>({ x: 0, y: 0 });
  const currentDirectionRef = useRef<Vec2>({ x: 0, y: 0 });

  useEffect(() => {
    onDirectionRef.current = onDirection;
  }, [onDirection]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const currentStick = currentStickRef.current;
      const targetStick = targetStickRef.current;
      const currentDirection = currentDirectionRef.current;
      const targetDirection = targetDirectionRef.current;
      const stickResponse = pointerIdRef.current === null ? 0.22 : 0.34;
      const movementResponse = pointerIdRef.current === null ? 0.18 : 0.26;

      currentStick.x += (targetStick.x - currentStick.x) * stickResponse;
      currentStick.y += (targetStick.y - currentStick.y) * stickResponse;
      currentDirection.x += (targetDirection.x - currentDirection.x) * movementResponse;
      currentDirection.y += (targetDirection.y - currentDirection.y) * movementResponse;

      if (Math.abs(currentStick.x) < 0.02) currentStick.x = 0;
      if (Math.abs(currentStick.y) < 0.02) currentStick.y = 0;
      if (Math.abs(currentDirection.x) < 0.002) currentDirection.x = 0;
      if (Math.abs(currentDirection.y) < 0.002) currentDirection.y = 0;

      const intensity = Math.min(1, Math.hypot(currentDirection.x, currentDirection.y));
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${currentStick.x.toFixed(2)}px, ${currentStick.y.toFixed(2)}px) scale(${(1 + intensity * 0.06).toFixed(3)})`;
      }
      if (padRef.current) {
        padRef.current.style.setProperty('--stick-intensity', intensity.toFixed(3));
        padRef.current.style.setProperty('--stick-border-alpha', (0.16 + intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-inset-alpha', (0.07 + intensity * 0.08).toFixed(3));
        padRef.current.style.setProperty('--stick-glow-alpha', (0.05 + intensity * 0.11).toFixed(3));
        padRef.current.style.setProperty('--stick-halo-size', `${(10 + intensity * 18).toFixed(1)}px`);
        padRef.current.style.setProperty('--stick-guide-opacity', (0.34 + intensity * 0.28).toFixed(3));
        padRef.current.style.setProperty('--stick-ring-alpha', (0.18 + intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-ring-scale', (1 + intensity * 0.025).toFixed(3));
        padRef.current.style.setProperty('--stick-core-opacity', (0.72 - intensity * 0.26).toFixed(3));
        padRef.current.style.setProperty('--stick-core-scale', (1 - intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-knob-core-opacity', (0.68 + intensity * 0.28).toFixed(3));
        if (intensity > 0.03) {
          const angle = Math.atan2(currentDirection.y, currentDirection.x) * 180 / Math.PI;
          padRef.current.style.setProperty('--stick-angle', `${angle.toFixed(1)}deg`);
        }
        padRef.current.style.setProperty('--stick-arrow-opacity', Math.min(1, Math.max(0, (intensity - 0.03) * 1.7)).toFixed(3));
        padRef.current.dataset.active = pointerIdRef.current === null ? 'false' : 'true';
      }
      onDirectionRef.current({ ...currentDirection });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateFromClient = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const visualRadius = rect.width * 0.31;
    const inputRadius = rect.width * 0.42;
    const length = Math.hypot(rawX, rawY);
    const safeLength = Math.max(0.001, length);
    const clampedScale = length > visualRadius ? visualRadius / safeLength : 1;
    targetStickRef.current = { x: rawX * clampedScale, y: rawY * clampedScale };

    const deadzone = Math.max(7, rect.width * 0.065);
    if (length <= deadzone) {
      targetDirectionRef.current = { x: 0, y: 0 };
      return;
    }
    const normalized = { x: rawX / safeLength, y: rawY / safeLength };
    const linear = Math.max(0, Math.min(1, (length - deadzone) / Math.max(1, inputRadius - deadzone)));
    const eased = linear * linear * (3 - 2 * linear);
    targetDirectionRef.current = { x: normalized.x * eased, y: normalized.y * eased };
  };

  const stop = () => {
    pointerIdRef.current = null;
    targetStickRef.current = { x: 0, y: 0 };
    targetDirectionRef.current = { x: 0, y: 0 };
  };

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClient(event.clientX, event.clientY);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    updateFromClient(event.clientX, event.clientY);
  };

  return (
    <div
      ref={padRef}
      className="analog-pad"
      aria-label="Touch movement controls"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <div className="analog-pad-ring" />
      <div className="analog-pad-axis analog-pad-axis-horizontal" />
      <div className="analog-pad-axis analog-pad-axis-vertical" />
      <div className="analog-pad-arrow" aria-hidden="true" />
      <div className="analog-pad-core" />
      <div ref={knobRef} className="analog-pad-knob"><i /></div>
    </div>
  );
}

function FighterCard({ entity, tick, stats, recentSkills, onActivate, onPreview }: {
  entity: EntitySnapshot;
  tick: number;
  stats: RuntimeDiagnostics['stats'][number] | undefined;
  recentSkills: RecentSkillActivity[];
  onActivate?: ((slot: AbilitySlot) => void) | undefined;
  onPreview?: ((slot: AbilitySlot) => void) | undefined;
}) {
  const fighter = getFighter(entity.fighterId);
  const hpRatio = Math.max(0, entity.hp / Math.max(1, entity.maxHp));
  return (
    <article className={`fighter-card team-${entity.team} ${entity.controller === 'player' ? 'player-controlled' : ''}`}>
      <div className={`fighter-icon ${fighterIconClass(fighter)}`}>{entity.id + 1}</div>
      <div className="fighter-card-copy">
        <div className="fighter-card-heading">
          <strong>{fighter.name} <em>{entity.controller === 'player' ? 'PLAYER' : 'AI'}</em>{isCustomFighter(fighter.id) && <b>CUSTOM</b>}</strong>
          <span>{Math.ceil(entity.hp)} / {Math.ceil(entity.maxHp)} HP</span>
        </div>
        <div className="hp-track"><i style={{ width: `${hpRatio * 100}%` }} /></div>
        <span className="fighter-telemetry">{stats ? `${stats.damageDealt.toFixed(0)} dmg · ${stats.abilitiesUsed} skills · ${stats.blasts} blasts · ${stats.obstaclesDestroyed} wrecked` : 'collecting telemetry…'}</span>
        {entity.activeZoneIds.length > 0 && (
          <div className="active-zone-tags">
            {entity.activeZoneIds.map((zoneId) => <span key={`${entity.id}-${zoneId}`}>{zoneId.replaceAll('-', ' ')}</span>)}
          </div>
        )}
        <div className="skill-grid">
          {entity.abilities.map((ability) => (
            <SkillIndicator
              key={`${entity.id}-${ability.slot}`}
              state={ability}
              entityId={entity.id}
              tick={tick}
              recentSkills={recentSkills}
              controllable={entity.controller === 'player'}
              onPreview={onPreview ? () => onPreview(ability.slot) : undefined}
              onActivate={onActivate ? () => onActivate(ability.slot) : undefined}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function SkillIndicator({ state, entityId, tick, recentSkills, controllable = false, compact = false, onActivate, onPreview }: {
  state: AbilityStateSnapshot;
  entityId: number;
  tick: number;
  recentSkills: RecentSkillActivity[];
  controllable?: boolean;
  compact?: boolean;
  onActivate?: (() => void) | undefined;
  onPreview?: (() => void) | undefined;
}) {
  const touchActivatedRef = useRef(false);
  const primary = state.source === 'primaryAttack' ? getPrimaryAttack(state.abilityId) : null;
  const ability = primary ? null : getAbility(state.abilityId);
  const skillRecipe = primary ? null : getSkillPresentation(state.abilityId);
  const activation = primary ? getPrimaryAttackActivationProfile(primary) : getAbilityActivationProfile(ability!);
  const color = primary ? primaryAttackUiColor(primary.form) : skillRecipe!.color;
  const importance = primary ? 'basic' : skillRecipe!.importance;
  const icon = primary ? primaryAttackIcon(primary) : skillRecipe!.icon;
  const shortName = primary ? primary.name : skillRecipe!.shortName;
  const recent = [...recentSkills].reverse().find((item) => item.entityId === entityId && item.abilityId === state.abilityId);
  const recentlyResolved = recent?.phase === 'resolved' && tick - recent.tick <= 180;
  const cooldownRatio = state.cooldownTotalTicks > 0 ? state.cooldownRemainingTicks / state.cooldownTotalTicks : 0;
  const castRatio = state.castTotalTicks > 0 ? 1 - state.castRemainingTicks / state.castTotalTicks : 0;
  const seconds = (state.cooldownRemainingTicks / 60).toFixed(1);
  const slot = state.slot === 'ultimate' ? 'ULT' : state.slot === 'basic' ? 'B' : `S${state.slot.slice(-1)}`;
  const activatable = activation.intent !== 'reactive';
  const enabled = controllable && activatable && state.phase === 'ready';
  const armedRatio = state.armedTotalTicks > 0 ? state.armedRemainingTicks / state.armedTotalTicks : 0;
  const cooldownTicks = primary?.cooldownTicks ?? ability?.cooldownTicks ?? 0;

  return (
    <button
      type="button"
      className={`skill-indicator ${state.phase} ${importance} ${recentlyResolved ? 'just-resolved' : ''} ${compact ? 'compact' : ''} ${controllable ? 'interactive' : ''}`}
      title={`${shortName} · ${activation.intent} · ${(cooldownTicks / 60).toFixed(1)}s cooldown`}
      style={{ '--skill-color': hexColor(color), '--cooldown-cover': `${cooldownRatio * 100}%` } as CSSProperties}
      disabled={!enabled}
      onPointerEnter={onPreview}
      onPointerDown={(event) => {
        onPreview?.();
        // Activate on pointer-down for touch/pen so a second finger works even
        // while the analog stick is held (browsers drop the synthetic click
        // during multi-touch). Mouse keeps click activation below.
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          touchActivatedRef.current = true;
          onActivate?.();
        }
      }}
      onFocus={onPreview}
      onClick={() => {
        if (touchActivatedRef.current) { touchActivatedRef.current = false; return; }
        onActivate?.();
      }}
    >
      <span className="skill-slot">{slot}</span>
      <strong className="skill-icon-text">{icon}</strong>
      {!activatable && <span className="passive-mark">AUTO</span>}
      {state.phase === 'armed' && <span className="armed-mark">ARMED</span>}
      {state.phase === 'cooldown' && <span className="cooldown-number">{seconds}</span>}
      {state.phase === 'casting' && <span className="cast-fill" style={{ width: `${castRatio * 100}%` }} />}
      {state.phase === 'armed' && <span className="armed-fill" style={{ width: `${armedRatio * 100}%` }} />}
      <span className="cooldown-shade" />
    </button>
  );
}

function activityPresentation(attackOrAbilityId: string, primary: boolean): {
  shortName: string;
  icon: string;
  color: number;
  importance: 'basic' | 'skill' | 'ultimate';
} {
  if (primary) {
    const attack = getPrimaryAttack(attackOrAbilityId);
    return {
      shortName: attack.name,
      icon: primaryAttackIcon(attack),
      color: primaryAttackUiColor(attack.form),
      importance: 'basic'
    };
  }
  return getSkillPresentation(attackOrAbilityId);
}

function primaryAttackIcon(attack: PrimaryAttackDefinition): string {
  if (attack.behavior === 'spin') return 'SP';
  if (attack.behavior === 'automatic') return 'AR';
  if (attack.behavior === 'throwable') return 'TH';
  if (attack.behavior === 'slam') return 'SL';
  return attack.form.slice(0, 2).toUpperCase();
}

function primaryAttackUiColor(form: AttackForm): number {
  if (form === 'fire') return 0xff7433;
  if (form === 'water') return 0x63dfff;
  if (form === 'ice') return 0xc9f6ff;
  if (form === 'lightning') return 0xffef65;
  if (form === 'nature') return 0x9de277;
  if (form === 'void') return 0xbe82ff;
  return 0xffe2a3;
}

function FighterRecipePreview({ fighter, visual, motion }: { fighter: FighterDefinition; visual: VisualRecipe; motion: MotionRecipe }) {
  const style = {
    '--preview-body': hexColor(visual.bodyColor),
    '--preview-dark': hexColor(visual.bodyDarkColor),
    '--preview-core': hexColor(visual.coreColor),
    '--preview-aura': hexColor(visual.auraColor),
    '--preview-accent': hexColor(visual.accentColor),
    '--preview-pulse': `${Math.max(0.45, 2.4 / Math.max(0.2, motion.pulseSpeed))}s`,
    '--preview-radius': `${Math.max(54, Math.min(112, fighter.physics.radius * 1.65))}px`,
    '--preview-spin': `${Math.max(0.5, 6 / Math.max(0.2, motion.weaponSpin))}s`
  } as CSSProperties;
  return (
    <div className="recipe-preview-stage" style={style}>
      <div className={`recipe-fighter shape-${visual.shape}`}>
        <span className="recipe-aura" />
        <span className="recipe-body">
          {visual.shape === 'mech' && <><i className="mech-horizontal" /><i className="mech-vertical" /></>}
          {visual.shape === 'water' && <><i className="water-bubble one" /><i className="water-bubble two" /></>}
          {visual.shape === 'bomber' && <i className="bomber-rivets" />}
        </span>
        <span className="recipe-core" />
        {visual.horns && <><span className="recipe-horn left" /><span className="recipe-horn right" /></>}
        <span className={`recipe-primary primary-${getPrimaryAttack(fighter.primaryAttackId).form} behavior-${getPrimaryAttack(fighter.primaryAttackId).behavior}`} />
      </div>
      <div className="preview-label"><strong>{fighter.classification.elements[0]}</strong><span>{fighter.classification.archetype}</span></div>
    </div>
  );
}

function CreatorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel-section creator-section"><h2>{title}</h2>{children}</section>;
}

function CreatorField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="creator-field"><span>{label}</span>{children}</label>;
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<strong>{formatNumber(value, step)}</strong></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="color-field"><span>{label}</span><input type="color" value={hexColor(value)} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number.parseInt(event.target.value.slice(1), 16))} /><code>{hexColor(value)}</code></label>;
}

function fighterIconClass(fighter: FighterDefinition): string {
  const element = fighter.classification.elements[0] ?? 'neutral';
  if (['water', 'fire', 'electric', 'ice', 'nature', 'void'].includes(element)) return element;
  if (fighter.id.includes('bomber')) return 'bomber';
  return 'mech';
}

function updateFighterPhysics<K extends keyof FighterDefinition['physics']>(setter: Dispatch<SetStateAction<FighterBundle>>, draft: FighterBundle, key: K, value: FighterDefinition['physics'][K]) {
  setter({ ...draft, fighter: { ...draft.fighter, physics: { ...draft.fighter.physics, [key]: value } } });
}

function updateFighterStats<K extends keyof FighterDefinition['stats']>(setter: Dispatch<SetStateAction<FighterBundle>>, draft: FighterBundle, key: K, value: FighterDefinition['stats'][K]) {
  setter({ ...draft, fighter: { ...draft.fighter, stats: { ...draft.fighter.stats, [key]: value } } });
}

function updateVisual(setter: Dispatch<SetStateAction<FighterBundle>>, draft: FighterBundle, patch: Partial<VisualRecipe>) {
  setter({ ...draft, visualRecipe: { ...draft.visualRecipe, ...patch } });
}

function updateMotion<K extends keyof Omit<MotionRecipe, 'id'>>(setter: Dispatch<SetStateAction<FighterBundle>>, draft: FighterBundle, key: K, value: MotionRecipe[K]) {
  setter({ ...draft, motionRecipe: { ...draft.motionRecipe, [key]: value } });
}

async function readImportFile(event: ChangeEvent<HTMLInputElement>, setText: (value: string) => void, setMessage: (value: string) => void): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setText(await file.text());
    setMessage(`${file.name} loaded. Click “Load into editor” to validate it.`);
  } catch {
    setMessage('Could not read that file.');
  }
  event.target.value = '';
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function uniqueCustomId(base: string, existing: string[]): string {
  let candidate = slugifyFighterId(base);
  let suffix = 2;
  while (existing.includes(candidate)) candidate = `${slugifyFighterId(base)}-${suffix++}`;
  return candidate;
}

function safeModuleSlot(moduleId: string): ModuleSlot | null {
  try {
    return getFighterModule(moduleId).slot;
  } catch {
    return null;
  }
}

function FighterModuleSelectors({ fighter, selectedModuleIds, side, onChange }: {
  fighter: FighterDefinition;
  selectedModuleIds: readonly string[];
  side: 'A' | 'B';
  onChange(side: 'A' | 'B', slot: ModuleSlot, moduleId: string): void;
}) {
  const slots: readonly ModuleSlot[] = ['offense', 'defense', 'mobility', 'utility'];
  const availableSlots = slots
    .map((slot) => ({ slot, modules: listCompatibleModules(fighter, slot) }))
    .filter((entry) => entry.modules.length > 0);
  if (availableSlots.length === 0) return null;

  return (
    <div className="fighter-module-selectors" aria-label={`${fighter.name} modules`}>
      {availableSlots.map(({ slot, modules }) => {
        const selected = selectedModuleIds.find((id) => safeModuleSlot(id) === slot) ?? '';
        const selectedModule = selected ? modules.find((module) => module.id === selected) : undefined;
        const selectId = `fighter-${side.toLowerCase()}-${slot}-module`;
        return (
          <div className="fighter-module-field" key={slot}>
            <label className="field-label stacked-label" htmlFor={selectId}>{slot} module</label>
            <select id={selectId} value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(side, slot, event.target.value)}>
              <option value="">Standard configuration</option>
              {modules.map((module) => (
                <option value={module.id} key={module.id}>
                  {module.name}{module.attachments?.length ? ' · mounted' : ''}
                </option>
              ))}
            </select>
            <small className="fighter-module-description">
              <span>{selectedModule?.description ?? `Use ${fighter.name}'s standard developer-authored configuration.`}</span>
              {(selectedModule?.attachments?.length ?? 0) > 0 && <strong className="mounted-module-badge">Mounted attachment</strong>}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function sameBattleSetup(a: BattleSetup, b: BattleSetup): boolean {
  return a.fighterAId === b.fighterAId
    && a.fighterBId === b.fighterBId
    && sameStringList(a.moduleIdsA, b.moduleIdsA)
    && sameStringList(a.moduleIdsB, b.moduleIdsB)
    && a.controllerA === b.controllerA
    && a.controllerB === b.controllerB
    && a.arenaId === b.arenaId
    && a.modeId === b.modeId
    && a.teamSizeA === b.teamSizeA
    && a.teamSizeB === b.teamSizeB
    && a.friendlyFire === b.friendlyFire
    && a.teamCollision === b.teamCollision
    && a.difficulty === b.difficulty;
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function describeBattleResult(diagnostics: RuntimeDiagnostics, mode: GameModeDefinition | undefined): { title: string; description: string; compact: string } {
  const result = diagnostics.result;
  if (!result) return { title: 'Battle in progress', description: '', compact: `${diagnostics.entities.length} active` };
  if (result.reason === 'draw' || result.winningTeam === null) {
    return { title: 'Draw', description: `No side secured the objective after ${Math.max(1, Math.round(result.endedAtTick / 60))} seconds.`, compact: 'Draw' };
  }
  if (result.reason === 'boss-defeated') {
    return { title: 'Boss Defeated', description: `Team ${result.winningTeam} destroyed the boss and completed the raid.`, compact: 'Boss defeated' };
  }
  if (result.reason === 'survival-complete') {
    return { title: 'Survival Complete', description: `Team ${result.winningTeam} survived the full trial.`, compact: `Team ${result.winningTeam} survived` };
  }
  if (mode?.id === 'duel' && result.winnerEntityIds.length === 1) {
    const winner = diagnostics.entities.find((entity) => entity.id === result.winnerEntityIds[0]);
    const name = winner ? getFighter(winner.fighterId).name : `Team ${result.winningTeam}`;
    return { title: `${name} Wins`, description: `Victory was declared at ${Math.max(1, Math.round(result.endedAtTick / 60))} seconds.`, compact: `${name} won` };
  }
  return {
    title: `Team ${result.winningTeam} Wins`,
    description: result.reason === 'timeout' ? 'Time expired; the team with the stronger surviving force wins.' : 'The opposing force has been eliminated.',
    compact: `Team ${result.winningTeam} won`
  };
}

let seedNonce = 0;

function sameDeviceCapabilities(a: DeviceCapabilities, b: DeviceCapabilities): boolean {
  return a.mobile === b.mobile
    && a.coarsePointer === b.coarsePointer
    && a.anyCoarsePointer === b.anyCoarsePointer
    && a.hoverCapable === b.hoverCapable
    && a.touchPoints === b.touchPoints
    && a.touchFirst === b.touchFirst
    && a.reducedMotion === b.reducedMotion
    && a.hardwareConcurrency === b.hardwareConcurrency
    && a.deviceMemoryGb === b.deviceMemoryGb
    && a.saveData === b.saveData
    && Math.abs(a.devicePixelRatio - b.devicePixelRatio) < 0.01;
}

function sameViewportMetrics(a: ViewportMetrics, b: ViewportMetrics): boolean {
  return a.width === b.width
    && a.height === b.height
    && a.layoutWidth === b.layoutWidth
    && a.layoutHeight === b.layoutHeight
    && a.orientation === b.orientation
    && a.viewportClass === b.viewportClass
    && a.compact === b.compact
    && a.shortLandscape === b.shortLandscape
    && a.standalone === b.standalone
    && a.fullscreen === b.fullscreen;
}

function generateRandomSeed(): number {
  seedNonce = (seedNonce + 1) >>> 0;

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);

    const first = values[0] ?? 0;
    const second = values[1] ?? 0;

    const mixed = (
      first
      ^ second
      ^ (Date.now() >>> 0)
      ^ ((seedNonce * 2654435761) >>> 0)
    ) >>> 0;

    return mixed || 1;
  }

  return (
    Date.now()
    ^ Math.floor(performance.now() * 1000)
    ^ ((seedNonce * 2654435761) >>> 0)
  ) >>> 0 || 1;
}

function splitTags(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatNumber(value: number, step: number): string {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  if (step >= 0.01) return value.toFixed(2);
  return value.toFixed(3);
}

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="metric"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>;
}
