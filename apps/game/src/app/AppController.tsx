import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  getFighter,
  isCustomFighter,
  listAbilities,
  listAiProfiles,
  listArenas,
  listFighters,
  listGameModes,
  listPrimaryAttacks,
  removeCustomFighter
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
import type { ControllerKind, ModuleSlot } from '@kinetic/protocol';
import {
  applyQualityPreset,
  detectDeviceCapabilities,
  detectViewportMetrics,
  shouldShowTouchControls,
  type AppSettings,
  type QualityPresetId
} from '@kinetic/platform';
import {
  getMotionRecipe,
  getVisualRecipe,
  removeCustomMotionRecipe,
  removeCustomVisualRecipe
} from '@kinetic/visual-engine';
import { createDefaultBattleSetup, type BattleSetup } from '../runtime/BattleSetup';
import { loadPlayerProfile, savePlayerProfile } from '../profile/ProfileStore';
import { loadAppSettings, resetAppSettings, saveAppSettings } from '../settings/SettingsStore';
import type { ReleaseView } from '../ReleaseHome';
import { initialLaunchPhase, type BattleLaunchPhase } from '../ui/battleLaunch';
import {
  aggregateActiveCasts,
  noticeDurationMs,
  resolveEliminationProgress,
  shouldSuppressNoticeOnCompactViewport,
  type TimedNotice
} from '../ui/presentation';
import { safeModuleSlot } from '../features/battle/FighterModuleSelectors';
import { activityPresentation } from '../features/battle/BattleFighterControls';
import {
  describeBattleResult,
  generateRandomSeed,
  resolveFreshRematchSeed,
  sameBattleSetup,
  sameDeviceCapabilities,
  sameViewportMetrics
} from '../features/battle/battleUtils';
import { useBattleInput } from '../hooks/useBattleInput';
import { useBattleRuntime } from '../hooks/useBattleRuntime';
import { useReplayVideoExport } from '../hooks/useReplayVideoExport';

const STORAGE_KEY = 'kinetic.custom-fighter-bundles.v1';

function createStarterBundle(name = 'Arc Prototype', requestedId?: string): FighterBundle {
  const id = requestedId ?? slugifyFighterId(name);
  const source = getFighter('volt-striker');
  return {
    schemaVersion: 2,
    fighter: {
      id,
      name,
      classification: { archetype: 'striker', elements: ['electric'], traits: ['custom', 'experimental'] },
      physics: { radius: 45, mass: 1.25, restitution: 0.94, linearDamping: 0.993, maxSpeed: 12.2 },
      stats: { maxHp: 225, moveAcceleration: 0.2 },
      aiProfileId: source.aiProfileId,
      kitSourceFighterId: source.id,
      passiveIds: structuredClone(source.passiveIds ?? []),
      combatResources: structuredClone(source.combatResources ?? []),
      abilitySlots: structuredClone(source.abilitySlots),
      moduleSlots: structuredClone(source.moduleSlots ?? {}),
      defaultModuleIds: [],
      resistances: structuredClone(source.resistances),
      visualRecipeId: `${id}-visual`,
      animationRecipeId: `${id}-motion`,
      audioProfileId: source.audioProfileId,
      primaryAttackId: source.primaryAttackId
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

export function useAppController() {
  const battleStageRef = useRef<HTMLElement | null>(null);
  const setupPanelRef = useRef<HTMLDetailsElement | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const toastCounterRef = useRef(0);
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
  const activeSeedRef = useRef((Number(seedText) >>> 0) || 1);
  const [setup, setSetup] = useState<BattleSetup>(createDefaultBattleSetup);
  const [activeSetup, setActiveSetup] = useState<BattleSetup>(createDefaultBattleSetup);
  const [setupPanelOpen, setSetupPanelOpen] = useState(true);
  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState(false);
  const [battleDrawerOpen, setBattleDrawerOpen] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [battleLaunchPhase, setBattleLaunchPhase] = useState<BattleLaunchPhase>('ready');
  const [draft, setDraft] = useState<FighterBundle>(() => customBundles[0] ?? createStarterBundle());
  const [creatorMessage, setCreatorMessage] = useState('Edit the recipe, validate it, then save or test the fighter.');
  const [importText, setImportText] = useState('');
  const [sourceFighterId, setSourceFighterId] = useState('volt-striker');
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const profileRef = useRef(profile);
  const [progressNotices, setProgressNotices] = useState<ProgressionNotice[]>([]);
  const [toastNotices, setToastNotices] = useState<TimedNotice[]>([]);
  const appendNotices = useCallback((items: readonly ProgressionNotice[]) => {
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
  }, []);
  const onAchievementUnlocked = useCallback((unlock: AchievementUnlock) => {
    const update = applyAchievementToProfile(profileRef.current, unlock);
    profileRef.current = update.profile;
    setProfile(update.profile);
    appendNotices(update.notices);
  }, [appendNotices]);
  const onBattleCompleted = useCallback((summary: BattleCompletionSummary) => {
    const update = recordBattleToProfile(profileRef.current, summary);
    profileRef.current = update.profile;
    setProfile(update.profile);
    appendNotices(update.notices);
  }, [appendNotices]);
  const metaCallbacks = useMemo(
    () => ({ onAchievementUnlocked, onBattleCompleted }),
    [onAchievementUnlocked, onBattleCompleted]
  );
  const touchControlsVisible = shouldShowTouchControls(settings.touchControls, deviceCapabilities);
  const {
    runtimeRef,
    diagnostics,
    ready,
    bootError,
    pausedBySystem,
    attachBattleHost,
    restartBattleWhenReady,
    retryBoot
  } = useBattleRuntime({
    initialSeed: Number(seedText) || 1,
    settings,
    setSettings,
    view,
    activeSetup,
    difficulty: profile.difficulty,
    unlockedAchievementIds: profile.unlockedAchievementIds,
    touchControlsVisible,
    pausedByUser,
    battleLaunchPhase,
    setBattleLaunchPhase,
    metaCallbacks
  });
  const videoExport = useReplayVideoExport(runtimeRef, settings, setup, Number(seedText) || 1);

  const validation = useMemo(() => validateFighterBundle(draft), [draft]);
  const activeCasts = diagnostics.entities.flatMap((entity) =>
    entity.abilities
      .filter((ability) => ability.phase === 'casting')
      .map((ability) => ({ entity, ability }))
  );
  const playerEntity = diagnostics.entities.find((entity) => entity.controller === 'player');
  const {
    movePlayer,
    activate,
    previewAbility,
    aimFromPointer,
    aimAndFireFromPointer,
    handleArenaPointerLeave
  } = useBattleInput({
    runtimeRef,
    view,
    battleLaunchPhase,
    movementMode: settings.movementMode,
    touchControlsVisible,
    hasPlayerEntity: Boolean(playerEntity)
  });
  const configuredArena = arenas.find((arena) => arena.id === setup.arenaId) ?? arenas[0];
  const configuredMode = gameModes.find((mode) => mode.id === setup.modeId) ?? gameModes[0];
  const configuredFighterA = getFighter(setup.fighterAId);
  const configuredFighterB = getFighter(setup.fighterBId);
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
    let settleTimer = 0;
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
    const scheduleEnvironmentRefresh = () => {
      refreshEnvironment();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(refreshEnvironment, 220);
    };
    const queries = [
      window.matchMedia?.('(pointer: coarse)'),
      window.matchMedia?.('(any-pointer: coarse)'),
      window.matchMedia?.('(hover: hover)'),
      window.matchMedia?.('(display-mode: standalone)'),
      window.matchMedia?.('(shape: round)')
    ].filter((query): query is MediaQueryList => Boolean(query));
    window.addEventListener('resize', scheduleEnvironmentRefresh, { passive: true });
    window.addEventListener('orientationchange', scheduleEnvironmentRefresh, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleEnvironmentRefresh, { passive: true });
    document.addEventListener('fullscreenchange', scheduleEnvironmentRefresh);
    for (const query of queries) query.addEventListener?.('change', scheduleEnvironmentRefresh);
    scheduleEnvironmentRefresh();
    return () => {
      if (refreshRaf !== 0) window.cancelAnimationFrame(refreshRaf);
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', scheduleEnvironmentRefresh);
      window.removeEventListener('orientationchange', scheduleEnvironmentRefresh);
      window.visualViewport?.removeEventListener('resize', scheduleEnvironmentRefresh);
      document.removeEventListener('fullscreenchange', scheduleEnvironmentRefresh);
      for (const query of queries) query.removeEventListener?.('change', scheduleEnvironmentRefresh);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.orientation = viewportMetrics.orientation;
    document.documentElement.dataset.viewport = viewportMetrics.viewportClass;
    document.documentElement.dataset.shortLandscape = viewportMetrics.shortLandscape ? 'true' : 'false';
    document.documentElement.dataset.displayShape = viewportMetrics.displayShape;
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

  const prepareBattleForStart = (seed: number, nextSetup: BattleSetup) => {
    activeSeedRef.current = (seed >>> 0) || 1;
    setSeedText(String(activeSeedRef.current));
    setActiveSetup(nextSetup);
    setPausedByUser(false);
    setBattleLaunchPhase('ready');
    restartBattleWhenReady(seed, nextSetup);
  };

  const launchBattle = (seed: number, nextSetup: BattleSetup) => {
    activeSeedRef.current = (seed >>> 0) || 1;
    setSeedText(String(activeSeedRef.current));
    setActiveSetup(nextSetup);
    setPausedByUser(false);
    restartBattleWhenReady(seed, nextSetup);
    setBattleLaunchPhase(initialLaunchPhase(settings.showBattleIntros));
  };

  const replaySameBattle = () => {
    launchBattle(activeSeedRef.current, activeSetup);
  };

  const rematchBattle = () => {
    const nextSeed = resolveFreshRematchSeed(activeSeedRef.current, generateRandomSeed());
    launchBattle(nextSeed, activeSetup);
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
    const next: BattleSetup = { ...setup, fighterAId: saved.fighter.id, moduleIdsA: [...(saved.fighter.defaultModuleIds ?? [])], controllerA: 'player', controllerB: 'ai' };
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
    if (result.bundle.fighter.kitSourceFighterId) setSourceFighterId(result.bundle.fighter.kitSourceFighterId);
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
        kitSourceFighterId: source.kitSourceFighterId ?? source.id,
        classification: { ...source.classification, traits: [...source.classification.traits, 'custom'] },
        defaultModuleIds: [],
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
    const next = { ...createDefaultBattleSetup(), difficulty: fresh.difficulty };
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

  const closeBattleSetup = () => {
    setBattleDrawerOpen(false);
  };

  const openBattleSetup = () => {
    setSetupPanelOpen(true);
    if (viewportMetrics.width <= 900) {
      if (battleLaunchPhase === 'running' && !diagnostics.battleEnded) setPausedByUser(true);
      setBattleDrawerOpen(true);
    }
    window.setTimeout(() => setupPanelRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'start' }), 0);
  };

  const startConfiguredBattle = () => {
    setBattleDrawerOpen(false);
    startNewBattle(setup);
  };

  const dismissToast = (noticeId: number) => {
    setToastNotices((current) => current.filter((item) => item.id !== noticeId));
  };

  const changeDifficulty = (difficulty: PlayerProfile['difficulty']) => {
    setProfile((current) => ({ ...current, difficulty, updatedAt: Date.now() }));
    updateSetup({ difficulty });
  };

  const changeProfileName = (displayName: string) => {
    setProfile((current) => ({
      ...current,
      displayName: displayName || 'Arena Pilot',
      updatedAt: Date.now()
    }));
  };

  const deleteLoadout = (id: string) => {
    setProfile((current) => removeBattlePreset(current, id));
  };

  const unlockAllFighters = () => {
    const builtInFighterIds = fighters
      .filter((fighter) => !isCustomFighter(fighter.id))
      .map((fighter) => fighter.id);
    setProfile((current) => unlockAllFightersForTesting(current, builtInFighterIds));
  };

  const createBlankDraft = () => {
    setSourceFighterId('volt-striker');
    setDraft(createStarterBundle());
    setCreatorMessage('Started a clean Arc Prototype recipe.');
  };

  return {
    shell: {
      view,
      setView,
      settings,
      deviceCapabilities,
      viewportMetrics,
      touchControlsVisible,
      toastNotices,
      dismissToast
    },
    catalog: {
      fighters,
      abilities,
      aiProfiles,
      primaryAttacks,
      arenas,
      gameModes
    },
    battle: {
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
      videoExport,
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
      prepareBattleForStart,
      launchBattle,
      replaySameBattle,
      rematchBattle,
      startNewBattle,
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
      openPreparedBattle,
      launchReleaseBattle,
      playAsFighter,
      setRosterOpponent,
      openBattleSetup,
      closeBattleSetup,
      startConfiguredBattle
    },
    progression: {
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
    },
    creator: {
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
    }
  };
}

export type AppController = ReturnType<typeof useAppController>;

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
