import { useEffect, useRef, useCallback } from "react";
import type { Track } from "../types";
import { getCachedAudio, cacheAudioBlob } from "./useAudioCache";
import { driveService } from "../services/googleDrive";

const DRIVE_STREAM_CHUNK_SIZE = 1024 * 1024;

interface AudioEngineCallbacks {
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onError: (error: string) => void;
  onLoadStart: () => void;
  onCanPlay: () => void;
  onCacheReady?: (trackId: string) => void;
}

function getMediaSourceMimeType(track: Track): string | null {
  const mimeType = track.mimeType?.toLowerCase();
  if (!mimeType || !("MediaSource" in window)) return null;

  const candidates =
    mimeType === "audio/mp4" || mimeType === "audio/x-m4a"
      ? ['audio/mp4; codecs="mp4a.40.2"', "audio/mp4"]
      : mimeType === "audio/webm"
      ? ['audio/webm; codecs="opus"', "audio/webm"]
      : [mimeType];

  return candidates.find((candidate) => MediaSource.isTypeSupported(candidate)) ?? null;
}

function waitForSourceOpen(mediaSource: MediaSource): Promise<void> {
  if (mediaSource.readyState === "open") return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      mediaSource.removeEventListener("sourceopen", onOpen);
      mediaSource.removeEventListener("sourceended", onError);
      mediaSource.removeEventListener("sourceclose", onError);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("MediaSource fechado antes de iniciar o stream"));
    };

    mediaSource.addEventListener("sourceopen", onOpen, { once: true });
    mediaSource.addEventListener("sourceended", onError, { once: true });
    mediaSource.addEventListener("sourceclose", onError, { once: true });
  });
}

function appendBuffer(sourceBuffer: SourceBuffer, buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      sourceBuffer.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.removeEventListener("error", onError);
    };
    const onUpdateEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Erro ao anexar chunk de áudio"));
    };

    sourceBuffer.addEventListener("updateend", onUpdateEnd, { once: true });
    sourceBuffer.addEventListener("error", onError, { once: true });
    sourceBuffer.appendBuffer(buffer);
  });
}

function parseContentRangeTotal(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
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

  const streamDriveTrack = useCallback(
    async (audio: HTMLAudioElement, track: Track, cacheKey: string) => {
      if (!track.driveFileId) return false;

      const mimeType = getMediaSourceMimeType(track);
      if (!mimeType) return false;

      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      trackUrlRef.current = url;
      audio.src = url;
      audio.load();

      await waitForSourceOpen(mediaSource);
      if (currentCacheKeyRef.current !== cacheKey) return true;

      const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      const chunks: BlobPart[] = [];
      let offset = 0;
      let totalSize = track.size ?? null;
      let startedPlayback = false;

      while (currentCacheKeyRef.current === cacheKey) {
        const end =
          totalSize === null
            ? offset + DRIVE_STREAM_CHUNK_SIZE - 1
            : Math.min(offset + DRIVE_STREAM_CHUNK_SIZE - 1, totalSize - 1);

        const response = await driveService.streamFile(track.driveFileId, {
          start: offset,
          end,
        });
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0 || currentCacheKeyRef.current !== cacheKey) break;

        chunks.push(buffer);
        totalSize = totalSize ?? parseContentRangeTotal(response.headers.get("Content-Range"));
        await appendBuffer(sourceBuffer, buffer);

        if (!startedPlayback && pendingPlayRef.current) {
          startedPlayback = true;
          playAudio();
        }

        offset += buffer.byteLength;
        if (totalSize !== null && offset >= totalSize) break;
        if (response.status !== 206 && totalSize === null) break;
      }

      if (currentCacheKeyRef.current === cacheKey && mediaSource.readyState === "open") {
        mediaSource.endOfStream();
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: track.mimeType || mimeType });
          await cacheAudioBlob(cacheKey, blob, track.title);
        }
      }

      return true;
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

    const cacheKey = track.driveFileId ? `drive-${track.driveFileId}` : track.id;
    currentCacheKeyRef.current = cacheKey;

    // Try loading from cache first
    getCachedAudio(cacheKey).then(async (cachedBlob) => {
      if (cachedBlob && currentCacheKeyRef.current === cacheKey) {
        setBlobSource(audio, cachedBlob, track.id);
        return;
      }
      if (currentCacheKeyRef.current !== cacheKey) return;

      if (track.driveFileId) {
        try {
          try {
            const streamed = await streamDriveTrack(audio, track, cacheKey);
            if (streamed) return;
          } catch (err) {
            console.warn("[Llama Player] Streaming progressivo falhou; usando fallback:", err);
          }

          const response = await driveService.streamFile(track.driveFileId);
          const blob = await response.blob();
          if (currentCacheKeyRef.current !== cacheKey) return;

          await cacheAudioBlob(cacheKey, blob, track.title);
          setBlobSource(audio, blob, track.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao carregar áudio do Drive";
          callbacksRef.current.onError(message);
        }
        return;
      }

      // Not cached — load from original source
      if (track.src) {
        audio.src = track.src;
      } else {
        audio.src = "";
      }
      audio.load();
      if (pendingPlayRef.current) {
        playAudio();
      }

      // After the audio can play, fetch and cache the data
      const onCanPlayForCache = async () => {
        audio.removeEventListener("canplay", onCanPlayForCache);
        if (currentCacheKeyRef.current !== cacheKey) return;

        try {
          const sourceUrl = track.src;
          if (!sourceUrl) return;

          const response = await fetch(sourceUrl);
          if (!response.ok) return;

          const blob = await response.blob();
          if (currentCacheKeyRef.current === cacheKey) {
            await cacheAudioBlob(cacheKey, blob, track.title);
          }
        } catch {
          // Silently fail — cache is best-effort
        }
      };

      audio.addEventListener("canplay", onCanPlayForCache);
    });
  }, [playAudio, setBlobSource, streamDriveTrack]);

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
