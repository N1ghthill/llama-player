import type { Track } from "../types";

interface HistoryEntry {
  track: Track;
  playedAt: number;
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onSelectTrack: (track: Track) => void;
  onClear: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d atrás`;
  if (hours > 0) return `${hours}h atrás`;
  if (minutes > 0) return `${minutes}min atrás`;
  return "agora";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function HistoryPanel({
  entries,
  onSelectTrack,
  onClear,
}: HistoryPanelProps) {
  return (
    <section className="history-panel">
      <div className="panel-header">
        <span>HISTÓRICO</span>
        {entries.length > 0 && (
          <button
            className="history-clear-btn"
            onClick={onClear}
            title="Limpar histórico"
            aria-label="Limpar histórico"
          >
            🗑 Limpar
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="history-empty">
          Nenhuma música reproduzida ainda
        </div>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li
              key={`${entry.track.id}-${entry.playedAt}`}
              className="history-item"
              onClick={() => onSelectTrack(entry.track)}
              title={`${entry.track.title}${entry.track.artist ? ` — ${entry.track.artist}` : ""}`}
            >
              <span className="history-item-icon">▶</span>
              <span className="history-item-info">
                <span className="history-item-title">{entry.track.title}</span>
                {entry.track.artist && (
                  <span className="history-item-artist">{entry.track.artist}</span>
                )}
              </span>
              <span className="history-item-duration">
                {formatDuration(entry.track.duration)}
              </span>
              <span className="history-item-time">{formatTimeAgo(entry.playedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
