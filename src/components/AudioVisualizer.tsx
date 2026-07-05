import { memo, useRef, useEffect, useState } from "react";

type VisualizerMode = "bars" | "waveform" | "equalizer";

interface AudioVisualizerProps {
  /** Callback que retorna os dados brutos do analisador (Uint8Array) */
  getVisualizerData: () => {
    frequencyData: Uint8Array;
    waveformData: Uint8Array;
  };
  isActive: boolean;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 120;
const BAR_COUNT = 64;

export const AudioVisualizer = memo(function AudioVisualizer({
  getVisualizerData,
  isActive,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [mode, setMode] = useState<VisualizerMode>("bars");

  // Desenha diretamente no canvas via RAF, sem depender de props de dados
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const draw = () => {
      if (!isActive) {
        // Flat line when inactive
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#00aa55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const { frequencyData, waveformData } = getVisualizerData();

      ctx.clearRect(0, 0, w, h);

      if (mode === "bars") {
        drawBars(ctx, w, h, frequencyData);
      } else if (mode === "waveform") {
        drawWaveform(ctx, w, h, waveformData);
      } else {
        drawEqualizer(ctx, w, h, frequencyData);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mode, isActive, getVisualizerData]);

  const toggleMode = () => {
    setMode((m) => {
      if (m === "bars") return "waveform";
      if (m === "waveform") return "equalizer";
      return "bars";
    });
  };

  const modeLabels: Record<VisualizerMode, string> = {
    bars: "📊 Barras",
    waveform: "〰️ Waveform",
    equalizer: "🎚 Equalizador",
  };

  const nextModeLabels: Record<VisualizerMode, string> = {
    bars: "Waveform",
    waveform: "Equalizador",
    equalizer: "Barras",
  };

  const modeIcons: Record<VisualizerMode, string> = {
    bars: "📊",
    waveform: "〰️",
    equalizer: "🎚",
  };

  return (
    <div className="audio-visualizer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="audio-visualizer-canvas"
      />
      <div className="audio-visualizer-controls">
        <span className="audio-visualizer-mode-label">{modeLabels[mode]}</span>
        <button
          className="audio-visualizer-toggle"
          onClick={toggleMode}
          title={`Alternar para ${nextModeLabels[mode]}`}
        >
          {modeIcons[mode === "bars" ? "waveform" : mode === "waveform" ? "equalizer" : "bars"]}
        </button>
      </div>
    </div>
  );
});

// --- Funções de desenho puras (sem dependências de estado React) ---

function drawBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frequencyData: Uint8Array
) {
  const step = Math.floor(frequencyData.length / BAR_COUNT);
  const barWidth = Math.floor(w / BAR_COUNT) - 1;
  const gradient = ctx.createLinearGradient(0, h, 0, 0);
  gradient.addColorStop(0, "#00ff88");
  gradient.addColorStop(1, "#00ccff");

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += frequencyData[i * step + j] || 0;
    }
    const avg = sum / step;
    const barHeight = Math.max(1, (avg / 255) * h);

    ctx.fillStyle = gradient;
    ctx.fillRect(i * (barWidth + 1), h - barHeight, barWidth, barHeight);
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  waveformData: Uint8Array
) {
  const step = Math.floor(waveformData.length / w);

  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let x = 0; x < w; x++) {
    const idx = Math.min(x * step, waveformData.length - 1);
    const val = waveformData[idx] / 128.0;
    const y = (val * h) / 2;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawEqualizer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frequencyData: Uint8Array
) {
  const bands = 10;
  const step = Math.floor(frequencyData.length / bands);
  const bandWidth = Math.floor(w / bands) - 2;
  const padding = 2;

  for (let i = 0; i < bands; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += frequencyData[i * step + j] || 0;
    }
    const avg = sum / step;
    const normalized = Math.min(1, avg / 200);
    const barHeight = Math.max(2, normalized * h * 0.85);

    const x = i * (bandWidth + padding) + padding;

    // Draw bar background (dark)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x, 0, bandWidth, h);

    // Draw bar fill with gradient
    const gradient = ctx.createLinearGradient(x, h, x, 0);
    gradient.addColorStop(0, "#00ff88");
    gradient.addColorStop(0.5, "#88ff00");
    gradient.addColorStop(1, "#ffcc00");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, h - barHeight, bandWidth, barHeight);

    // Draw frequency label
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    const labels = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
    ctx.fillText(labels[i] || "", x + bandWidth / 2, h - 2);
  }
}
