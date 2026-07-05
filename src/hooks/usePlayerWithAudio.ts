import { useEffect, useCallback, useRef } from "react";
import { usePlayer } from "./usePlayer";
import { useAudioEngine } from "./useAudioEngine";
import type { Track } from "../types";

export function usePlayerWithAudio(initialPlaylist: Track[] = []) {
  const player = usePlayer(initialPlaylist);
  const isSeekingRef = useRef(false);
  const nextTrackRef = useRef<Track | null>(null);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (!isSeekingRef.current) {
        player.setCurrentTime(time);
      }
    },
    [player]
  );

  const handleDurationChange = useCallback(
    (duration: number) => {
      if (isFinite(duration) && duration > 0) {
        player.setDuration(duration);
      }
    },
    [player]
  );

  const handleEnded = useCallback(() => {
    const { repeatMode, playlist, currentTrack, gaplessEnabled } = player.state;

    // Gapless: se a próxima faixa já foi pré-carregada, a transição
    // instantânea já foi feita pelo audio engine. Só atualizamos o estado.
    if (gaplessEnabled) {
      const currentIndex = playlist.findIndex((t) => t.id === currentTrack?.id);
      let nextTrack: Track | null = null;

      if (repeatMode === "one" && currentTrack) {
        nextTrack = currentTrack;
      } else if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        nextTrack = playlist[currentIndex + 1];
      } else if (repeatMode === "all" && playlist.length > 0) {
        nextTrack = playlist[0];
      }

      if (nextTrack) {
        player.play(nextTrack);
        return;
      }
    }

    // Fallback: lógica normal (sem gapless)
    if (repeatMode === "one" && currentTrack) {
      // Repeat one: replay the same track
      player.play(currentTrack);
    } else if (repeatMode === "all" && playlist.length > 0) {
      player.next();
    } else {
      // "none" or end of playlist: stop
      const currentIndex = playlist.findIndex(
        (t) => t.id === currentTrack?.id
      );
      if (currentIndex < playlist.length - 1) {
        player.next();
      } else {
        player.pause();
        player.seek(0);
      }
    }
  }, [player]);

  const handleError = useCallback(
    (error: string) => {
      console.error("[Llama Player]", error);
    },
    []
  );

  const handleLoadStart = useCallback(() => {
    // Could set a loading state here
  }, []);

  const handleCanPlay = useCallback(() => {
    // Audio is ready to play
  }, []);

  const handleCrossfadeStart = useCallback(
    (nextTrack: Track) => {
      // Update the player state to the next track during crossfade
      nextTrackRef.current = nextTrack;
    },
    []
  );

  // Ref para o callback gapless, que precisa acessar o audio engine
  // mas é passado como callback para o audio engine (evita circularidade)
  const gaplessCallbackRef = useRef<() => void>(() => {});

  const handleGaplessEnd = useCallback(() => {
    gaplessCallbackRef.current();
  }, []);

  const audio = useAudioEngine({
    onTimeUpdate: handleTimeUpdate,
    onDurationChange: handleDurationChange,
    onEnded: handleEnded,
    onError: handleError,
    onLoadStart: handleLoadStart,
    onCanPlay: handleCanPlay,
    onCrossfadeStart: handleCrossfadeStart,
    onGaplessEnd: handleGaplessEnd,
  });

  // Agora que o audio engine existe, podemos definir o callback real
  gaplessCallbackRef.current = useCallback(() => {
    const { repeatMode, playlist, currentTrack, gaplessEnabled } = player.state;
    if (!gaplessEnabled) return;

    let nextTrack: Track | null = null;

    if (repeatMode === "one" && currentTrack) {
      nextTrack = currentTrack;
    } else {
      const currentIndex = playlist.findIndex((t) => t.id === currentTrack?.id);
      if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        nextTrack = playlist[currentIndex + 1];
      } else if (repeatMode === "all" && playlist.length > 0) {
        nextTrack = playlist[0];
      }
    }

    if (nextTrack) {
      audio.preloadNextTrack(nextTrack);
    }
  }, [player, audio]);

  // When currentTrack changes, load it in the audio engine with crossfade
  useEffect(() => {
    if (player.state.currentTrack) {
      audio.loadTrack(player.state.currentTrack, player.state.crossfadeDuration);
    }
  }, [player.state.currentTrack?.id, player.state.crossfadeDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause with audio engine
  useEffect(() => {
    if (player.state.isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [player.state.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume with audio engine
  useEffect(() => {
    audio.setVolume(player.state.volume);
  }, [player.state.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync gapless mode with audio engine
  useEffect(() => {
    audio.setGaplessEnabled(player.state.gaplessEnabled);
  }, [player.state.gaplessEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Override seek to also seek in audio engine
  const seek = useCallback(
    (time: number) => {
      isSeekingRef.current = true;
      player.seek(time);
      audio.seek(time);
      // Small timeout to allow audio to process the seek
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    },
    [player, audio]
  );

  // Override play to ensure track is loaded
  const play = useCallback(
    (track?: Track) => {
      if (track) {
        audio.loadTrack(track, player.state.crossfadeDuration);
      }
      player.play(track);
    },
    [player, audio]
  );

  // Override stop
  const stop = useCallback(() => {
    player.stop();
    audio.stop();
  }, [player, audio]);

  return {
    state: player.state,
    play,
    pause: player.pause,
    stop,
    next: player.next,
    prev: player.prev,
    seek,
    setVolume: player.setVolume,
    loadPlaylist: player.loadPlaylist,
    addTrack: player.addTrack,
    removeTrack: player.removeTrack,
    reorderPlaylist: player.reorderPlaylist,
    setRepeatMode: player.setRepeatMode,
    toggleShuffle: player.toggleShuffle,
    toggleFavorite: player.toggleFavorite,
    loadFavorites: player.loadFavorites,
    setCrossfade: player.setCrossfade,
    toggleGapless: player.toggleGapless,
    audioRef: audio.audioRef,
  };
}
