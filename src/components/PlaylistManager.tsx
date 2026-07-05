import { useState, useCallback, memo } from "react";
import type { Track } from "../types";
import type { SavedPlaylist } from "../hooks/usePlaylists";

interface PlaylistManagerProps {
  playlists: SavedPlaylist[];
  activePlaylistId: string | null;
  currentTracks: Track[];
  onSavePlaylist: (name: string, tracks: Track[]) => void;
  onLoadPlaylist: (playlistId: string) => Track[];
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, newName: string) => void;
  onReplaceTracks: (tracks: Track[]) => void;
  onClose: () => void;
}

export const PlaylistManager = memo(function PlaylistManager({
  playlists,
  activePlaylistId,
  currentTracks,
  onSavePlaylist,
  onLoadPlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onReplaceTracks,
  onClose,
}: PlaylistManagerProps) {
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const name = saveName.trim();
    if (!name) return;
    onSavePlaylist(name, currentTracks);
    setSaveName("");
    setShowSaveInput(false);
  }, [saveName, currentTracks, onSavePlaylist]);

  const handleLoad = useCallback(
    (playlistId: string) => {
      const tracks = onLoadPlaylist(playlistId);
      if (tracks.length > 0) {
        onReplaceTracks(tracks);
      }
    },
    [onLoadPlaylist, onReplaceTracks]
  );

  const handleStartRename = useCallback((playlist: SavedPlaylist) => {
    setRenamingId(playlist.id);
    setRenameValue(playlist.name);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenamePlaylist(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  }, [renamingId, renameValue, onRenamePlaylist]);

  const handleDelete = useCallback(
    (playlistId: string) => {
      if (confirmDeleteId === playlistId) {
        onDeletePlaylist(playlistId);
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(playlistId);
      }
    },
    [confirmDeleteId, onDeletePlaylist]
  );

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="playlist-manager">
      <div className="panel-header">
        GERENCIAR PLAYLISTS
        <button
          className="playlist-manager-close"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar gerenciador de playlists"
        >
          ✕
        </button>
      </div>

      <div className="playlist-manager-actions">
        {!showSaveInput ? (
          <button
            className="playlist-manager-btn"
            onClick={() => {
              setShowSaveInput(true);
              setSaveName("");
            }}
            disabled={currentTracks.length === 0}
            title={
              currentTracks.length === 0
                ? "Adicione músicas à playlist primeiro"
                : "Salvar playlist atual"
            }
          >
            💾 Salvar playlist atual
          </button>
        ) : (
          <div className="playlist-manager-save-form">
            <input
              type="text"
              className="playlist-manager-input"
              placeholder="Nome da playlist..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowSaveInput(false);
              }}
              autoFocus
              aria-label="Nome da nova playlist"
            />
            <button
              className="playlist-manager-btn playlist-manager-btn-sm"
              onClick={handleSave}
              disabled={!saveName.trim()}
            >
              Salvar
            </button>
            <button
              className="playlist-manager-btn playlist-manager-btn-sm playlist-manager-btn-cancel"
              onClick={() => setShowSaveInput(false)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {playlists.length === 0 ? (
        <div className="playlist-manager-empty">
          Nenhuma playlist salva ainda.
          <br />
          Adicione músicas e clique em "Salvar playlist atual".
        </div>
      ) : (
        <ul className="playlist-manager-list">
          {playlists.map((playlist) => (
            <li
              key={playlist.id}
              className={`playlist-manager-item ${
                playlist.id === activePlaylistId ? "active" : ""
              }`}
            >
              {renamingId === playlist.id ? (
                <div className="playlist-manager-rename-form">
                  <input
                    type="text"
                    className="playlist-manager-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    autoFocus
                    aria-label="Renomear playlist"
                  />
                  <button
                    className="playlist-manager-btn playlist-manager-btn-sm"
                    onClick={handleConfirmRename}
                    disabled={!renameValue.trim()}
                  >
                    OK
                  </button>
                  <button
                    className="playlist-manager-btn playlist-manager-btn-sm playlist-manager-btn-cancel"
                    onClick={() => setRenamingId(null)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className="playlist-manager-item-info">
                    <span
                      className="playlist-manager-item-name"
                      onClick={() => handleLoad(playlist.id)}
                      title={`Carregar "${playlist.name}" (${playlist.tracks.length} músicas)`}
                    >
                      {playlist.name}
                    </span>
                    <span className="playlist-manager-item-meta">
                      {playlist.tracks.length} música
                      {playlist.tracks.length !== 1 ? "s" : ""}
                      {" · "}
                      {formatDate(playlist.updatedAt)}
                    </span>
                  </div>
                  <div className="playlist-manager-item-actions">
                    <button
                      className="playlist-manager-icon-btn"
                      onClick={() => handleLoad(playlist.id)}
                      title="Carregar playlist"
                      aria-label={`Carregar ${playlist.name}`}
                    >
                      ▶
                    </button>
                    <button
                      className="playlist-manager-icon-btn"
                      onClick={() => handleStartRename(playlist)}
                      title="Renomear"
                      aria-label={`Renomear ${playlist.name}`}
                    >
                      ✏
                    </button>
                    <button
                      className={`playlist-manager-icon-btn ${
                        confirmDeleteId === playlist.id ? "delete-confirm" : ""
                      }`}
                      onClick={() => handleDelete(playlist.id)}
                      title={
                        confirmDeleteId === playlist.id
                          ? "Clique novamente para confirmar"
                          : "Excluir playlist"
                      }
                      aria-label={`Excluir ${playlist.name}`}
                    >
                      {confirmDeleteId === playlist.id ? "⚠" : "🗑"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
