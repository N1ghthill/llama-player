import type { RepeatMode, Track } from "../types";

interface PlayerControlsProps {
  currentTrack: Track | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  isCompact?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle?: () => void;
  onRepeatModeChange?: (mode: RepeatMode) => void;
  onToggleFavorite?: (trackId: string) => void;
  onToggleCompact?: () => void;
}

export function PlayerControls({
  currentTrack,
  currentTrackId,
  isPlaying,
  isShuffled,
  repeatMode,
  isCompact = false,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onToggleShuffle,
  onRepeatModeChange,
  onToggleFavorite,
  onToggleCompact,
}: PlayerControlsProps) {
  const handleRepeatClick = () => {
    if (!onRepeatModeChange) return;
    const nextMode: RepeatMode =
      repeatMode === "none" ? "all" : repeatMode === "all" ? "one" : "none";
    onRepeatModeChange(nextMode);
  };

  const repeatLabel =
    repeatMode === "one"
      ? "Repetir uma"
      : repeatMode === "all"
      ? "Repetir todas"
      : "Repetir: desativado";

  if (isCompact) {
    return (
      <section className="player-controls-compact">
        <button
          className="ctrl-btn play-btn"
          onClick={isPlaying ? onPause : onPlay}
          title={isPlaying ? "Pausar" : "Tocar"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="now-playing-info" key={currentTrack?.id ?? "empty"}>
          <span className="track-title">
            {currentTrack ? currentTrack.title : "Nenhuma música tocando"}
          </span>
        </div>
        <button
          className="compact-toggle-btn"
          onClick={onToggleCompact}
          title="Expandir"
          aria-label="Expandir"
        >
          🗖
        </button>
      </section>
    );
  }

  return (
    <section className={`player-controls${isPlaying ? " playing" : ""}`}>
      <div className="now-playing">
        {currentTrack?.coverUrl && (
          <img
            className="album-art"
            src={currentTrack.coverUrl}
            alt={`Capa do álbum${currentTrack.album ? ` — ${currentTrack.album}` : ""}`}
          />
        )}
        <div className="now-playing-info" key={currentTrack?.id ?? "empty"}>
          <span className="track-title">
            {currentTrack ? currentTrack.title : "Nenhuma música tocando"}
          </span>
          {currentTrack?.artist && (
            <span className="track-artist">{currentTrack.artist}</span>
          )}
          {currentTrack?.album && (
            <span className="track-album">{currentTrack.album}</span>
          )}
        </div>
        {currentTrackId && onToggleFavorite && (
          <button
            className={`favorite-btn ${currentTrack?.isFavorite ? "favorite-active" : ""}`}
            onClick={() => onToggleFavorite(currentTrackId)}
            title={currentTrack?.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            aria-label={currentTrack?.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            {currentTrack?.isFavorite ? "♥" : "♡"}
          </button>
        )}
      </div>

      <div className="controls">
        <button
          className={`ctrl-btn shuffle-btn ${isShuffled ? "active" : ""}`}
          onClick={onToggleShuffle}
          title={isShuffled ? "Aleatório: ativado" : "Aleatório: desativado"}
        >
          🔀 {isShuffled ? "ON" : "OFF"}
        </button>
        <button
          className={`ctrl-btn repeat-btn ${repeatMode !== "none" ? "active" : ""}`}
          onClick={handleRepeatClick}
          title={repeatLabel}
          aria-label={repeatLabel}
        >
          {repeatMode === "one" ? "🔂 1" : repeatMode === "all" ? "🔁 ALL" : "🔁 OFF"}
        </button>
        <button className="ctrl-btn" onClick={onPrev} title="Anterior">
          ⏮
        </button>
        <button
          className="ctrl-btn play-btn"
          onClick={isPlaying ? onPause : onPlay}
          title={isPlaying ? "Pausar" : "Tocar"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="ctrl-btn" onClick={onNext} title="Próxima">
          ⏭
        </button>
        {onToggleCompact && (
          <button
            className="compact-toggle-btn"
            onClick={onToggleCompact}
            title="Modo compacto"
            aria-label="Modo compacto"
          >
            🔲
          </button>
        )}
      </div>
    </section>
  );
}
