import type { RenderProfileId } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';

export type QualityPresetId = 'auto' | 'battery' | 'balanced' | 'high' | 'custom';
export type TargetRenderFps = 30 | 60;
export type TouchControlMode = 'auto' | 'always' | 'never';
export type MovementMode = 'wasd' | 'mouse';
export type AimAssistLevel = 'off' | 'light' | 'medium' | 'strong';
export type ViewportOrientation = 'portrait' | 'landscape';
export type ViewportClass = 'compact' | 'medium' | 'wide';

export interface DeviceCapabilities {
  mobile: boolean;
  coarsePointer: boolean;
  anyCoarsePointer: boolean;
  hoverCapable: boolean;
  touchPoints: number;
  touchFirst: boolean;
  reducedMotion: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  saveData: boolean;
  devicePixelRatio: number;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  layoutWidth: number;
  layoutHeight: number;
  orientation: ViewportOrientation;
  viewportClass: ViewportClass;
  compact: boolean;
  shortLandscape: boolean;
  standalone: boolean;
  fullscreen: boolean;
}

export interface CanvasResolutionInput {
  devicePixelRatio: number;
  maxDevicePixelRatio: number;
  renderScale: number;
  adaptiveScale?: number;
}

export interface CanvasResolution {
  effectiveResolution: number;
  cappedDevicePixelRatio: number;
  renderScale: number;
  adaptiveScale: number;
}

export interface AppSettings {
  schemaVersion: 11;
  qualityPreset: QualityPresetId;
  renderProfile: RenderProfileId;
  effects: boolean;
  arenaBackground: boolean;
  trails: boolean;
  cameraShake: boolean;
  impactFreeze: boolean;
  showMountedAttachments: boolean;
  showFighterHealthRings: boolean;
  showDamageNumbers: boolean;
  showBattleIntros: boolean;
  cameraFollow: boolean;
  screenFlash: boolean;
  audio: boolean;
  masterVolume: number;
  particleScale: number;
  maxDevicePixelRatio: number;
  renderScale: number;
  targetRenderFps: TargetRenderFps;
  adaptiveQuality: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  largeTouchControls: boolean;
  touchControlOpacity: number;
  touchSteeringSensitivity: number;
  touchControls: TouchControlMode;
  fullscreenBattle: boolean;
  movementMode: MovementMode;
  aimAssist: AimAssistLevel;
}

export interface QualityPresetDefinition {
  id: Exclude<QualityPresetId, 'auto' | 'custom'>;
  label: string;
  description: string;
  values: Pick<AppSettings,
    | 'renderProfile'
    | 'effects'
    | 'trails'
    | 'cameraShake'
    | 'impactFreeze'
    | 'screenFlash'
    | 'particleScale'
    | 'maxDevicePixelRatio'
    | 'renderScale'
    | 'targetRenderFps'
    | 'adaptiveQuality'
  >;
}

export const qualityPresets: Record<QualityPresetDefinition['id'], QualityPresetDefinition> = {
  battery: {
    id: 'battery', label: 'Battery saver', description: '30 FPS, lower internal resolution and simplified effects.',
    values: {
      renderProfile: 'minimal', effects: true, trails: false, cameraShake: false, impactFreeze: false,
      screenFlash: false, particleScale: 0.24, maxDevicePixelRatio: 1.25, renderScale: 0.72,
      targetRenderFps: 30, adaptiveQuality: true
    }
  },
  balanced: {
    id: 'balanced', label: 'Balanced', description: 'Responsive mobile-friendly rendering with a sharp arena.',
    values: {
      renderProfile: 'standard', effects: true, trails: true, cameraShake: true, impactFreeze: true,
      screenFlash: true, particleScale: 0.68, maxDevicePixelRatio: 1.75, renderScale: 0.9,
      targetRenderFps: 60, adaptiveQuality: true
    }
  },
  high: {
    id: 'high', label: 'High quality', description: 'Full internal resolution and effects for capable devices.',
    values: {
      renderProfile: 'standard', effects: true, trails: true, cameraShake: true, impactFreeze: true,
      screenFlash: true, particleScale: 1, maxDevicePixelRatio: 2, renderScale: 1,
      targetRenderFps: 60, adaptiveQuality: false
    }
  }
};

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      mobile: false,
      coarsePointer: false,
      anyCoarsePointer: false,
      hoverCapable: true,
      touchPoints: 0,
      touchFirst: false,
      reducedMotion: false,
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      saveData: false,
      devicePixelRatio: 1
    };
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const anyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)').matches ?? coarsePointer;
  const hoverCapable = window.matchMedia?.('(hover: hover)').matches ?? !coarsePointer;
  const touchPoints = Math.max(0, nav.maxTouchPoints || 0);
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) < 760;
  const touchFirst = coarsePointer || (touchPoints > 0 && !hoverCapable);
  return {
    mobile: touchFirst || compactViewport,
    coarsePointer,
    anyCoarsePointer,
    hoverCapable,
    touchPoints,
    touchFirst,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    hardwareConcurrency: Math.max(1, nav.hardwareConcurrency || 4),
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    saveData: Boolean(nav.connection?.saveData),
    devicePixelRatio: Math.max(1, window.devicePixelRatio || 1)
  };
}

export function classifyViewport(width: number, height: number): Pick<ViewportMetrics, 'orientation' | 'viewportClass' | 'compact' | 'shortLandscape'> {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const orientation: ViewportOrientation = safeWidth >= safeHeight ? 'landscape' : 'portrait';
  const shortLandscape = orientation === 'landscape' && safeHeight <= 560;
  const compact = Math.min(safeWidth, safeHeight) < 700 || safeWidth < 760;
  const viewportClass: ViewportClass = safeWidth < 700 ? 'compact' : safeWidth < 1180 ? 'medium' : 'wide';
  return { orientation, viewportClass, compact, shortLandscape };
}

export function detectViewportMetrics(): ViewportMetrics {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      width: 1280,
      height: 720,
      layoutWidth: 1280,
      layoutHeight: 720,
      ...classifyViewport(1280, 720),
      standalone: false,
      fullscreen: false
    };
  }
  const visualViewport = window.visualViewport;
  const width = Math.max(1, Math.round(visualViewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(visualViewport?.height ?? window.innerHeight));
  return {
    width,
    height,
    layoutWidth: Math.max(1, Math.round(window.innerWidth)),
    layoutHeight: Math.max(1, Math.round(window.innerHeight)),
    ...classifyViewport(width, height),
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true,
    fullscreen: Boolean(document.fullscreenElement)
  };
}

export function resolveCanvasResolution(input: CanvasResolutionInput): CanvasResolution {
  const devicePixelRatio = clamp(input.devicePixelRatio, 1, 0.5, 4);
  const maxDevicePixelRatio = clamp(input.maxDevicePixelRatio, 1.5, 0.75, 3);
  const renderScale = clamp(input.renderScale, 1, 0.5, 1);
  const adaptiveScale = clamp(input.adaptiveScale, 1, 0.55, 1);
  const cappedDevicePixelRatio = Math.min(devicePixelRatio, maxDevicePixelRatio);
  const effectiveResolution = Math.max(0.65, Math.min(3, cappedDevicePixelRatio * renderScale * adaptiveScale));
  return {
    effectiveResolution: Math.round(effectiveResolution * 100) / 100,
    cappedDevicePixelRatio,
    renderScale,
    adaptiveScale
  };
}

export function recommendQualityPreset(capabilities: DeviceCapabilities): QualityPresetDefinition['id'] {
  if (capabilities.saveData || capabilities.reducedMotion) return 'battery';
  if (capabilities.mobile && (capabilities.hardwareConcurrency <= 4 || (capabilities.deviceMemoryGb !== null && capabilities.deviceMemoryGb <= 4))) return 'battery';
  if (!capabilities.mobile && capabilities.hardwareConcurrency >= 8 && (capabilities.deviceMemoryGb === null || capabilities.deviceMemoryGb >= 8)) return 'high';
  return 'balanced';
}

export function shouldShowTouchControls(mode: TouchControlMode, capabilities: DeviceCapabilities): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return capabilities.touchFirst;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function createDefaultAppSettings(capabilities = detectDeviceCapabilities()): AppSettings {
  const recommended = recommendQualityPreset(capabilities);
  const base = qualityPresets[recommended].values;
  return {
    schemaVersion: 11,
    qualityPreset: 'auto',
    ...base,
    cameraFollow: false,
    showMountedAttachments: true,
    showFighterHealthRings: true,
    showDamageNumbers: true,
    showBattleIntros: true,
    arenaBackground: true,
    audio: true,
    masterVolume: 0.32,
    reducedMotion: capabilities.reducedMotion,
    highContrast: false,
    largeTouchControls: capabilities.touchFirst,
    touchControlOpacity: 0.75,
    touchSteeringSensitivity: 1,
    touchControls: 'auto',
    fullscreenBattle: false,
    movementMode: 'mouse',
    aimAssist: 'light'
  };
}

export function applyQualityPreset(current: AppSettings, preset: QualityPresetId, capabilities = detectDeviceCapabilities()): AppSettings {
  if (preset === 'custom') return { ...current, qualityPreset: 'custom' };
  const resolved = preset === 'auto' ? recommendQualityPreset(capabilities) : preset;
  return {
    ...current,
    ...qualityPresets[resolved].values,
    qualityPreset: preset,
    reducedMotion: current.reducedMotion || capabilities.reducedMotion
  };
}

export function normalizeAppSettings(input: unknown, capabilities = detectDeviceCapabilities()): AppSettings {
  const defaults = createDefaultAppSettings(capabilities);
  if (!input || typeof input !== 'object') return defaults;
  const raw = input as Partial<AppSettings> & { schemaVersion?: number };
  const preset = ['auto', 'battery', 'balanced', 'high', 'custom'].includes(String(raw.qualityPreset))
    ? raw.qualityPreset as QualityPresetId
    : defaults.qualityPreset;
  const seeded = applyQualityPreset(defaults, preset, capabilities);
  const renderProfile = ['standard', 'minimal', 'debug'].includes(String(raw.renderProfile)) ? raw.renderProfile as RenderProfileId : seeded.renderProfile;
  const targetRenderFps: TargetRenderFps = raw.targetRenderFps === 30 ? 30 : 60;
  const touchControls = ['auto', 'always', 'never'].includes(String(raw.touchControls))
    ? raw.touchControls as TouchControlMode
    : defaults.touchControls;
  const movementMode = ['wasd', 'mouse'].includes(String((raw as AppSettings).movementMode))
    ? (raw as AppSettings).movementMode as MovementMode
    : defaults.movementMode;
  const aimAssist = ['off', 'light', 'medium', 'strong'].includes(String((raw as AppSettings).aimAssist))
    ? (raw as AppSettings).aimAssist as AimAssistLevel
    : defaults.aimAssist;
  return {
    ...seeded,
    schemaVersion: 11,
    qualityPreset: preset,
    renderProfile,
    effects: typeof raw.effects === 'boolean' ? raw.effects : seeded.effects,
    arenaBackground: typeof raw.arenaBackground === 'boolean' ? raw.arenaBackground : seeded.arenaBackground,
    trails: typeof raw.trails === 'boolean' ? raw.trails : seeded.trails,
    cameraShake: typeof raw.cameraShake === 'boolean' ? raw.cameraShake : seeded.cameraShake,
    impactFreeze: typeof raw.impactFreeze === 'boolean' ? raw.impactFreeze : seeded.impactFreeze,
    showMountedAttachments: typeof raw.showMountedAttachments === 'boolean' ? raw.showMountedAttachments : true,
    showFighterHealthRings: typeof raw.showFighterHealthRings === 'boolean' ? raw.showFighterHealthRings : true,
    showDamageNumbers: typeof raw.showDamageNumbers === 'boolean' ? raw.showDamageNumbers : true,
    showBattleIntros: typeof raw.showBattleIntros === 'boolean' ? raw.showBattleIntros : true,
    cameraFollow: typeof raw.cameraFollow === 'boolean' ? raw.cameraFollow : seeded.cameraFollow,
    screenFlash: typeof raw.screenFlash === 'boolean' ? raw.screenFlash : seeded.screenFlash,
    audio: (raw.schemaVersion ?? 0) < 3 ? true : typeof raw.audio === 'boolean' ? raw.audio : seeded.audio,
    masterVolume: clamp(raw.masterVolume, seeded.masterVolume, 0, 1),
    particleScale: clamp(raw.particleScale, seeded.particleScale, 0, 1.5),
    maxDevicePixelRatio: clamp(raw.maxDevicePixelRatio, seeded.maxDevicePixelRatio, 0.75, 3),
    renderScale: clamp(raw.renderScale, seeded.renderScale, 0.5, 1),
    targetRenderFps,
    adaptiveQuality: typeof raw.adaptiveQuality === 'boolean' ? raw.adaptiveQuality : seeded.adaptiveQuality,
    reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : seeded.reducedMotion,
    highContrast: typeof raw.highContrast === 'boolean' ? raw.highContrast : seeded.highContrast,
    largeTouchControls: typeof raw.largeTouchControls === 'boolean' ? raw.largeTouchControls : seeded.largeTouchControls,
    touchControlOpacity: clamp(raw.touchControlOpacity, seeded.touchControlOpacity, 0.3, 1),
    touchSteeringSensitivity: clamp(raw.touchSteeringSensitivity, seeded.touchSteeringSensitivity, 0.6, 1.6),
    touchControls,
    fullscreenBattle: typeof raw.fullscreenBattle === 'boolean' ? raw.fullscreenBattle : seeded.fullscreenBattle,
    movementMode,
    aimAssist
  };
}

export function toPresentationSettings(settings: AppSettings): PresentationSettings {
  return {
    renderProfile: settings.renderProfile,
    effects: settings.effects,
    arenaBackground: settings.arenaBackground,
    trails: settings.trails,
    cameraShake: settings.cameraShake && !settings.reducedMotion,
    impactFreeze: settings.impactFreeze && !settings.reducedMotion,
    showMountedAttachments: settings.showMountedAttachments,
    showFighterHealthRings: settings.showFighterHealthRings,
    showDamageNumbers: settings.showDamageNumbers,
    cameraFollow: settings.cameraFollow,
    screenFlash: settings.screenFlash && !settings.reducedMotion,
    audio: settings.audio,
    masterVolume: settings.masterVolume,
    particleScale: settings.particleScale,
    maxDevicePixelRatio: settings.maxDevicePixelRatio,
    renderScale: settings.renderScale,
    targetRenderFps: settings.targetRenderFps,
    adaptiveQuality: settings.adaptiveQuality,
    reducedMotion: settings.reducedMotion
  };
}
