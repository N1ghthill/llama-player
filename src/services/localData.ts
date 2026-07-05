import { clearAudioCache, getCacheStats } from "./audioCache";

export const LOCAL_STORAGE_KEYS = {
  favorites: "llama-player-favorites",
  history: "llama-player-history",
  playlists: "llama-player-custom-playlists",
  theme: "llama-player-theme",
} as const;

export interface LocalDataSummary {
  key: string;
  label: string;
  bytes: number;
  exists: boolean;
}

const LOCAL_DATA_LABELS: Record<string, string> = {
  [LOCAL_STORAGE_KEYS.favorites]: "Favoritos",
  [LOCAL_STORAGE_KEYS.history]: "Historico",
  [LOCAL_STORAGE_KEYS.playlists]: "Playlists",
  [LOCAL_STORAGE_KEYS.theme]: "Tema",
};

function byteLength(value: string): number {
  return new Blob([value]).size;
}

export function getLocalDataSummary(): LocalDataSummary[] {
  return Object.values(LOCAL_STORAGE_KEYS).map((key) => {
    const value = localStorage.getItem(key);
    return {
      key,
      label: LOCAL_DATA_LABELS[key] ?? key,
      bytes: value ? byteLength(value) : 0,
      exists: value !== null,
    };
  });
}

export function clearLocalPreferences(): void {
  for (const key of Object.values(LOCAL_STORAGE_KEYS)) {
    localStorage.removeItem(key);
  }
}

export async function clearAllLocalData(): Promise<void> {
  clearLocalPreferences();
  await clearAudioCache();
}

export async function getTotalLocalDataBytes(): Promise<{
  localStorageBytes: number;
  cacheBytes: number;
}> {
  const summary = getLocalDataSummary();
  const cache = await getCacheStats();

  return {
    localStorageBytes: summary.reduce((total, item) => total + item.bytes, 0),
    cacheBytes: cache.totalSize,
  };
}
