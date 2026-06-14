/**
 * 🦙 Llama Player — useGoogleDrive Hook
 *
 * Hook React para gerenciar autenticação, navegação e listagem
 * de arquivos do Google Drive.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  driveService,
  type DriveState,
  type DriveItem,
  type DriveFolder,
  type DriveFile,
  type SyncedPlaylist,
  isAudioFile,
} from "../services/googleDrive";
import type { Track } from "../types";

// ID do Cliente OAuth — o usuário precisa configurar no .env
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const initialState: DriveState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  currentFolder: null,
  breadcrumbs: [],
  items: [],
  error: null,
};

export function useGoogleDrive() {
  const [state, setState] = useState<DriveState>(initialState);
  const serviceInitialized = useRef(false);

  /**
   * Tenta login silencioso ao montar (se houver token salvo).
   */
  useEffect(() => {
    if (!CLIENT_ID) {
      setState((prev) => ({
        ...prev,
        error:
          "VITE_GOOGLE_CLIENT_ID não configurado. Crie um arquivo .env com seu Client ID do Google Cloud.",
      }));
      return;
    }

    const init = async () => {
      try {
        await driveService.initialize(CLIENT_ID);
        serviceInitialized.current = true;

        const loggedIn = await driveService.trySilentLogin(CLIENT_ID);
        if (loggedIn) {
          const user = await driveService.getUserInfo();
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null,
          }));
          // Carrega a raiz do Drive
          await loadFolder(null);
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err: any) {
        console.error("[Llama Player] Erro na inicialização do Drive:", err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || "Erro ao inicializar Google Drive",
        }));
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Faz login com OAuth popup.
   */
  const login = useCallback(async () => {
    if (!serviceInitialized.current) {
      try {
        await driveService.initialize(CLIENT_ID);
        serviceInitialized.current = true;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err.message || "Erro ao inicializar",
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await driveService.login();
      if (success) {
        const user = await driveService.getUserInfo();
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          user,
          isLoading: false,
          error: null,
        }));
        await loadFolder(null);
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Login cancelado ou falhou",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Erro ao fazer login",
      }));
    }
  }, []);

  /**
   * Faz logout.
   */
  const logout = useCallback(async () => {
    try {
      await driveService.logout();
    } catch {
      // Ignora
    }
    setState({ ...initialState });
  }, []);

  /**
   * Navega para uma pasta do Drive.
   */
  const loadFolder = useCallback(async (
    folder: DriveFolder | null,
    nextBreadcrumbs?: DriveFolder[]
  ) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const items = await driveService.listFiles(folder?.id ?? null);

      setState((prev) => {
        const breadcrumbs =
          nextBreadcrumbs ??
          (folder ? [...prev.breadcrumbs, folder] : []);
        return {
          ...prev,
          currentFolder: folder,
          breadcrumbs,
          items,
          isLoading: false,
          error: null,
        };
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Erro ao carregar pasta",
      }));
    }
  }, []);

  /**
   * Navega para uma pasta (entra nela).
   */
  const navigateToFolder = useCallback(
    async (folder: DriveFolder) => {
      await loadFolder(folder);
    },
    [loadFolder]
  );

  /**
   * Navega para o breadcrumb (volta).
   */
  const navigateToBreadcrumb = useCallback(
    async (index: number) => {
      const target =
        index === -1
          ? null
          : state.breadcrumbs[index];

      const nextBreadcrumbs =
        index === -1 ? [] : state.breadcrumbs.slice(0, index + 1);
      await loadFolder(target, nextBreadcrumbs);
    },
    [state.breadcrumbs, loadFolder]
  );

  /**
   * Sobe um nível na hierarquia de pastas.
   */
  const goUp = useCallback(async () => {
    const len = state.breadcrumbs.length;
    if (len === 0) return;
    await navigateToBreadcrumb(len - 2);
  }, [state.breadcrumbs.length, navigateToBreadcrumb]);

  /**
   * Converte um DriveFile em Track para o player.
   */
  const driveFileToTrack = useCallback((file: DriveFile): Track => {
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    return {
      id: `drive-${file.id}`,
      title: nameWithoutExt,
      duration: file.duration || 0,
      driveFileId: file.id,
      mimeType: file.mimeType,
      size: file.size,
    };
  }, []);

  /**
   * Converte múltiplos DriveFiles em Tracks.
   */
  const driveFilesToTracks = useCallback(
    (files: DriveFile[]): Track[] => {
      return files.filter(isAudioFile).map(driveFileToTrack);
    },
    [driveFileToTrack]
  );

  /**
   * Obtém apenas os arquivos de áudio da listagem atual.
   */
  const getAudioFiles = useCallback((): DriveFile[] => {
    return state.items.filter(isAudioFile) as DriveFile[];
  }, [state.items]);

  /**
   * Busca arquivos de áudio no Drive.
   */
  const searchAudio = useCallback(async (query: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const files = await driveService.searchAudio(query);
      // Cria itens falsos para exibir na lista
      const items: DriveItem[] = files;
      setState((prev) => ({
        ...prev,
        items,
        isLoading: false,
        error: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Erro na busca",
      }));
    }
  }, []);

  /**
   * Recarrega a pasta atual (bypass do cache).
   */
  const refreshCurrentFolder = useCallback(async () => {
    await loadFolder(state.currentFolder);
  }, [state.currentFolder, loadFolder]);

  /**
   * Limpa o cache de listas do Drive.
   */
  const clearDriveCache = useCallback(() => {
    driveService.clearCache();
  }, []);

  /**
   * Sincroniza a playlist com uma pasta do Drive.
   * Retorna a playlist sincronizada com os IDs dos arquivos.
   */
  const syncWithFolder = useCallback(
    async (folder: DriveFolder): Promise<SyncedPlaylist> => {
      return await driveService.syncPlaylistWithFolder(folder.id, folder.name);
    },
    []
  );

  /**
   * Obtém playlists sincronizadas.
   */
  const getSyncedPlaylists = useCallback((): SyncedPlaylist[] => {
    return driveService.getSyncedPlaylists();
  }, []);

  /**
   * Remove uma playlist sincronizada.
   */
  const removeSyncedPlaylist = useCallback((folderId: string) => {
    driveService.removeSyncedPlaylist(folderId);
  }, []);

  /**
   * Carrega tracks de uma playlist sincronizada.
   * Busca os metadados de cada arquivo no Drive e retorna Tracks.
   */
  const loadSyncedPlaylistTracks = useCallback(
    async (synced: SyncedPlaylist): Promise<Track[]> => {
      const tracks: Track[] = [];
      for (const fileId of synced.trackIds) {
        try {
          const meta = await driveService.getFileMetadata(fileId);
          const track = driveFileToTrack(meta);
          tracks.push(track);
        } catch (err) {
          console.warn(
            `[Llama Player] Erro ao carregar arquivo ${fileId}:`,
            err
          );
        }
      }
      return tracks;
    },
    [driveFileToTrack]
  );

  return {
    state,
    login,
    logout,
    navigateToFolder,
    navigateToBreadcrumb,
    goUp,
    driveFileToTrack,
    driveFilesToTracks,
    getAudioFiles,
    searchAudio,
    refreshCurrentFolder,
    clearDriveCache,
    syncWithFolder,
    getSyncedPlaylists,
    removeSyncedPlaylist,
    loadSyncedPlaylistTracks,
    CLIENT_ID,
  };
}
