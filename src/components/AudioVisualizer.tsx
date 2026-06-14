import { useRef, useEffect, useState, useCallback } from "react";

type VisualizerMode = "bars" | "waveform" | "equalizer";

interface AudioVisualizerProps {
  frequencyData: number[];
  waveformData: number[];
  isActive: boolean;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 120;
const BAR_COUNT = 64;

export function AudioVisualizer({
  frequencyData,
  waveformData,
  isActive,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>("bars");
  const animFrameRef = useRef<number | null>(null);

  const drawBars = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        // Flat line when inactive
        ctx.strokeStyle = "#00aa55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      const data = frequencyData;
      const step = Math.floor(data.length / BAR_COUNT);
      const barWidth = Math.floor(w / BAR_COUNT) - 1;
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, "#00ff88");
      gradient.addColorStop(1, "#00ccff");

      for (let i = 0; i < BAR_COUNT; i++) {
        // Average a group of frequency bins
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += data[i * step + j] || 0;
        }
        const avg = sum / step;
        const barHeight = Math.max(1, (avg / 255) * h);

        ctx.fillStyle = gradient;
        ctx.fillRect(i * (barWidth + 1), h - barHeight, barWidth, barHeight);
      }
    },
    [frequencyData, isActive]
  );

  const drawEqualizer = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        ctx.strokeStyle = "#00aa55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      // Classic 10-band equalizer look
      const bands = 10;
      const data = frequencyData;
      const step = Math.floor(data.length / bands);
      const bandWidth = Math.floor(w / bands) - 2;
      const padding = 2;

      for (let i = 0; i < bands; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += data[i * step + j] || 0;
        }
        const avg = sum / step;
        // Normalize to 0..1 range
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
    },
    [frequencyData, isActive]
  );

  const drawWaveform = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        // Flat line when inactive
        ctx.strokeStyle = "#00aa55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      const data = waveformData;
      const step = Math.floor(data.length / w);

      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const idx = Math.min(x * step, data.length - 1);
        const val = data[idx] / 128.0; // 0..2 range, center at 1.0
        const y = (val * h) / 2;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    },
    [waveformData, isActive]
  );

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      if (mode === "bars") {
        drawBars(ctx);
      } else if (mode === "waveform") {
        drawWaveform(ctx);
      } else {
        drawEqualizer(ctx);
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [mode, drawBars, drawWaveform]);

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

  const modeIcons: Record<VisualizerMode, string> = {
    bars: "📊",
    waveform: "〰️",
    equalizer: "🎚",
  };

  const nextModeLabels: Record<VisualizerMode, string> = {
    bars: "Waveform",
    waveform: "Equalizador",
    equalizer: "Barras",
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
}
