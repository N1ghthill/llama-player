import { useReducer, useMemo } from "react";
import type { PlayerState, PlayerAction, Track, RepeatMode } from "../types";

const initialState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  volume: 100,
  currentTime: 0,
  duration: 0,
  playlist: [],
  originalPlaylist: [],
  repeatMode: "none",
  isShuffled: false,
  crossfadeDuration: 0,
  gaplessEnabled: false,
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "PLAY": {
      const track = action.track ?? state.currentTrack;
      if (!track && state.playlist.length === 0) return state;
      const targetTrack = track ?? state.playlist[0];
      return {
        ...state,
        currentTrack: targetTrack,
        isPlaying: true,
        currentTime: 0,
        duration: targetTrack.duration,
      };
    }

    case "PAUSE":
      return { ...state, isPlaying: false };

    case "STOP":
      return { ...state, isPlaying: false, currentTime: 0 };

    case "NEXT": {
      if (state.playlist.length === 0) return state;
      const currentIndex = state.playlist.findIndex(
        (t) => t.id === state.currentTrack?.id
      );
      const nextIndex = (currentIndex + 1) % state.playlist.length;
      const nextTrack = state.playlist[nextIndex];
      return {
        ...state,
        currentTrack: nextTrack,
        isPlaying: true,
        currentTime: 0,
        duration: nextTrack.duration,
      };
    }

    case "PREV": {
      if (state.playlist.length === 0) return state;
      const currentIndex = state.playlist.findIndex(
        (t) => t.id === state.currentTrack?.id
      );
      const prevIndex =
        currentIndex <= 0
          ? state.playlist.length - 1
          : currentIndex - 1;
      const prevTrack = state.playlist[prevIndex];
      return {
        ...state,
        currentTrack: prevTrack,
        isPlaying: true,
        currentTime: 0,
        duration: prevTrack.duration,
      };
    }

    case "SEEK":
      return { ...state, currentTime: Math.max(0, Math.min(action.time, state.duration)) };

    case "SET_VOLUME":
      return { ...state, volume: Math.max(0, Math.min(100, action.volume)) };

    case "LOAD_PLAYLIST":
      return {
        ...state,
        playlist: action.tracks,
        originalPlaylist: [...action.tracks],
        currentTrack: action.tracks[0] ?? null,
        currentTime: 0,
        duration: action.tracks[0]?.duration ?? 0,
        isPlaying: false,
      };

    case "ADD_TRACK":
      return {
        ...state,
        playlist: [...state.playlist, action.track],
        originalPlaylist: state.isShuffled
          ? [...state.originalPlaylist, action.track]
          : [...state.playlist, action.track],
      };

    case "REMOVE_TRACK":
      return {
        ...state,
        playlist: state.playlist.filter((t) => t.id !== action.trackId),
        originalPlaylist: state.originalPlaylist.filter((t) => t.id !== action.trackId),
        currentTrack:
          state.currentTrack?.id === action.trackId
            ? null
            : state.currentTrack,
      };

    case "REORDER_PLAYLIST":
      return {
        ...state,
        playlist: action.tracks,
        originalPlaylist: state.isShuffled ? [...state.originalPlaylist] : [...action.tracks],
      };

    case "SET_REPEAT_MODE":
      return { ...state, repeatMode: action.mode };

    case "SET_CROSSFADE":
      return { ...state, crossfadeDuration: Math.max(0, Math.min(30, action.duration)) };

    case "TOGGLE_GAPLESS":
      return { ...state, gaplessEnabled: !state.gaplessEnabled };

    case "TOGGLE_SHUFFLE": {
      if (state.isShuffled) {
        // Restore original order
        return { ...state, isShuffled: false, playlist: [...state.originalPlaylist] };
      }
      // Save original order and shuffle
      return { ...state, isShuffled: true, playlist: shuffleArray(state.playlist) };
    }

    case "SET_DURATION":
      return { ...state, duration: action.duration };

    case "SET_CURRENT_TIME":
      return { ...state, currentTime: action.time };

    case "TOGGLE_FAVORITE":
      return {
        ...state,
        playlist: state.playlist.map((t) =>
          t.id === action.trackId
            ? { ...t, isFavorite: !t.isFavorite }
            : t
        ),
        currentTrack:
          state.currentTrack?.id === action.trackId
            ? { ...state.currentTrack, isFavorite: !state.currentTrack.isFavorite }
            : state.currentTrack,
      };

    case "LOAD_FAVORITES": {
      const favoriteSet = new Set(action.favoriteIds);
      return {
        ...state,
        playlist: state.playlist.map((t) =>
          favoriteSet.has(t.id) ? { ...t, isFavorite: true } : t
        ),
        currentTrack:
          state.currentTrack && favoriteSet.has(state.currentTrack.id)
            ? { ...state.currentTrack, isFavorite: true }
            : state.currentTrack,
      };
    }

    default:
      return state;
  }
}

export function usePlayer(initialPlaylist: Track[] = []) {
  const [state, dispatch] = useReducer(playerReducer, {
    ...initialState,
    playlist: initialPlaylist,
    originalPlaylist: [...initialPlaylist],
    currentTrack: initialPlaylist[0] ?? null,
    duration: initialPlaylist[0]?.duration ?? 0,
  });

  const actions = useMemo(
    () => ({
      play: (track?: Track) => dispatch({ type: "PLAY", track }),
      pause: () => dispatch({ type: "PAUSE" }),
      stop: () => dispatch({ type: "STOP" }),
      next: () => dispatch({ type: "NEXT" }),
      prev: () => dispatch({ type: "PREV" }),
      seek: (time: number) => dispatch({ type: "SEEK", time }),
      setVolume: (volume: number) => dispatch({ type: "SET_VOLUME", volume }),
      loadPlaylist: (tracks: Track[]) => dispatch({ type: "LOAD_PLAYLIST", tracks }),
      addTrack: (track: Track) => dispatch({ type: "ADD_TRACK", track }),
      removeTrack: (trackId: string) => dispatch({ type: "REMOVE_TRACK", trackId }),
      reorderPlaylist: (tracks: Track[]) => dispatch({ type: "REORDER_PLAYLIST", tracks }),
      setRepeatMode: (mode: RepeatMode) => dispatch({ type: "SET_REPEAT_MODE", mode }),
      toggleShuffle: () => dispatch({ type: "TOGGLE_SHUFFLE" }),
      setDuration: (duration: number) => dispatch({ type: "SET_DURATION", duration }),
      setCurrentTime: (time: number) => dispatch({ type: "SET_CURRENT_TIME", time }),
      toggleFavorite: (trackId: string) => dispatch({ type: "TOGGLE_FAVORITE", trackId }),
      loadFavorites: (favoriteIds: string[]) => dispatch({ type: "LOAD_FAVORITES", favoriteIds }),
      setCrossfade: (duration: number) => dispatch({ type: "SET_CROSSFADE", duration }),
      toggleGapless: () => dispatch({ type: "TOGGLE_GAPLESS" }),
    }),
    []
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}
