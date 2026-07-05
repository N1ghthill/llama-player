import { useEffect, useRef, useCallback } from "react";
import type { Track } from "../types";
import { getCachedAudio, cacheAudioBlob } from "../services/audioCache";

interface AudioEngineCallbacks {
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onError: (error: string) => void;
  onLoadStart: () => void;
  onCanPlay: () => void;
  onCacheReady?: (trackId: string) => void;
  onCrossfadeStart?: (nextTrack: Track) => void;
  onGaplessEnd?: () => void; // chamado quando a faixa está perto do fim em modo gapless
}

const CROSSFADE_INTERVAL_MS = 50; // how often to update fade volume
const LOAD_TIMEOUT_MS = 30000; // max time to wait for audio element to load

function isCacheableHttpSource(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.hostname === "asset.localhost") return false;
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readLocalTrackBlob(track: Track): Promise<Blob | null> {
  if (!track.filePath) return null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[] | ArrayBuffer | Uint8Array>("read_audio_file", {
      path: track.filePath,
    });
    const data =
      bytes instanceof Uint8Array
        ? bytes
        : bytes instanceof ArrayBuffer
          ? new Uint8Array(bytes)
          : new Uint8Array(bytes);
    return new Blob([data.buffer as ArrayBuffer], { type: track.mimeType || "audio/mpeg" });
  } catch (err) {
    console.warn("[Llama Player] Erro ao ler arquivo local:", err);
    return null;
  }
}

export function useAudioEngine(callbacks: AudioEngineCallbacks) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeAudioRef = useRef<HTMLAudioElement | null>(null);
  const callbacksRef = useRef(callbacks);
  const trackUrlRef = useRef<string | null>(null);
  const crossfadeUrlRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);
  const crossfadeDurationRef = useRef(0);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crossfadeGenRef = useRef(0); // generation token para evitar concorrência
  const baseVolumeRef = useRef(1); // 0..1
  const gaplessEnabledRef = useRef(false);
  const preloadedTrackRef = useRef<Track | null>(null);
  const gaplessSwapReadyRef = useRef(false);

  // AudioContext + AnalyserNode compartilhado para o visualizer.
  // Gerenciado externamente pelo useAudioVisualizer para evitar
  // problemas com StrictMode e recriação do MediaElementAudioSourceNode.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Keep callbacks ref fresh
  callbacksRef.current = callbacks;

  const cleanupCrossfade = useCallback(() => {
    if (crossfadeTimerRef.current !== null) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    const crossfadeAudio = crossfadeAudioRef.current;
    if (crossfadeAudio) {
      crossfadeAudio.pause();
      crossfadeAudio.src = "";
      if (crossfadeUrlRef.current) {
        URL.revokeObjectURL(crossfadeUrlRef.current);
        crossfadeUrlRef.current = null;
      }
    }
  }, []);

  // Initialize audio elements once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";

    const crossfadeAudio = new Audio();
    crossfadeAudio.preload = "auto";

    const onTimeUpdate = () => {
      callbacksRef.current.onTimeUpdate(audio.currentTime);

      // Gapless: detect when track is near end to preload next
      if (gaplessEnabledRef.current && audio.duration > 0) {
        const remaining = audio.duration - audio.currentTime;
        if (remaining <= 5 && remaining > 0 && !preloadedTrackRef.current) {
          callbacksRef.current.onGaplessEnd?.();
        }
      }
    };
    const onDurationChange = () => callbacksRef.current.onDurationChange(audio.duration);
    const onEnded = () => {
      // If gapless swap is ready, handle it silently
      if (gaplessSwapReadyRef.current) {
        gaplessSwapReadyRef.current = false;
        // The swap already happened; just notify
        callbacksRef.current.onEnded();
        return;
      }
      callbacksRef.current.onEnded();
    };
    const onError = () => {
      const msg = audio.error
        ? `Erro de áudio: ${audio.error.message || `código ${audio.error.code}`}`
        : "Erro desconhecido ao carregar áudio";
      callbacksRef.current.onError(msg);
    };
    const onLoadStart = () => callbacksRef.current.onLoadStart();
    const onCanPlay = () => callbacksRef.current.onCanPlay();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("canplay", onCanPlay);

    audioRef.current = audio;
    crossfadeAudioRef.current = crossfadeAudio;

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      crossfadeAudio.pause();
      crossfadeAudio.src = "";
      cleanupCrossfade();
      crossfadeAudioRef.current = null;
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [cleanupCrossfade]);

  const playAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) {
      pendingPlayRef.current = true;
      return;
    }

    pendingPlayRef.current = false;
    audio.play().catch((err) => {
      callbacksRef.current.onError(`Erro ao reproduzir: ${err.message}`);
    });
  }, []);

  const setBlobSource = useCallback(
    (audio: HTMLAudioElement, blob: Blob, trackId: string) => {
      const url = URL.createObjectURL(blob);
      if (audio === audioRef.current) {
        if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
        trackUrlRef.current = url;
      } else {
        if (crossfadeUrlRef.current) URL.revokeObjectURL(crossfadeUrlRef.current);
        crossfadeUrlRef.current = url;
      }
      audio.src = url;
      audio.load();
      callbacksRef.current.onCacheReady?.(trackId);
      if (pendingPlayRef.current && audio === audioRef.current) {
        playAudio();
      }
    },
    [playAudio]
  );

  const setDirectSource = useCallback(
    (audio: HTMLAudioElement, sourceUrl: string) => {
      if (audio === audioRef.current && trackUrlRef.current) {
        URL.revokeObjectURL(trackUrlRef.current);
        trackUrlRef.current = null;
      } else if (audio !== audioRef.current && crossfadeUrlRef.current) {
        URL.revokeObjectURL(crossfadeUrlRef.current);
        crossfadeUrlRef.current = null;
      }

      audio.src = sourceUrl;
      audio.load();

      if (pendingPlayRef.current && audio === audioRef.current) {
        playAudio();
      }
    },
    [playAudio]
  );

  const loadAudioElement = useCallback(
    (audio: HTMLAudioElement, track: Track): Promise<void> => {
      return new Promise((resolve) => {
        const cacheKey = track.id;
        const sourceUrl = track.src;

        // Timeout de segurança: se o áudio não carregar em 30s, resolve
        // para não travar crossfade ou gapless para sempre
        const timeoutId = setTimeout(() => {
          resolve();
        }, LOAD_TIMEOUT_MS);

        const done = () => {
          clearTimeout(timeoutId);
          resolve();
        };

        if (!sourceUrl) {
          audio.src = "";
          audio.load();
          done();
          return;
        }

        if (!isCacheableHttpSource(sourceUrl)) {
          // Para URLs do protocolo asset (Tauri: asset.localhost),
          // tenta usar diretamente primeiro, pois o protocolo asset
          // já serve o arquivo corretamente para o elemento <audio>.
          // O readLocalTrackBlob é um fallback para quando a URL
          // direta não funciona (ex: caminhos locais sem protocolo).
          if (sourceUrl.includes("asset.localhost")) {
            setDirectSource(audio, sourceUrl);
            done();
            return;
          }

          readLocalTrackBlob(track).then((localBlob) => {
            if (localBlob) {
              setBlobSource(audio, localBlob, track.id);
            } else {
              setDirectSource(audio, sourceUrl);
            }
            done();
          });
          return;
        }

        getCachedAudio(cacheKey).then(async (cachedBlob) => {
          if (cachedBlob) {
            setBlobSource(audio, cachedBlob, track.id);
            done();
            return;
          }

          try {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
              setDirectSource(audio, sourceUrl);
              done();
              return;
            }

            const blob = await response.blob();
            // Cache in background
            cacheAudioBlob(cacheKey, blob, track.title).catch(() => {});
            setBlobSource(audio, blob, track.id);
            done();
          } catch {
            setDirectSource(audio, sourceUrl);
            done();
          }
        });
      });
    },
    [setBlobSource, setDirectSource]
  );

  const startCrossfade = useCallback(
    (nextTrack: Track, duration: number) => {
      const currentAudio = audioRef.current;
      const nextAudio = crossfadeAudioRef.current;
      if (!currentAudio || !nextAudio || duration <= 0) return;

      cleanupCrossfade();

      // Generation token: se startCrossfade for chamado novamente antes
      // do loadAudioElement resolver, o callback do primeiro é ignorado
      const gen = ++crossfadeGenRef.current;

      // Load the next track into the crossfade audio element
      loadAudioElement(nextAudio, nextTrack).then(() => {
        // Se um novo crossfade foi iniciado, ignora este callback
        if (gen !== crossfadeGenRef.current) return;
        if (!nextAudio.src) return;

        // Start playing the next audio at volume 0
        nextAudio.volume = 0;
        nextAudio.play().catch(() => {});

        callbacksRef.current.onCrossfadeStart?.(nextTrack);

        const steps = Math.max(1, Math.floor((duration * 1000) / CROSSFADE_INTERVAL_MS));
        let currentStep = 0;

        crossfadeTimerRef.current = setInterval(() => {
          currentStep++;
          const progress = currentStep / steps;

          // Fade out current
          currentAudio.volume = Math.max(0, baseVolumeRef.current * (1 - progress));
          // Fade in next
          nextAudio.volume = Math.min(baseVolumeRef.current, baseVolumeRef.current * progress);

          if (currentStep >= steps) {
            if (crossfadeTimerRef.current !== null) {
              clearInterval(crossfadeTimerRef.current);
              crossfadeTimerRef.current = null;
            }

            const nextSrc = nextAudio.src;
            const nextCurrentTime = nextAudio.currentTime;

            currentAudio.pause();
            currentAudio.src = "";
            if (trackUrlRef.current) {
              URL.revokeObjectURL(trackUrlRef.current);
              trackUrlRef.current = null;
            }

            // Move next audio to primary
            currentAudio.src = nextSrc;
            currentAudio.currentTime = nextCurrentTime;
            currentAudio.volume = baseVolumeRef.current;
            if (crossfadeUrlRef.current) {
              trackUrlRef.current = crossfadeUrlRef.current;
              crossfadeUrlRef.current = null;
            }
            currentAudio.play().catch(() => {});

            // Clear the crossfade audio
            nextAudio.pause();
            nextAudio.src = "";
          }
        }, CROSSFADE_INTERVAL_MS);
      });
    },
    [loadAudioElement, cleanupCrossfade]
  );

  const loadTrack = useCallback(
    (track: Track, crossfadeDuration: number = 0) => {
      const audio = audioRef.current;
      if (!audio) return;

      crossfadeDurationRef.current = crossfadeDuration;

      // If crossfade is active and we have a current track playing, do crossfade
      if (crossfadeDuration > 0 && audio.src && !audio.paused) {
        startCrossfade(track, crossfadeDuration);
        return;
      }

      // No crossfade — normal load
      cleanupCrossfade();

      // Revoke previous blob URL if any
      if (trackUrlRef.current) {
        URL.revokeObjectURL(trackUrlRef.current);
        trackUrlRef.current = null;
      }

      loadAudioElement(audio, track);
    },
    [loadAudioElement, startCrossfade, cleanupCrossfade]
  );

  const play = useCallback(() => {
    playAudio();
  }, [playAudio]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    // Also pause crossfade audio if active
    crossfadeAudioRef.current?.pause();
    cleanupCrossfade();
  }, [cleanupCrossfade]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    cleanupCrossfade();
  }, [cleanupCrossfade]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
  }, []);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const vol = volume / 100;
    baseVolumeRef.current = vol;
    audio.volume = vol;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
  }, []);

  /**
   * Ativa/desativa o modo gapless.
   */
  const setGaplessEnabled = useCallback((enabled: boolean) => {
    gaplessEnabledRef.current = enabled;
  }, []);

  /**
   * Pré-carrega a próxima faixa no elemento de áudio secundário.
   * Usado pelo gapless playback para transição instantânea.
   */
  const preloadNextTrack = useCallback(
    (track: Track) => {
      const nextAudio = crossfadeAudioRef.current;
      if (!nextAudio) return;
      preloadedTrackRef.current = track;
      loadAudioElement(nextAudio, track);
    },
    [loadAudioElement]
  );

  /**
   * Executa a transição gapless: troca o áudio atual pelo pré-carregado
   * sem pausa perceptível.
   */
  const performGaplessSwap = useCallback(() => {
    const currentAudio = audioRef.current;
    const nextAudio = crossfadeAudioRef.current;
    if (!currentAudio || !nextAudio || !nextAudio.src) return false;

    // Check if next audio is ready enough
    if (nextAudio.readyState < 2) return false;

    // Start playing next audio at current volume
    nextAudio.volume = baseVolumeRef.current;
    nextAudio.play().catch(() => {});

    // Pause and clear current audio
    currentAudio.pause();
    currentAudio.src = "";
    if (trackUrlRef.current) {
      URL.revokeObjectURL(trackUrlRef.current);
      trackUrlRef.current = null;
    }

    // Swap refs: the crossfade audio becomes the primary
    // We copy the src to the primary element for event listeners to work
    const nextSrc = nextAudio.src;
    const nextCurrentTime = nextAudio.currentTime;
    currentAudio.src = nextSrc;
    currentAudio.currentTime = nextCurrentTime;
    currentAudio.volume = baseVolumeRef.current;
    if (crossfadeUrlRef.current) {
      trackUrlRef.current = crossfadeUrlRef.current;
      crossfadeUrlRef.current = null;
    }
    currentAudio.play().catch(() => {});

    // Clear crossfade audio
    nextAudio.pause();
    nextAudio.src = "";

    preloadedTrackRef.current = null;
    gaplessSwapReadyRef.current = true;
    return true;
  }, []);

  /**
   * Modifica loadTrack para suportar gapless:
   * Se o gapless está ativo e a próxima faixa já foi pré-carregada,
   * faz a troca instantânea em vez de carregar do zero.
   *
   * Usamos uma ref para loadTrack para evitar closure stale:
   * se loadTrack for recriado (ex: StrictMode), a ref sempre aponta
   * para a versão mais recente.
   */
  const loadTrackRef = useRef(loadTrack);
  loadTrackRef.current = loadTrack;

  const gaplessLoadTrack = useCallback(
    (track: Track, crossfadeDuration: number = 0) => {
      // If gapless is enabled and we have a preloaded track, do instant swap
      if (
        gaplessEnabledRef.current &&
        crossfadeDuration === 0 &&
        preloadedTrackRef.current?.id === track.id
      ) {
        const swapped = performGaplessSwap();
        if (swapped) return;
      }
      // Fall back to normal load (sempre a versão mais recente)
      loadTrackRef.current(track, crossfadeDuration);
    },
    [performGaplessSwap]
  );

  return {
    loadTrack: gaplessLoadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPlaybackRate,
    setGaplessEnabled,
    preloadNextTrack,
    audioRef,
  };
}
