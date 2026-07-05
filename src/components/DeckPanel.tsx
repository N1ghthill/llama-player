import { memo } from "react";
import type { Track, RepeatMode } from "../types";
import { AudioVisualizer } from "./AudioVisualizer";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";

interface DeckPanelProps {
  visualizerContainerRef: React.RefObject<HTMLDivElement | null>;
  getVisualizerData: () => { frequencyData: Uint8Array; waveformData: Uint8Array };
  isVisualizerActive: boolean;
  currentTrack: Track | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  crossfadeDuration: number;
  gaplessEnabled: boolean;
  isCompact: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
  onRepeatModeChange: (mode: RepeatMode) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleCompact: () => void;
  onSeek: (time: number) => void;
}

export const DeckPanel = memo(function DeckPanel({
  visualizerContainerRef,
  getVisualizerData,
  isVisualizerActive,
  currentTrack,
  currentTrackId,
  isPlaying,
  isShuffled,
  repeatMode,
  crossfadeDuration,
  gaplessEnabled,
  isCompact,
  currentTime,
  duration,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onToggleShuffle,
  onRepeatModeChange,
  onToggleFavorite,
  onToggleCompact,
  onSeek,
}: DeckPanelProps) {
  return (
    <section className="deck-panel">
      <div className="deck-visual" ref={visualizerContainerRef as React.RefObject<HTMLDivElement>}>
        <AudioVisualizer
          getVisualizerData={getVisualizerData}
          isActive={isVisualizerActive}
        />
      </div>

      <div className="deck-now">
        <PlayerControls
          currentTrack={currentTrack}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          isShuffled={isShuffled}
          repeatMode={repeatMode}
          crossfadeDuration={crossfadeDuration}
          gaplessEnabled={gaplessEnabled}
          isCompact={isCompact}
          onPlay={onPlay}
          onPause={onPause}
          onNext={onNext}
          onPrev={onPrev}
          onToggleShuffle={onToggleShuffle}
          onRepeatModeChange={onRepeatModeChange}
          onToggleFavorite={onToggleFavorite}
          onToggleCompact={onToggleCompact}
        />

        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
        />
      </div>
    </section>
  );
});
