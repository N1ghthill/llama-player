import { memo } from "react";

interface MixerPanelProps {
  volume: number;
  crossfadeDuration: number;
  gaplessEnabled: boolean;
  isPlaying: boolean;
  onVolumeChange: (volume: number) => void;
  onCrossfadeChange: (duration: number) => void;
  onToggleGapless: () => void;
}

export const MixerPanel = memo(function MixerPanel({
  volume,
  crossfadeDuration,
  gaplessEnabled,
  isPlaying,
  onVolumeChange,
  onCrossfadeChange,
  onToggleGapless,
}: MixerPanelProps) {
  return (
    <section className="mixer-panel">
      <div className="panel-header">
        <span>LLAMA MIXER</span>
        <span className="panel-header-status">{isPlaying ? "ON AIR" : "STANDBY"}</span>
      </div>
      <div className="mixer-body">
        <label className="mixer-control">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            title={`Volume: ${volume}%`}
          />
          <strong>{volume}%</strong>
        </label>
        <label className="mixer-control">
          <span>Crossfade</span>
          <input
            type="range"
            min={0}
            max={15}
            step={1}
            value={crossfadeDuration}
            onChange={(e) => onCrossfadeChange(Number(e.target.value))}
            title={`Crossfade: ${crossfadeDuration > 0 ? `${crossfadeDuration} segundos` : "Desativado"}`}
          />
          <strong>{crossfadeDuration > 0 ? `${crossfadeDuration}s` : "OFF"}</strong>
        </label>
        <button
          className={`gapless-pill ${gaplessEnabled ? "active" : ""}`}
          onClick={onToggleGapless}
          disabled={crossfadeDuration > 0}
          title={
            crossfadeDuration > 0
              ? "Desative o crossfade para usar gapless"
              : "Alternar gapless"
          }
        >
          Gapless {gaplessEnabled ? "ON" : "OFF"}
        </button>
      </div>
    </section>
  );
});
