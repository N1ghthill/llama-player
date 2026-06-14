const STORAGE_KEY = "llama-player-favorites";

export function useFavorites() {
  function loadFavorites(): string[] {
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

  function saveFavorites(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (err) {
      console.error("[Llama Player] Erro ao salvar favoritos:", err);
    }
  }

  function toggleFavorite(trackId: string): string[] {
    const current = loadFavorites();
    const index = current.indexOf(trackId);
    const updated =
      index === -1
        ? [...current, trackId]
        : current.filter((id) => id !== trackId);
    saveFavorites(updated);
    return updated;
  }

  function isFavorite(trackId: string): boolean {
    const current = loadFavorites();
    return current.includes(trackId);
  }

  return { favoriteIds: loadFavorites(), toggleFavorite, isFavorite, loadFavorites };
}
