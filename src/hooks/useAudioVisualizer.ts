import { useEffect, useRef, useState, useCallback } from "react";

const FFT_SIZE = 256;
const SMOOTHING = 0.8;

export function useAudioVisualizer(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isActive: boolean
) {
  const [frequencyData, setFrequencyData] = useState<number[]>(
    new Array(FFT_SIZE / 2).fill(0)
  );
  const [waveformData, setWaveformData] = useState<number[]>(
    new Array(FFT_SIZE).fill(128)
  );
  const [isVisualizerActive, setIsVisualizerActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqBufRef = useRef<Uint8Array>(new Uint8Array(FFT_SIZE / 2));
  const waveBufRef = useRef<Uint8Array>(new Uint8Array(FFT_SIZE));

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setIsVisualizerActive(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isActive) {
      cleanup();
      return;
    }

    // Avoid re-creating if already connected to the same audio element
    if (audioContextRef.current && sourceRef.current) {
      setIsVisualizerActive(true);
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        console.warn("[Llama Player] AudioContext not available");
        return;
      }

      const ctx = new AudioCtx();
      ctx.resume().catch((e) =>
        console.warn("[Llama Player] AudioContext resume error:", e)
      );
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      setIsVisualizerActive(true);

      const tick = () => {
        if (analyserRef.current) {
          const freqArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          const waveArray = new Uint8Array(analyserRef.current.fftSize);
          analyserRef.current.getByteFrequencyData(freqArray);
          analyserRef.current.getByteTimeDomainData(waveArray);
          freqBufRef.current = freqArray;
          waveBufRef.current = waveArray;
          setFrequencyData(Array.from(freqArray));
          setWaveformData(Array.from(waveArray));
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("[Llama Player] AudioContext error:", err);
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [audioRef, isActive, cleanup]);

  return {
    frequencyData,
    waveformData,
    isActive: isVisualizerActive,
  };
}
