import { useState, useCallback } from "react";
import type { Track } from "../types";

const HISTORY_STORAGE_KEY = "llama-player-history";
const MAX_HISTORY = 100;

interface HistoryEntry {
  track: Track;
  playedAt: number; // timestamp
}

function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry: unknown): entry is HistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        "track" in entry &&
        "playedAt" in entry
    );
  } catch {
    return [];
  }
}

function saveHistoryToStorage(entries: HistoryEntry[]): void {
  try {
    // Keep only the latest MAX_HISTORY entries
    const trimmed = entries.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("[Llama Player] Erro ao salvar histórico:", err);
  }
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistoryFromStorage);

  const addEntry = useCallback((track: Track) => {
    setEntries((prev) => {
      // Remove duplicate if exists (same track id)
      const filtered = prev.filter((e) => e.track.id !== track.id);
      const newEntry: HistoryEntry = {
        track,
        playedAt: Date.now(),
      };
      const updated = [newEntry, ...filtered];
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    saveHistoryToStorage([]);
  }, []);

  return { entries, addEntry, clear };
}
