/**
 * 🦙 Llama Player — DriveBrowser Component
 *
 * Componente para navegar no Google Drive, listar pastas e arquivos
 * de áudio, e adicioná-los à playlist.
 */

import { useState, useCallback, useEffect } from "react";
import { useGoogleDrive } from "../hooks/useGoogleDrive";
import type { DriveFile, DriveFolder, SyncedPlaylist } from "../services/googleDrive";
import { isAudioFile } from "../services/googleDrive";
import type { Track } from "../types";

interface DriveBrowserProps {
  onAddTracks: (tracks: Track[]) => void;
  disabled?: boolean;
}

export function DriveBrowser({ onAddTracks, disabled = false }: DriveBrowserProps) {
  const {
    state,
    login,
    logout,
    navigateToFolder,
    navigateToBreadcrumb,
    goUp,
    driveFilesToTracks,
    searchAudio,
    refreshCurrentFolder,
    clearDriveCache,
    syncWithFolder,
    getSyncedPlaylists,
    removeSyncedPlaylist,
    loadSyncedPlaylistTracks,
    CLIENT_ID,
  } = useGoogleDrive();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [syncedPlaylists, setSyncedPlaylists] = useState<SyncedPlaylist[]>([]);
  const [showSynced, setShowSynced] = useState(false);
  const [syncingFolder, setSyncingFolder] = useState(false);

  // Carrega playlists sincronizadas ao montar
  useEffect(() => {
    setSyncedPlaylists(getSyncedPlaylists());
  }, [getSyncedPlaylists]);

  /**
   * Alterna seleção de um arquivo.
   */
  const toggleSelect = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  /**
   * Adiciona arquivos selecionados à playlist.
   */
  const handleAddSelected = useCallback(async () => {
    const audioFiles = state.items.filter(
      (item): item is DriveFile => isAudioFile(item) && selectedFiles.has(item.id)
    );

    if (audioFiles.length === 0) return;

    setIsAdding(true);
    try {
      const tracks = driveFilesToTracks(audioFiles);
      onAddTracks(tracks);
      setSelectedFiles(new Set());
    } catch (err) {
      console.error("[Llama Player] Erro ao adicionar tracks do Drive:", err);
    } finally {
      setIsAdding(false);
    }
  }, [state.items, selectedFiles, driveFilesToTracks, onAddTracks]);

  /**
   * Adiciona TODOS os arquivos de áudio da pasta atual.
   */
  const handleAddAll = useCallback(() => {
    const audioFiles = state.items.filter(isAudioFile) as DriveFile[];
    if (audioFiles.length === 0) return;

    const tracks = driveFilesToTracks(audioFiles);
    onAddTracks(tracks);
  }, [state.items, driveFilesToTracks, onAddTracks]);

  /**
   * Recarrega a pasta atual (ignorando cache).
   */
  const handleRefresh = useCallback(() => {
    clearDriveCache();
    refreshCurrentFolder();
  }, [clearDriveCache, refreshCurrentFolder]);

  /**
   * Sincroniza a pasta atual como playlist.
   */
  const handleSyncFolder = useCallback(async () => {
    if (!state.currentFolder) return;
    setSyncingFolder(true);
    try {
      const synced = await syncWithFolder(state.currentFolder);
      setSyncedPlaylists(getSyncedPlaylists());
      // Adiciona as tracks da pasta à playlist
      const tracks = await loadSyncedPlaylistTracks(synced);
      if (tracks.length > 0) {
        onAddTracks(tracks);
      }
    } catch (err) {
      console.error("[Llama Player] Erro ao sincronizar pasta:", err);
    } finally {
      setSyncingFolder(false);
    }
  }, [state.currentFolder, syncWithFolder, getSyncedPlaylists, loadSyncedPlaylistTracks, onAddTracks]);

  /**
   * Carrega tracks de uma playlist sincronizada.
   */
  const handleLoadSynced = useCallback(
    async (synced: SyncedPlaylist) => {
      const tracks = await loadSyncedPlaylistTracks(synced);
      if (tracks.length > 0) {
        onAddTracks(tracks);
      }
    },
    [loadSyncedPlaylistTracks, onAddTracks]
  );

  /**
   * Remove uma playlist sincronizada.
   */
  const handleRemoveSynced = useCallback(
    (folderId: string) => {
      removeSyncedPlaylist(folderId);
      setSyncedPlaylists(getSyncedPlaylists());
    },
    [removeSyncedPlaylist, getSyncedPlaylists]
  );

  /**
   * Dispara busca.
   */
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        searchAudio(searchQuery.trim());
      }
    },
    [searchQuery, searchAudio]
  );

  /**
   * Formata tamanho do arquivo.
   */
  const formatSize = (bytes?: number): string => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  /**
   * Formata data.
   */
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // --- Renderização condicional ---

  // Se não tem Client ID configurado
  if (!CLIENT_ID) {
    return (
      <div className="drive-panel">
        <div className="panel-header">☁️ GOOGLE DRIVE</div>
        <div className="drive-config-warning">
          <p>⚠️ Google Drive não configurado</p>
          <p className="drive-config-hint">
            Crie um arquivo <code>.env</code> na raiz do projeto com:
          </p>
          <pre className="drive-config-code">
            VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
          </pre>
          <p className="drive-config-hint">
            Obtenha um Client ID no{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Cloud Console
            </a>
            , ative a Google Drive API e crie um OAuth Client ID do tipo
            Desktop app para o aplicativo Tauri. Para usar só no navegador
            com Vite, use um client de Aplicativo Web com
            http://localhost:1420 como origem autorizada.
          </p>
        </div>
      </div>
    );
  }

  // Estado de carregamento inicial
  if (state.isLoading && !state.isAuthenticated) {
    return (
      <div className="drive-panel">
        <div className="panel-header">☁️ GOOGLE DRIVE</div>
        <div className="drive-loading">
          <span className="drive-spinner" />
          <span>Conectando ao Google Drive...</span>
        </div>
      </div>
    );
  }

  // Não autenticado — tela de login
  if (!state.isAuthenticated) {
    return (
      <div className="drive-panel">
        <div className="panel-header">☁️ GOOGLE DRIVE</div>
        <div className="drive-login">
          <p className="drive-login-text">
            Conecte-se ao Google Drive para acessar suas músicas.
          </p>
          <button
            className="drive-login-btn"
            onClick={login}
            disabled={disabled}
          >
            ☁️ Entrar com Google
          </button>
          {state.error && (
            <p className="drive-error">{state.error}</p>
          )}
        </div>
      </div>
    );
  }

  // Autenticado — navegador do Drive
  const audioCount = state.items.filter(isAudioFile).length;
  const selectedCount = selectedFiles.size;

  return (
    <div className="drive-panel">
      <div className="panel-header">
        <span>☁️ GOOGLE DRIVE</span>
        <div className="drive-user-info">
          {state.user?.picture && (
            <img
              src={state.user.picture}
              alt=""
              className="drive-user-avatar"
            />
          )}
          <span className="drive-user-name">{state.user?.name}</span>
          <button
            className="drive-logout-btn"
            onClick={logout}
            title="Sair do Google Drive"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="drive-breadcrumbs">
        <button
          className="drive-breadcrumb-btn"
          onClick={() => navigateToBreadcrumb(-1)}
          title="Raiz do Drive"
        >
          🏠
        </button>
        {state.breadcrumbs.map((folder, index) => {
          const isCurrent = index === state.breadcrumbs.length - 1;
          return (
          <span key={folder.id} className="drive-breadcrumb-segment">
            <span className="drive-breadcrumb-sep">/</span>
            {isCurrent ? (
              <span className="drive-breadcrumb-current">
                {folder.name}
              </span>
            ) : (
              <button
                className="drive-breadcrumb-btn"
                onClick={() => navigateToBreadcrumb(index)}
              >
                {folder.name}
              </button>
            )}
          </span>
          );
        })}
      </div>

      {/* Barra de busca */}
      <form className="drive-search" onSubmit={handleSearch}>
        <input
          type="text"
          className="drive-search-input"
          placeholder="Buscar músicas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="drive-search-btn" title="Buscar">
          🔍
        </button>
      </form>

      {/* Ações em massa */}
      <div className="drive-actions">
        <span className="drive-item-count">
          {audioCount} áudio{audioCount !== 1 ? "s" : ""}
          {state.items.length > audioCount &&
            ` · ${state.items.length - audioCount} pasta${state.items.length - audioCount !== 1 ? "s" : ""}`}
        </span>
        <div className="drive-action-btns">
          <button
            className="drive-action-btn"
            onClick={handleRefresh}
            disabled={state.isLoading}
            title="Recarregar (ignorar cache)"
          >
            🔄
          </button>
          {state.breadcrumbs.length > 0 && (
            <button
              className="drive-action-btn"
              onClick={goUp}
              title="Subir um nível"
            >
              ⬆ Subir
            </button>
          )}
          {state.currentFolder && (
            <button
              className="drive-action-btn"
              onClick={handleSyncFolder}
              disabled={disabled || syncingFolder}
              title="Sincronizar playlist com esta pasta"
            >
              {syncingFolder ? "⏳" : "🔗 Sinc."}
            </button>
          )}
          {audioCount > 0 && (
            <button
              className="drive-action-btn"
              onClick={handleAddAll}
              disabled={disabled}
              title="Adicionar todos os áudios à playlist"
            >
              📥 Todos
            </button>
          )}
          {selectedCount > 0 && (
            <button
              className="drive-action-btn drive-action-btn-primary"
              onClick={handleAddSelected}
              disabled={disabled || isAdding}
              title={`Adicionar ${selectedCount} arquivo${selectedCount !== 1 ? "s" : ""} selecionado${selectedCount !== 1 ? "s" : ""}`}
            >
              {isAdding ? "⏳" : `📥 +${selectedCount}`}
            </button>
          )}
        </div>
      </div>

      {/* Playlists sincronizadas */}
      {syncedPlaylists.length > 0 && (
        <div className="drive-synced-section">
          <button
            className="drive-synced-toggle"
            onClick={() => setShowSynced((v) => !v)}
          >
            {showSynced ? "▼" : "▶"} Playlists sincronizadas ({syncedPlaylists.length})
          </button>
          {showSynced && (
            <ul className="drive-synced-list">
              {syncedPlaylists.map((synced) => (
                <li key={synced.folderId} className="drive-synced-item">
                  <span className="drive-synced-icon">📁</span>
                  <span className="drive-synced-name">{synced.folderName}</span>
                  <span className="drive-synced-meta">
                    {synced.trackIds.length} músicas
                  </span>
                  <button
                    className="drive-synced-load-btn"
                    onClick={() => handleLoadSynced(synced)}
                    title="Carregar playlist"
                  >
                    📥
                  </button>
                  <button
                    className="drive-synced-remove-btn"
                    onClick={() => handleRemoveSynced(synced.folderId)}
                    title="Remover playlist sincronizada"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Lista de arquivos */}
      <div className="drive-file-list">
        {state.isLoading ? (
          <div className="drive-loading">
            <span className="drive-spinner" />
            <span>Carregando...</span>
          </div>
        ) : state.items.length === 0 ? (
          <div className="drive-empty">
            {searchQuery
              ? "Nenhum resultado encontrado"
              : "Esta pasta está vazia"}
          </div>
        ) : (
          <ul className="drive-items">
            {state.items.map((item) => {
              const itemAny = item as any;
              const isFolderItem = itemAny.mimeType === "application/vnd.google-apps.folder";
              const isAudio = isAudioFile(item);
              const isSelected = selectedFiles.has(itemAny.id);

              if (isFolderItem) {
                return (
                  <li
                    key={itemAny.id}
                    className="drive-item drive-item-folder"
                    onClick={() => navigateToFolder(item as unknown as DriveFolder)}
                    title={`Abrir pasta ${itemAny.name}`}
                  >
                    <span className="drive-item-icon">📁</span>
                    <span className="drive-item-name">{itemAny.name}</span>
                  </li>
                );
              }

              if (!isAudio) {
                return (
                  <li key={itemAny.id} className="drive-item drive-item-other">
                    <span className="drive-item-icon">📄</span>
                    <span className="drive-item-name">{itemAny.name}</span>
                  </li>
                );
              }

              // Arquivo de áudio
              return (
                <li
                  key={itemAny.id}
                  className={`drive-item drive-item-audio ${
                    isSelected ? "drive-item-selected" : ""
                  }`}
                  onClick={() => toggleSelect(itemAny.id)}
                >
                  <span className="drive-item-checkbox">
                    {isSelected ? "☑" : "☐"}
                  </span>
                  <span className="drive-item-icon">🎵</span>
                  <span className="drive-item-name">{itemAny.name}</span>
                  <span className="drive-item-size">
                    {formatSize(itemAny.size)}
                  </span>
                  <span className="drive-item-date">
                    {formatDate(itemAny.modifiedTime)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {state.error && (
        <div className="drive-error-bar">
          <span>⚠️ {state.error}</span>
        </div>
      )}
    </div>
  );
}
