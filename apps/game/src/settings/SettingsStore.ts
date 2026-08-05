import { createDefaultAppSettings, detectDeviceCapabilities, normalizeAppSettings, type AppSettings } from '@kinetic/platform';

const STORAGE_KEY = 'kinetic.app-settings.v11';
const PREVIOUS_KEYS = [
  'kinetic.app-settings.v10',
  'kinetic.app-settings.v9',
  'kinetic.app-settings.v8',
  'kinetic.app-settings.v7',
  'kinetic.app-settings.v6',
  'kinetic.app-settings.v5',
  'kinetic.app-settings.v4',
  'kinetic.app-settings.v3',
  'kinetic.app-settings.v2',
  'kinetic.presentation-settings.v1'
];

export function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') return createDefaultAppSettings();
  const capabilities = detectDeviceCapabilities();
  const raw = window.localStorage.getItem(STORAGE_KEY)
    ?? PREVIOUS_KEYS.map((key) => window.localStorage.getItem(key)).find((value) => value !== null)
    ?? null;
  if (!raw) return createDefaultAppSettings(capabilities);
  try {
    return normalizeAppSettings(JSON.parse(raw), capabilities);
  } catch {
    return createDefaultAppSettings(capabilities);
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetAppSettings(): AppSettings {
  const settings = createDefaultAppSettings(detectDeviceCapabilities());
  saveAppSettings(settings);
  return settings;
}
