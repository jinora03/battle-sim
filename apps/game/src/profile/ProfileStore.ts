import { createDefaultPlayerProfile, migratePlayerProfile, type PlayerProfile } from '@kinetic/meta';

export const PLAYER_PROFILE_STORAGE_KEY = 'kinetic.player-profile.v2';

export function loadPlayerProfile(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): PlayerProfile {
  if (!storage) return createDefaultPlayerProfile();
  const raw = storage.getItem(PLAYER_PROFILE_STORAGE_KEY);
  if (!raw) return createDefaultPlayerProfile();
  try {
    return migratePlayerProfile(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultPlayerProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile, storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  storage?.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
