import { useState, useCallback } from "react";
import type { Track } from "../types";

const STORAGE_KEY = "llama-player-custom-playlists";

export interface SavedPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

function loadPlaylistsFromStorage(): SavedPlaylist[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is SavedPlaylist =>
        typeof p === "object" &&
        p !== null &&
        "id" in p &&
        "name" in p &&
        "tracks" in p
    );
  } catch {
    return [];
  }
}

function savePlaylistsToStorage(playlists: SavedPlaylist[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch (err) {
    console.error("[Llama Player] Erro ao salvar playlists:", err);
  }
}

function generateId(): string {
  return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(loadPlaylistsFromStorage);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const saveCurrentPlaylist = useCallback(
    (name: string, tracks: Track[]) => {
      const now = Date.now();
      setPlaylists((prev) => {
        const existing = prev.find((p) => p.id === activePlaylistId);
        let updated: SavedPlaylist[];

        if (existing) {
          // Update existing playlist
          updated = prev.map((p) =>
            p.id === activePlaylistId
              ? { ...p, name, tracks: [...tracks], updatedAt: now }
              : p
          );
        } else {
          // Create new playlist
          const newPlaylist: SavedPlaylist = {
            id: generateId(),
            name,
            tracks: [...tracks],
            createdAt: now,
            updatedAt: now,
          };
          updated = [...prev, newPlaylist];
          // Auto-select the new playlist
          setActivePlaylistId(newPlaylist.id);
        }

        savePlaylistsToStorage(updated);
        return updated;
      });
    },
    [activePlaylistId]
  );

  const loadPlaylist = useCallback(
    (playlistId: string): Track[] => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) return [];
      setActivePlaylistId(playlistId);
      return [...playlist.tracks];
    },
    [playlists]
  );

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => {
      const updated = prev.filter((p) => p.id !== playlistId);
      savePlaylistsToStorage(updated);
      return updated;
    });
    setActivePlaylistId((prev) => (prev === playlistId ? null : prev));
  }, []);

  const renamePlaylist = useCallback((playlistId: string, newName: string) => {
    const now = Date.now();
    setPlaylists((prev) => {
      const updated = prev.map((p) =>
        p.id === playlistId ? { ...p, name: newName, updatedAt: now } : p
      );
      savePlaylistsToStorage(updated);
      return updated;
    });
  }, []);

  const getActivePlaylist = useCallback((): SavedPlaylist | null => {
    if (!activePlaylistId) return null;
    return playlists.find((p) => p.id === activePlaylistId) ?? null;
  }, [playlists, activePlaylistId]);

  return {
    playlists,
    activePlaylistId,
    saveCurrentPlaylist,
    loadPlaylist,
    deletePlaylist,
    renamePlaylist,
    getActivePlaylist,
    setActivePlaylistId,
  };
}
