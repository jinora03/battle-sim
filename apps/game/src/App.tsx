import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent
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
import type { BattleSetup } from './runtime/BattleRuntime';
import { ProfileView } from './ProfileView';
import { loadPlayerProfile, savePlayerProfile } from './profile/ProfileStore';
import { loadAppSettings, resetAppSettings, saveAppSettings } from './settings/SettingsStore';
import { ReleaseHome, type ReleaseView } from './ReleaseHome';
import { RosterView } from './RosterView';
import { TrainingLabView } from './TrainingLabView';
import { AppNavigation, DrawerScrim, NeonButton } from './ui/NeonUI';
import { BattleIntroOverlay } from './BattleIntroOverlay';
import { initialLaunchPhase, type BattleLaunchPhase } from './ui/battleLaunch';
import {
  aggregateActiveCasts,
  noticeDurationMs,
  resolveEliminationProgress,
  shouldSuppressNoticeOnCompactViewport,
  type TimedNotice
} from './ui/presentation';
import { Metric, hexColor } from './ui/FormControls';
import { BattleSetupDrawer } from './features/battle/BattleSetupDrawer';
import { safeModuleSlot } from './features/battle/FighterModuleSelectors';
import { DirectionPad, FighterCard, SkillIndicator, activityPresentation } from './features/battle/BattleFighterControls';
import {
  describeBattleResult,
  generateRandomSeed,
  sameBattleSetup,
  sameDeviceCapabilities,
  sameViewportMetrics
} from './features/battle/battleUtils';
import { DeveloperFighterWorkshop } from './features/creator/DeveloperFighterWorkshop';
import { useBattleInput } from './hooks/useBattleInput';
import { useBattleRuntime } from './hooks/useBattleRuntime';

const STORAGE_KEY = 'kinetic.custom-fighter-bundles.v1';
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

function createStarterBundle(name = 'Arc Prototype', requestedId?: string): FighterBundle {
  const id = requestedId ?? slugifyFighterId(name);
  return {
    schemaVersion: 2,
    fighter: {
      id,
      name,
      classification: { archetype: 'striker', elements: ['electric'], traits: ['custom', 'experimental'] },
      physics: { radius: 45, mass: 1.25, restitution: 0.94, linearDamping: 0.993, maxSpeed: 12.2 },
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
  const battleStageRef = useRef<HTMLElement | null>(null);
  const setupPanelRef = useRef<HTMLDetailsElement | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const toastCounterRef = useRef(0);
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
            onDifficultyChange={(difficulty) => {
              setProfile((current) => ({ ...current, difficulty, updatedAt: Date.now() }));
              updateSetup({ difficulty });
            }}
            onQualityPresetChange={selectQualityPreset}
            onSettingChange={updateAppSetting}
            onToggleFullscreen={() => void toggleFullscreenBattle()}
            onRestoreSettings={restoreRecommendedSettings}
          />
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
          onCreateBlank={() => {
            setDraft(createStarterBundle());
            setCreatorMessage('Started a clean Arc Prototype recipe.');
          }}
          onSave={() => { void saveDraft(); }}
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
