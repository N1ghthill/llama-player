import { memo } from "react";
import type { Track } from "../types";
import type { ThemeMode } from "../hooks/useTheme";
import type { SavedPlaylist } from "../hooks/usePlaylists";
import type { LRCLine, LRCData } from "../services/lrcParser";
import { HistoryPanel } from "./HistoryPanel";
import { PlaylistManager } from "./PlaylistManager";
import { LyricsDisplay } from "./LyricsDisplay";
import { DataManagement } from "./DataManagement";

interface HistoryEntry {
  track: Track;
  playedAt: number;
}

interface LibraryShellProps {
  theme: ThemeMode;
  isLoading: boolean;
  loadingProgress: { processed: number; total: number } | null;
  currentTrack: Track | null;
  showHistory: boolean;
  showPlaylistManager: boolean;
  showLyrics: boolean;
  showDataManagement: boolean;
  historyEntries: HistoryEntry[];
  savedPlaylists: SavedPlaylist[];
  activePlaylistId: string | null;
  lyricsData: LRCData | null;
  currentLine: LRCLine | null;
  nextLine: LRCLine | null;
  lyricsProgress: number;
  lyricsLoading: boolean;
  lyricsError: string | null;
  playlistTracks: Track[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onCycleTheme: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleShowHistory: () => void;
  onToggleShowPlaylistManager: () => void;
  onToggleShowLyrics: () => void;
  onToggleShowDataManagement: () => void;
  onSelectTrack: (track: Track) => void;
  onClearHistory: () => void;
  onSavePlaylist: (name: string, tracks: Track[]) => void;
  onLoadPlaylist: (id: string) => Track[];
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onReplaceTracks: (tracks: Track[]) => void;
  onClosePlaylistManager: () => void;
  onCloseDataManagement: () => void;
}

export const LibraryShell = memo(function LibraryShell(p: LibraryShellProps) {
  return (
    <aside className="library-shell">
      <div className="library-title">
        <span>LLAMA LIBRARY</span>
        <button className="toolbar-btn theme-btn" onClick={p.onCycleTheme}
          title={`Tema: ${p.theme === "winamp" ? "Winamp Nostálgico" : p.theme === "dark" ? "Escuro" : "Claro"}`}>
          {p.theme === "winamp" ? "🎨" : p.theme === "dark" ? "🌙" : "☀️"}
        </button>
      </div>
      <div className="library-tabs" role="tablist">
        <button className="library-tab active" type="button">Mídia</button>
        <button className="library-tab" type="button">Visual</button>
        <button className="library-tab" type="button">Local</button>
      </div>
      <div className="toolbar library-toolbar">
        <button className="toolbar-btn" onClick={p.onOpenFile} disabled={p.isLoading} title="Abrir arquivo de áudio local">
          {p.isLoading && p.loadingProgress ? `⏳ ${p.loadingProgress.processed}/${p.loadingProgress.total}` : p.isLoading ? "⏳ Lendo..." : "📂 Arquivo"}
        </button>
        <button className="toolbar-btn" onClick={p.onOpenFolder} disabled={p.isLoading} title="Abrir pasta de músicas">📁 Pasta</button>
        <input ref={p.fileInputRef as React.RefObject<HTMLInputElement>} type="file" accept="audio/*" multiple style={{ display: "none" }} onChange={p.onFileChange} />
      </div>
      <div className="library-nav">
        <button className={`library-nav-item ${p.showHistory ? "active" : ""}`} onClick={p.onToggleShowHistory}>🕐 Histórico</button>
        <button className={`library-nav-item ${p.showPlaylistManager ? "active" : ""}`} onClick={p.onToggleShowPlaylistManager}>📋 Playlists</button>
        <button className={`library-nav-item ${p.showLyrics ? "active" : ""}`} onClick={p.onToggleShowLyrics}>💬 Letras</button>
        <button className={`library-nav-item ${p.showDataManagement ? "active" : ""}`} onClick={p.onToggleShowDataManagement}>⚙ Dados</button>
      </div>
      <div className="library-now-card">
        <span className="library-empty-title">Agora tocando</span>
        <strong>{p.currentTrack?.title ?? "Nenhuma música"}</strong>
        <span>{p.currentTrack?.artist ?? "Abra uma faixa local para começar."}</span>
      </div>
      <div className="side-panels">
        {p.showHistory && <HistoryPanel entries={p.historyEntries} onSelectTrack={p.onSelectTrack} onClear={p.onClearHistory} />}
        {p.showPlaylistManager && (
          <PlaylistManager playlists={p.savedPlaylists} activePlaylistId={p.activePlaylistId}
            currentTracks={p.playlistTracks} onSavePlaylist={p.onSavePlaylist} onLoadPlaylist={p.onLoadPlaylist}
            onDeletePlaylist={p.onDeletePlaylist} onRenamePlaylist={p.onRenamePlaylist}
            onReplaceTracks={p.onReplaceTracks} onClose={p.onClosePlaylistManager} />
        )}
        {p.showLyrics && <LyricsDisplay lines={p.lyricsData?.lines ?? []} currentLine={p.currentLine}
          nextLine={p.nextLine} progress={p.lyricsProgress} isLoading={p.lyricsLoading} error={p.lyricsError} />}
        {p.showDataManagement && <DataManagement version={__APP_VERSION__} onClose={p.onCloseDataManagement} />}
        {!p.showHistory && !p.showPlaylistManager && !p.showLyrics && !p.showDataManagement && (
          <div className="library-empty-panel">
            <span className="library-empty-title">Biblioteca local</span>
            <span>Arraste músicas para a playlist ou abra arquivos do computador.</span>
          </div>
        )}
      </div>
    </aside>
  );
});
