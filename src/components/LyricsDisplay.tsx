/**
 * 🦙 Llama Player — Componente de Exibição de Letras Sincronizadas
 *
 * Exibe as letras da música atual com destaque na linha ativa.
 * Suporta rolagem automática e progresso visual.
 */

import { useRef, useEffect, useState, useCallback, memo } from "react";
import type { LRCLine } from "../services/lrcParser";

interface LyricsDisplayProps {
  currentLine: LRCLine | null;
  nextLine: LRCLine | null;
  progress: number;
  lines: LRCLine[];
  isLoading: boolean;
  error: string | null;
  onClose?: () => void;
}

export const LyricsDisplay = memo(function LyricsDisplay({
  currentLine,
  nextLine,
  progress,
  lines,
  isLoading,
  error,
  onClose,
}: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && !showAll) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      if (
        activeRect.top < containerRect.top + 60 ||
        activeRect.bottom > containerRect.bottom - 60
      ) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLine, showAll]);

  const toggleShowAll = useCallback(() => {
    setShowAll((v) => !v);
  }, []);

  if (isLoading) {
    return (
      <div className="lyrics-panel">
        <div className="panel-header">
          <span>🎤 LETRAS</span>
          {onClose && (
            <button className="lyrics-close-btn" onClick={onClose} title="Fechar">✕</button>
          )}
        </div>
        <div className="lyrics-loading">Carregando letras...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lyrics-panel">
        <div className="panel-header">
          <span>🎤 LETRAS</span>
          {onClose && (
            <button className="lyrics-close-btn" onClick={onClose} title="Fechar">✕</button>
          )}
        </div>
        <div className="lyrics-error">{error}</div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="lyrics-panel">
        <div className="panel-header">
          <span>🎤 LETRAS</span>
          {onClose && (
            <button className="lyrics-close-btn" onClick={onClose} title="Fechar">✕</button>
          )}
        </div>
        <div className="lyrics-empty">
          Nenhuma letra disponível para esta música.
          <br />
          <small>Coloque um arquivo .lrc com o mesmo nome da música na mesma pasta.</small>
        </div>
      </div>
    );
  }

  const displayLines = showAll ? lines : lines.slice(-20); // Show last 20 lines in compact mode

  return (
    <div className="lyrics-panel">
      <div className="panel-header">
        <span>🎤 LETRAS</span>
        <div className="lyrics-header-controls">
          <button
            className="lyrics-toggle-btn"
            onClick={toggleShowAll}
            title={showAll ? "Mostrar apenas recentes" : "Mostrar todas"}
          >
            {showAll ? "📄 Recentes" : "📄 Todas"}
          </button>
          {onClose && (
            <button className="lyrics-close-btn" onClick={onClose} title="Fechar">✕</button>
          )}
        </div>
      </div>
      <div className="lyrics-content" ref={containerRef}>
        {displayLines.map((line, index) => {
          const isActive = currentLine === line;
          const isPast = lines.indexOf(line) < (currentLine ? lines.indexOf(currentLine) : -1);
          const isNext = nextLine === line;

          return (
            <div
              key={index}
              ref={isActive ? activeLineRef : undefined}
              className={`lyrics-line ${isActive ? "lyrics-line-active" : ""} ${isPast ? "lyrics-line-past" : ""} ${isNext ? "lyrics-line-next" : ""}`}
            >
              {isActive && nextLine && (
                <div
                  className="lyrics-line-progress"
                  style={{ width: `${progress * 100}%` }}
                />
              )}
              <span className="lyrics-line-text">{line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
