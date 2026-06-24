import { useState, useCallback } from "react";

const STORAGE_KEY = "llama-player-favorites";

function loadFavoritesFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function saveFavoritesToStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error("[Llama Player] Erro ao salvar favoritos:", err);
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavoritesFromStorage);

  const loadFavorites = useCallback((): string[] => {
    const ids = loadFavoritesFromStorage();
    setFavoriteIds(ids);
    return ids;
  }, []);

  const toggleFavorite = useCallback((trackId: string): string[] => {
    const current = loadFavoritesFromStorage();
    const index = current.indexOf(trackId);
    const updated =
      index === -1
        ? [...current, trackId]
        : current.filter((id) => id !== trackId);
    saveFavoritesToStorage(updated);
    setFavoriteIds(updated);
    return updated;
  }, []);

  const isFavorite = useCallback((trackId: string): boolean => {
    return favoriteIds.includes(trackId);
  }, [favoriteIds]);

  return { favoriteIds, toggleFavorite, isFavorite, loadFavorites };
}
