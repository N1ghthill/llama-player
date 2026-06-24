export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number; // seconds
  coverUrl?: string;
  src?: string; // file path or URL
  mimeType?: string;
  size?: number;
  isFavorite?: boolean;
}

export type RepeatMode = "none" | "one" | "all";

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number; // 0–100
  currentTime: number; // seconds
  duration: number; // seconds
  playlist: Track[];
  originalPlaylist: Track[];
  repeatMode: RepeatMode;
  isShuffled: boolean;
}

export type PlayerAction =
  | { type: "PLAY"; track?: Track }
  | { type: "PAUSE" }
  | { type: "STOP" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SEEK"; time: number }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "LOAD_PLAYLIST"; tracks: Track[] }
  | { type: "ADD_TRACK"; track: Track }
  | { type: "REMOVE_TRACK"; trackId: string }
  | { type: "REORDER_PLAYLIST"; tracks: Track[] }
  | { type: "SET_REPEAT_MODE"; mode: RepeatMode }
  | { type: "TOGGLE_SHUFFLE" }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_CURRENT_TIME"; time: number }
  | { type: "TOGGLE_FAVORITE"; trackId: string }
  | { type: "LOAD_FAVORITES"; favoriteIds: string[] };
