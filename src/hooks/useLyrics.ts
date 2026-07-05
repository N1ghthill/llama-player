/**
 * 🦙 Llama Player — Hook de Letras Sincronizadas
 *
 * Gerencia o carregamento e sincronização de letras no formato LRC.
 * Tenta carregar um arquivo .lRC com o mesmo nome da música atual.
 */

import { useState, useCallback, useRef } from "react";
import { parseLRC, getCurrentLyricLine } from "../services/lrcParser";
import type { LRCData, LRCLine } from "../services/lrcParser";

interface UseLyricsReturn {
  lyrics: LRCData | null;
  currentLine: LRCLine | null;
  nextLine: LRCLine | null;
  progress: number;
  isLoading: boolean;
  error: string | null;
  loadLyrics: (trackTitle: string, trackArtist?: string) => Promise<void>;
  updateTime: (time: number) => void;
  clearLyrics: () => void;
}

export function useLyrics(): UseLyricsReturn {
  const [lyrics, setLyrics] = useState<LRCData | null>(null);
  const [currentLine, setCurrentLine] = useState<LRCLine | null>(null);
  const [nextLine, setNextLine] = useState<LRCLine | null>(null);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lyricsRef = useRef<LRCData | null>(null);
  const currentTimeRef = useRef(0);

  /**
   * Tenta carregar letras para a música atual.
   * Procura por arquivos .lrc no mesmo diretório da música.
   */
  const loadLyrics = useCallback(async (trackTitle: string, trackArtist?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Try multiple possible LRC file names
      const possibleNames = [
        `${trackTitle}.lrc`,
        `${trackTitle} (${trackArtist || ""}).lrc`,
        `${trackArtist} - ${trackTitle}.lrc`,
      ].map((n) => n.replace(/[<>:"/\\|?*]/g, "").trim());

      let lrcText: string | null = null;

      for (const name of possibleNames) {
        if (!name || name === ".lrc") continue;
        try {
          // Try fetching from the same source as the audio
          const response = await fetch(name);
          if (response.ok) {
            lrcText = await response.text();
            break;
          }
        } catch {
          // Try next name
        }
      }

      if (!lrcText) {
        // Try fetching from a lyrics API or local storage
        // For now, just set empty
        setLyrics(null);
        lyricsRef.current = null;
        setCurrentLine(null);
        setNextLine(null);
        setProgress(0);
        setIsLoading(false);
        return;
      }

      const parsed = parseLRC(lrcText);
      setLyrics(parsed);
      lyricsRef.current = parsed;

      // Update current line based on current time
      const result = getCurrentLyricLine(parsed.lines, currentTimeRef.current, parsed.metadata.offset || 0);
      setCurrentLine(result.currentLine);
      setNextLine(result.nextLine);
      setProgress(result.progress);
    } catch (err) {
      setError(`Erro ao carregar letras: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      setLyrics(null);
      lyricsRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Atualiza a linha atual baseada no tempo da reprodução.
   */
  const updateTime = useCallback((time: number) => {
    currentTimeRef.current = time;
    if (!lyricsRef.current) return;

    const result = getCurrentLyricLine(
      lyricsRef.current.lines,
      time,
      lyricsRef.current.metadata.offset || 0
    );
    setCurrentLine(result.currentLine);
    setNextLine(result.nextLine);
    setProgress(result.progress);
  }, []);

  const clearLyrics = useCallback(() => {
    setLyrics(null);
    lyricsRef.current = null;
    setCurrentLine(null);
    setNextLine(null);
    setProgress(0);
    setError(null);
  }, []);

  return {
    lyrics,
    currentLine,
    nextLine,
    progress,
    isLoading,
    error,
    loadLyrics,
    updateTime,
    clearLyrics,
  };
}
