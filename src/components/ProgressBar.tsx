import { useCallback, useRef } from "react";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!trackRef.current || duration <= 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  return (
    <div className="progress-bar">
      <div className="progress-track" ref={trackRef} onClick={handleClick}>
        <div
          className="progress-thumb"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
