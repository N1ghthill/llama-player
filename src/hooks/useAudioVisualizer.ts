import { useEffect, useRef, useState, useCallback } from "react";

const FFT_SIZE = 256;
const THROTTLE_FRAMES = 6;

/**
 * Módulo singleton para gerenciar o AudioContext + MediaElementAudioSourceNode.
 *
 * O MediaElementAudioSourceNode só pode ser criado UMA VEZ por elemento <audio>.
 * Se for criado novamente, lança erro. Pior: uma vez criado, a saída de áudio
 * padrão do <audio> é desviada para o AudioContext — se o AudioContext for
 * fechado, o áudio morre.
 *
 * Solução: usamos um mapa global (fora do React) que persiste mesmo com
 * StrictMode. O grafo de áudio é criado na primeira chamada e reutilizado
 * para sempre.
 */
const audioGraphMap = new WeakMap<
  HTMLAudioElement,
  { ctx: AudioContext; analyser: AnalyserNode }
>();

function getOrCreateAudioGraph(audio: HTMLAudioElement): {
  ctx: AudioContext;
  analyser: AnalyserNode;
} | null {
  const existing = audioGraphMap.get(audio);
  if (existing) {
    if (existing.ctx.state === "suspended") {
      existing.ctx.resume().catch(() => {});
    }
    return existing;
  }

  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtxClass) return null;

    const ctx = new AudioCtxClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const graph = { ctx, analyser };
    audioGraphMap.set(audio, graph);

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    return graph;
  } catch (err) {
    console.warn("[Llama Player] AudioContext error:", err);
    return null;
  }
}

export function useAudioVisualizer(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isActive: boolean
) {
  const freqDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(FFT_SIZE / 2));
  const waveDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(FFT_SIZE));
  const [isVisualizerActive, setIsVisualizerActive] = useState(false);

  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  const getVisualizerData = useCallback(() => {
    return {
      frequencyData: freqDataRef.current,
      waveformData: waveDataRef.current,
    };
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsVisualizerActive(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isActive) {
      cleanup();
      return;
    }

    // Cria ou reusa o grafo de áudio (WeakMap garante singleton)
    const graph = getOrCreateAudioGraph(audio);
    if (!graph) {
      cleanup();
      return;
    }

    // Garante que o AudioContext está running
    if (graph.ctx.state === "suspended") {
      graph.ctx.resume().catch(() => {});
    }

    setIsVisualizerActive(true);
    frameCountRef.current = 0;

    const tick = () => {
      const currentGraph = audioGraphMap.get(audio);
      if (currentGraph) {
        const freqArray = freqDataRef.current;
        const waveArray = waveDataRef.current;
        currentGraph.analyser.getByteFrequencyData(freqArray);
        currentGraph.analyser.getByteTimeDomainData(waveArray);

        frameCountRef.current++;
        if (frameCountRef.current >= THROTTLE_FRAMES) {
          frameCountRef.current = 0;
          setIsVisualizerActive((prev) => prev);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cleanup();
    };
  }, [audioRef, isActive, cleanup]);

  return {
    getVisualizerData,
    isActive: isVisualizerActive,
  };
}
