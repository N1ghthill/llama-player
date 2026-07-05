import { useCallback, useRef, useState, useEffect } from "react";
import { usePlayerWithAudio } from "./hooks/usePlayerWithAudio";
import { useMetadata } from "./hooks/useMetadata";
import { useTauri } from "./hooks/useTauri";
import { useAudioVisualizer } from "./hooks/useAudioVisualizer";
import { useFavorites } from "./hooks/useFavorites";
import { useHistory } from "./hooks/useHistory";
import { usePlaylists } from "./hooks/usePlaylists";
import { useTheme } from "./hooks/useTheme";
import { useLyrics } from "./hooks/useLyrics";
import {
  TitleBar,
  Playlist,
  StatusBar,
  MixerPanel,
  DeckPanel,
  LibraryShell,
} from "./components";
import type { Track } from "./types";
import { createTrackFromLocalPath } from "./services/localMetadata";

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
    setCrossfade,
    toggleGapless,
    audioRef,
  } = usePlayerWithAudio([]);

  const { processFiles } = useMetadata();
  const {
    state: tauriState,
    openFilePicker,
    openFolderPicker,
    filePathToUrl,
  } = useTauri();

  const { loadFavorites, toggleFavorite: toggleStoredFavorite } = useFavorites();
  const history = useHistory();
  const {
    playlists: savedPlaylists,
    activePlaylistId,
    saveCurrentPlaylist,
    loadPlaylist,
    deletePlaylist,
    renamePlaylist,
  } = usePlaylists();
  const { theme, cycleTheme } = useTheme();
  const visualizerContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useAudioVisualizer(audioRef, state.isPlaying, visualizerContainerRef);
  const {
    lyrics: lyricsData,
    currentLine,
    nextLine,
    progress: lyricsProgress,
    isLoading: lyricsLoading,
    error: lyricsError,
  } = useLyrics();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ processed: number; total: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs para evitar dependências de estado que mudam frequentemente
  const isPlayingRef = useRef(state.isPlaying);
  const currentTimeRef = useRef(state.currentTime);
  const durationRef = useRef(state.duration);
  const volumeRef = useRef(state.volume);
  const currentTrackRef = useRef(state.currentTrack);
  isPlayingRef.current = state.isPlaying;
  currentTimeRef.current = state.currentTime;
  durationRef.current = state.duration;
  volumeRef.current = state.volume;
  currentTrackRef.current = state.currentTrack;

  // Ref para history.addEntry (estável, evita dependência do objeto history)
  const addHistoryEntryRef = useRef(history.addEntry);
  addHistoryEntryRef.current = history.addEntry;

  // Carrega favoritos salvos ao iniciar
  useEffect(() => {
    const savedFavorites = loadFavorites();
    if (savedFavorites.length > 0) {
      loadPlayerFavorites(savedFavorites);
    }
  }, [loadFavorites, loadPlayerFavorites]);

  // Handler centralizado para adicionar tracks à playlist
  // Usa ref para currentTrack para evitar recriação quando a música muda
  const addTracksToPlaylist = useCallback(
    async (tracks: Track[]) => {
      const favoriteIds = new Set(loadFavorites());
      const markedTracks =
        favoriteIds.size === 0
          ? tracks
          : tracks.map((track) =>
              favoriteIds.has(track.id) ? { ...track, isFavorite: true } : track
            );

      for (const track of markedTracks) {
        addTrack(track);
      }

      if (!currentTrackRef.current && markedTracks.length > 0) {
        play(markedTracks[0]);
      }
    },
    [loadFavorites, addTrack, play]
  );

  const handleOpenFile = useCallback(async () => {
    if (tauriState.isTauri) {
      setIsLoading(true);
      try {
        const paths = await openFilePicker();
        if (!paths || paths.length === 0) return;

        const localTracks: Track[] = [];
        for (const path of paths) {
          const url = await filePathToUrl(path);
          localTracks.push(await createTrackFromLocalPath(path, url));
        }

        await addTracksToPlaylist(localTracks);
      } catch (err) {
        console.error("[Llama Player] Erro ao abrir arquivos:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [tauriState.isTauri, openFilePicker, filePathToUrl, addTracksToPlaylist]);

  const handleOpenFolder = useCallback(async () => {
    if (tauriState.isTauri) {
      setIsLoading(true);
      try {
        const paths = await openFolderPicker();
        if (!paths || paths.length === 0) return;

        const localTracks: Track[] = [];
        for (const path of paths) {
          const url = await filePathToUrl(path);
          localTracks.push(await createTrackFromLocalPath(path, url));
          setLoadingProgress({ processed: localTracks.length, total: paths.length });
        }

        await addTracksToPlaylist(localTracks);
      } catch (err) {
        console.error("[Llama Player] Erro ao abrir pasta:", err);
      } finally {
        setIsLoading(false);
        setLoadingProgress(null);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.accept = "audio/*";
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const fileList = target.files;
        if (!fileList || fileList.length === 0) return;

        setIsLoading(true);
        try {
          const fileArray = Array.from(fileList);
          const processedTracks = await processFiles(fileArray, (progress) => {
            setLoadingProgress(progress);
          });
          await addTracksToPlaylist(processedTracks);
        } catch (err) {
          console.error("[Llama Player] Erro ao processar pasta:", err);
        } finally {
          setIsLoading(false);
          setLoadingProgress(null);
        }
      };
      input.click();
    }
  }, [tauriState.isTauri, openFolderPicker, filePathToUrl, processFiles, addTracksToPlaylist]);

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
        await addTracksToPlaylist(processedTracks);
      } catch (err) {
        console.error("[Llama Player] Erro ao processar arquivos:", err);
      } finally {
        setIsLoading(false);
        setLoadingProgress(null);
      }

      e.target.value = "";
    },
    [processFiles, addTracksToPlaylist]
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
        await addTracksToPlaylist(processedTracks);
      } catch (err) {
        console.error("[Llama Player] Erro ao processar arquivos arrastados:", err);
      } finally {
        setIsLoading(false);
        setLoadingProgress(null);
      }
    },
    [processFiles, addTracksToPlaylist]
  );

  const handleToggleFavorite = useCallback(
    (trackId: string) => {
      toggleStoredFavorite(trackId);
      togglePlayerFavorite(trackId);
    },
    [toggleStoredFavorite, togglePlayerFavorite]
  );

  // Usa ref para history.addEntry — evita dependência do objeto history
  const handleSelectTrack = useCallback(
    (track: Track) => {
      addHistoryEntryRef.current(track);
      play(track);
    },
    [play]
  );

  // Handlers estáveis para os toggles (evitam quebrar React.memo)
  const handleToggleCompact = useCallback(() => {
    setIsCompact((v) => !v);
  }, []);

  const handleToggleShowHistory = useCallback(() => {
    setShowHistory((v) => !v);
  }, []);

  const handleToggleShowPlaylistManager = useCallback(() => {
    setShowPlaylistManager((v) => !v);
  }, []);

  const handleToggleShowLyrics = useCallback(() => {
    setShowLyrics((v) => !v);
  }, []);

  const handleToggleShowDataManagement = useCallback(() => {
    setShowDataManagement((v) => !v);
  }, []);

  const handleClosePlaylistManager = useCallback(() => {
    setShowPlaylistManager(false);
  }, []);

  const handleCloseDataManagement = useCallback(() => {
    setShowDataManagement(false);
  }, []);

  const handleReplaceTracks = useCallback(
    (tracks: Track[]) => {
      if (tracks.length === 0) return;
      reorderPlaylist(tracks);
      play(tracks[0]);
    },
    [reorderPlaylist, play]
  );

  // Efeito de teclado com refs para evitar recriação do listener a cada tick
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          isPlayingRef.current ? pause() : play();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seek(Math.max(0, currentTimeRef.current - 5));
          break;
        case "ArrowRight":
          event.preventDefault();
          seek(Math.min(durationRef.current, currentTimeRef.current + 5));
          break;
        case "ArrowUp":
        case "+":
        case "=":
          event.preventDefault();
          setVolume(Math.min(100, volumeRef.current + 5));
          break;
        case "ArrowDown":
        case "-":
          event.preventDefault();
          setVolume(Math.max(0, volumeRef.current - 5));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [play, pause, seek, setVolume]);

  return (
    <div className="app">
      <TitleBar />

      <main className="main-content">
        <section className="studio-stack">
          <DeckPanel
            visualizerContainerRef={visualizerContainerRef}
            getVisualizerData={visualizer.getVisualizerData}
            isVisualizerActive={visualizer.isActive}
            currentTrack={state.currentTrack}
            currentTrackId={state.currentTrack?.id ?? null}
            isPlaying={state.isPlaying}
            isShuffled={state.isShuffled}
            repeatMode={state.repeatMode}
            crossfadeDuration={state.crossfadeDuration}
            gaplessEnabled={state.gaplessEnabled}
            isCompact={isCompact}
            currentTime={state.currentTime}
            duration={state.duration}
            onPlay={play}
            onPause={pause}
            onNext={next}
            onPrev={prev}
            onToggleShuffle={toggleShuffle}
            onRepeatModeChange={setRepeatMode}
            onToggleFavorite={handleToggleFavorite}
            onToggleCompact={handleToggleCompact}
            onSeek={seek}
          />

          <MixerPanel
            volume={state.volume}
            crossfadeDuration={state.crossfadeDuration}
            gaplessEnabled={state.gaplessEnabled}
            isPlaying={state.isPlaying}
            onVolumeChange={setVolume}
            onCrossfadeChange={setCrossfade}
            onToggleGapless={toggleGapless}
          />

          <Playlist
            tracks={state.playlist}
            currentTrackId={state.currentTrack?.id ?? null}
            isPlaying={state.isPlaying}
            onSelectTrack={handleSelectTrack}
            onReorderPlaylist={reorderPlaylist}
            onDropFiles={handleDropFiles}
            onToggleFavorite={handleToggleFavorite}
          />
        </section>

        <LibraryShell
          theme={theme}
          isLoading={isLoading}
          loadingProgress={loadingProgress}
          currentTrack={state.currentTrack}
          showHistory={showHistory}
          showPlaylistManager={showPlaylistManager}
          showLyrics={showLyrics}
          showDataManagement={showDataManagement}
          historyEntries={history.entries}
          savedPlaylists={savedPlaylists}
          activePlaylistId={activePlaylistId}
          lyricsData={lyricsData}
          currentLine={currentLine}
          nextLine={nextLine}
          lyricsProgress={lyricsProgress}
          lyricsLoading={lyricsLoading}
          lyricsError={lyricsError}
          playlistTracks={state.playlist}
          fileInputRef={fileInputRef}
          onCycleTheme={cycleTheme}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onFileChange={handleFileChange}
          onToggleShowHistory={handleToggleShowHistory}
          onToggleShowPlaylistManager={handleToggleShowPlaylistManager}
          onToggleShowLyrics={handleToggleShowLyrics}
          onToggleShowDataManagement={handleToggleShowDataManagement}
          onSelectTrack={handleSelectTrack}
          onClearHistory={history.clear}
          onSavePlaylist={saveCurrentPlaylist}
          onLoadPlaylist={loadPlaylist}
          onDeletePlaylist={deletePlaylist}
          onRenamePlaylist={renamePlaylist}
          onReplaceTracks={handleReplaceTracks}
          onClosePlaylistManager={handleClosePlaylistManager}
          onCloseDataManagement={handleCloseDataManagement}
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
