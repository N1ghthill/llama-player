import { useCallback, useRef, useState, useEffect } from "react";
import { usePlayerWithAudio } from "./hooks/usePlayerWithAudio";
import { useMetadata } from "./hooks/useMetadata";
import { useTauri } from "./hooks/useTauri";
import { useAudioVisualizer } from "./hooks/useAudioVisualizer";
import { useFavorites } from "./hooks/useFavorites";
import { useHistory } from "./hooks/useHistory";
import { usePlaylists } from "./hooks/usePlaylists";
import { useTheme } from "./hooks/useTheme";
import {
  TitleBar,
  Playlist,
  PlayerControls,
  ProgressBar,
  StatusBar,
  DriveBrowser,
  AudioVisualizer,
  HistoryPanel,
  PlaylistManager,
} from "./components";
import type { Track } from "./types";

function inferAudioMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "aac":
      return "audio/aac";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/ogg";
    default:
      return "audio/mpeg";
  }
}

function App() {
  const {
    state,
    play,
    pause,
    next,
    prev,
    seek,
    setVolume,
    addTrack,
    toggleShuffle,
    reorderPlaylist,
    setRepeatMode,
    toggleFavorite: togglePlayerFavorite,
    loadFavorites: loadPlayerFavorites,
    audioRef,
  } = usePlayerWithAudio([]);

  const { processFiles } = useMetadata();
  const {
    state: tauriState,
    openFilePicker,
    filePathToUrl,
    sendNotification,
    registerShortcuts,
  } = useTauri();

  const { loadFavorites, toggleFavorite: toggleStoredFavorite } = useFavorites();
  const history = useHistory();
  const playlists = usePlaylists();
  const { theme, cycleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ processed: number; total: number } | null>(null);
  const [showDrive, setShowDrive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega favoritos salvos ao iniciar
  useEffect(() => {
    const savedFavorites = loadFavorites();
    if (savedFavorites.length > 0) {
      loadPlayerFavorites(savedFavorites);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registra atalhos de teclado (Media Session API + Tauri global shortcuts)
  useEffect(() => {
    const cleanup = registerShortcuts({
      MediaPlayPause: () => (state.isPlaying ? pause() : play()),
      MediaNextTrack: () => next(),
      MediaPrevTrack: () => prev(),
      MediaStop: () => pause(),
    });

    return () => {
      cleanup.then((fn) => fn());
    };
  }, [registerShortcuts, state.isPlaying, pause, play, next, prev]);

  // Media Session API (navegador)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentTrack?.title ?? "Llama Player",
      artist: state.currentTrack?.artist ?? undefined,
      album: state.currentTrack?.album ?? undefined,
    });

    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  }, [state.currentTrack, play, pause, next, prev]);

  // Notificação ao trocar de música + histórico
  useEffect(() => {
    if (state.currentTrack && state.isPlaying) {
      sendNotification(
        `▶ ${state.currentTrack.title}`,
        state.currentTrack.artist
          ? `Por ${state.currentTrack.artist}`
          : undefined
      );
      history.addEntry(state.currentTrack);
    }
  }, [state.currentTrack?.id, state.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Verifica updates no desktop. O updater exige endpoint e assinatura configurados.
  useEffect(() => {
    if (!tauriState.isTauri) return;

    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        const [{ check }, { relaunch }] = await Promise.all([
          import("@tauri-apps/plugin-updater"),
          import("@tauri-apps/plugin-process"),
        ]);

        const update = await check({ timeout: 30_000 });
        if (!update || cancelled) return;

        const shouldInstall = window.confirm(
          `Atualização ${update.version} disponível. Instalar agora?`
        );
        if (!shouldInstall || cancelled) return;

        await update.downloadAndInstall();
        if (!cancelled) {
          await relaunch();
        }
      } catch (err) {
        console.warn("[Llama Player] Erro ao verificar atualizações:", err);
      }
    };

    checkForUpdates();

    return () => {
      cancelled = true;
    };
  }, [tauriState.isTauri]);

  const visualizer = useAudioVisualizer(audioRef, state.isPlaying);

  const handleSelectTrack = (track: Track) => {
    play(track);
  };

  const markFavoriteTracks = useCallback(
    (tracks: Track[]) => {
      const favoriteIds = new Set(loadFavorites());
      if (favoriteIds.size === 0) return tracks;
      return tracks.map((track) =>
        favoriteIds.has(track.id) ? { ...track, isFavorite: true } : track
      );
    },
    [loadFavorites]
  );

  const handleOpenFile = async () => {
    if (tauriState.isTauri) {
      // Usa file picker nativo do Tauri
      setIsLoading(true);
      try {
        const paths = await openFilePicker();
        if (!paths || paths.length === 0) return;

        const files: File[] = [];
        const fallbackTracks: Track[] = [];

        for (const path of paths) {
          const url = await filePathToUrl(path);
          const name = path.split(/[/\\]/).pop() || path;

          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Falha ao ler arquivo: ${response.status}`);
            const blob = await response.blob();
            files.push(new File([blob], name, { type: blob.type || inferAudioMimeType(name) }));
          } catch {
            fallbackTracks.push({
              id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: name.replace(/\.[^/.]+$/, ""),
              duration: 0,
              src: url,
            });
          }
        }

        const processedTracks = files.length > 0
          ? await processFiles(files, (progress) => {
              setLoadingProgress(progress);
            })
          : [];
        const tracks = markFavoriteTracks(processedTracks);
        tracks.push(...fallbackTracks);

        for (const track of tracks) {
          addTrack(track);
        }

        if (!state.currentTrack && tracks.length > 0) {
          play(tracks[0]);
        }
      } catch (err) {
        console.error("[Llama Player] Erro ao abrir arquivos:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Fallback: input file HTML
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsLoading(true);
      setLoadingProgress(null);

      try {
        const fileArray = Array.from(files);
        const processedTracks = await processFiles(fileArray, (progress) => {
          setLoadingProgress(progress);
        });
        const tracks = markFavoriteTracks(processedTracks);

        for (const track of tracks) {
          addTrack(track);
        }

        // If nothing is playing, start with the first track
        if (!state.currentTrack && tracks.length > 0) {
          play(tracks[0]);
        }
      } catch (err) {
        console.error("[Llama Player] Erro ao processar arquivos:", err);
      } finally {
        setIsLoading(false);
        setLoadingProgress(null);
      }

      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [processFiles, markFavoriteTracks, addTrack, state.currentTrack, play]
  );

  const handleDropFiles = useCallback(
    async (files: FileList) => {
      setIsLoading(true);
      setLoadingProgress(null);
      try {
        const fileArray = Array.from(files);
        const processedTracks = await processFiles(fileArray, (progress) => {
          setLoadingProgress(progress);
        });
        const tracks = markFavoriteTracks(processedTracks);
        for (const track of tracks) {
          addTrack(track);
        }
        if (!state.currentTrack && tracks.length > 0) {
          play(tracks[0]);
        }
      } catch (err) {
        console.error("[Llama Player] Erro ao processar arquivos arrastados:", err);
      } finally {
        setIsLoading(false);
        setLoadingProgress(null);
      }
    },
    [processFiles, markFavoriteTracks, addTrack, state.currentTrack, play]
  );

  const handleAddDriveTracks = useCallback(
    (tracks: Track[]) => {
      const tracksWithFavorites = markFavoriteTracks(tracks);
      for (const track of tracksWithFavorites) {
        addTrack(track);
      }
      if (!state.currentTrack && tracksWithFavorites.length > 0) {
        play(tracksWithFavorites[0]);
      }
    },
    [markFavoriteTracks, addTrack, state.currentTrack, play]
  );

  const handleToggleFavorite = useCallback(
    (trackId: string) => {
      toggleStoredFavorite(trackId);
      togglePlayerFavorite(trackId);
    },
    [toggleStoredFavorite, togglePlayerFavorite]
  );

  return (
    <div className="app">
      <TitleBar />

      <main className="main-content">
        <div className="toolbar">
          <button
            className="toolbar-btn"
            onClick={handleOpenFile}
            disabled={isLoading}
            title="Abrir arquivo de áudio local"
          >
            {isLoading && loadingProgress
              ? `⏳ ${loadingProgress.processed}/${loadingProgress.total}`
              : isLoading
              ? "⏳ Lendo..."
              : "📂 Arquivo local"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            className={`toolbar-btn ${showDrive ? "toolbar-btn-active" : ""}`}
            onClick={() => setShowDrive((v) => !v)}
            title="Google Drive"
          >
            ☁️ Drive
          </button>
          <button
            className={`toolbar-btn ${showHistory ? "toolbar-btn-active" : ""}`}
            onClick={() => setShowHistory((v) => !v)}
            title="Histórico de reprodução"
          >
            🕐 Histórico
          </button>
          <button
            className={`toolbar-btn ${showPlaylistManager ? "toolbar-btn-active" : ""}`}
            onClick={() => setShowPlaylistManager((v) => !v)}
            title="Gerenciar playlists"
          >
            📋 Playlists
          </button>
          <button
            className="toolbar-btn"
            onClick={cycleTheme}
            title={`Tema: ${theme === "winamp" ? "Winamp Nostálgico" : theme === "dark" ? "Escuro" : "Claro"}`}
          >
            {theme === "winamp" ? "🎨" : theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>

        {showDrive && (
          <DriveBrowser onAddTracks={handleAddDriveTracks} />
        )}

        {showHistory && (
          <HistoryPanel
            entries={history.entries}
            onSelectTrack={handleSelectTrack}
            onClear={history.clear}
          />
        )}

        {showPlaylistManager && (
          <PlaylistManager
            playlists={playlists.playlists}
            activePlaylistId={playlists.activePlaylistId}
            currentTracks={state.playlist}
            onSavePlaylist={playlists.saveCurrentPlaylist}
            onLoadPlaylist={playlists.loadPlaylist}
            onDeletePlaylist={playlists.deletePlaylist}
            onRenamePlaylist={playlists.renamePlaylist}
            onReplaceTracks={(tracks) => {
              // Replace entire playlist
              // First clear by reordering to empty, then add tracks
              // We use a workaround: reorder to empty then add each track
              // Actually, let's just load the tracks into the playlist
              // by reordering to the saved tracks
              if (tracks.length === 0) return;
              // We need to replace the playlist. Since we have reorderPlaylist,
              // we can set the playlist to the loaded tracks directly.
              // The cleanest approach: reorder to the loaded tracks.
              reorderPlaylist(tracks);
              // Start playing the first track
              play(tracks[0]);
            }}
            onClose={() => setShowPlaylistManager(false)}
          />
        )}

        <Playlist
          tracks={state.playlist}
          currentTrackId={state.currentTrack?.id ?? null}
          isPlaying={state.isPlaying}
          onSelectTrack={handleSelectTrack}
          onReorderPlaylist={reorderPlaylist}
          onDropFiles={handleDropFiles}
          onToggleFavorite={handleToggleFavorite}
        />

        <PlayerControls
          currentTrack={state.currentTrack}
          currentTrackId={state.currentTrack?.id ?? null}
          isPlaying={state.isPlaying}
          isShuffled={state.isShuffled}
          repeatMode={state.repeatMode}
          isCompact={isCompact}
          onPlay={() => play()}
          onPause={pause}
          onNext={next}
          onPrev={prev}
          onToggleShuffle={toggleShuffle}
          onRepeatModeChange={setRepeatMode}
          onToggleFavorite={handleToggleFavorite}
          onToggleCompact={() => setIsCompact((v) => !v)}
        />

        <AudioVisualizer
          frequencyData={visualizer.frequencyData}
          waveformData={visualizer.waveformData}
          isActive={visualizer.isActive}
        />

        <ProgressBar
          currentTime={state.currentTime}
          duration={state.duration}
          onSeek={seek}
        />
      </main>

      <StatusBar
        isPlaying={state.isPlaying}
        volume={state.volume}
        onVolumeChange={setVolume}
      />
    </div>
  );
}

export default App;
