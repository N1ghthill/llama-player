import { useEffect, useRef, useCallback } from "react";
import type { Track } from "../types";
import { getCachedAudio, cacheAudioBlob } from "./useAudioCache";

interface AudioEngineCallbacks {
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onError: (error: string) => void;
  onLoadStart: () => void;
  onCanPlay: () => void;
  onCacheReady?: (trackId: string) => void;
}

export function useAudioEngine(callbacks: AudioEngineCallbacks) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callbacksRef = useRef(callbacks);
  const trackUrlRef = useRef<string | null>(null);
  const currentCacheKeyRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);

  // Keep callbacks ref fresh
  callbacksRef.current = callbacks;

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";

    const onTimeUpdate = () => callbacksRef.current.onTimeUpdate(audio.currentTime);
    const onDurationChange = () => callbacksRef.current.onDurationChange(audio.duration);
    const onEnded = () => callbacksRef.current.onEnded();
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
    };
  }, []);

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
      trackUrlRef.current = url;
      audio.src = url;
      audio.load();
      callbacksRef.current.onCacheReady?.(trackId);
      if (pendingPlayRef.current) {
        playAudio();
      }
    },
    [playAudio]
  );

  const loadTrack = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Revoke previous blob URL if any
    if (trackUrlRef.current) {
      URL.revokeObjectURL(trackUrlRef.current);
      trackUrlRef.current = null;
    }

    const cacheKey = track.id;
    currentCacheKeyRef.current = cacheKey;

    // Try loading from cache first
    getCachedAudio(cacheKey).then(async (cachedBlob) => {
      if (cachedBlob && currentCacheKeyRef.current === cacheKey) {
        setBlobSource(audio, cachedBlob, track.id);
        return;
      }
      if (currentCacheKeyRef.current !== cacheKey) return;

      // Not cached — fetch the data first, then cache and play
      try {
        const sourceUrl = track.src;
        if (!sourceUrl) {
          audio.src = "";
          audio.load();
          return;
        }

        const response = await fetch(sourceUrl);
        if (!response.ok) {
          // Fallback to direct source if fetch fails
          audio.src = sourceUrl;
          audio.load();
          if (pendingPlayRef.current) {
            playAudio();
          }
          return;
        }

        const blob = await response.blob();
        if (currentCacheKeyRef.current !== cacheKey) return;

        // Cache the blob for future use
        await cacheAudioBlob(cacheKey, blob, track.title);

        if (currentCacheKeyRef.current === cacheKey) {
          setBlobSource(audio, blob, track.id);
        }
      } catch {
        // Fallback to direct source on error
        if (currentCacheKeyRef.current !== cacheKey) return;
        if (track.src) {
          audio.src = track.src;
          audio.load();
          if (pendingPlayRef.current) {
            playAudio();
          }
        }
      }
    });
  }, [playAudio, setBlobSource]);

  const play = useCallback(() => {
    playAudio();
  }, [playAudio]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
  }, []);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
  }, []);

  return {
    loadTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setPlaybackRate,
    audioRef,
  };
}
