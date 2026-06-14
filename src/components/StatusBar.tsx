import { CacheStatus } from "./CacheStatus";

interface StatusBarProps {
  isPlaying: boolean;
  volume: number;
  onVolumeChange?: (volume: number) => void;
}

export function StatusBar({ isPlaying, volume, onVolumeChange }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>{isPlaying ? "▶ Tocando" : "⏹ Parado"}</span>
      <span className="volume-control">
        <span className="volume-icon">
          {volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}
        </span>
        {onVolumeChange ? (
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            title={`Volume: ${volume}%`}
          />
        ) : (
          <span>{volume}%</span>
        )}
      </span>
      <CacheStatus />
    </footer>
  );
}
