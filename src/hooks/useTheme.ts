import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "llama-player-theme";

export type ThemeMode = "dark" | "light" | "winamp";

interface ThemeColors {
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  accentDim: string;
  highlight: string;
  text: string;
  textDim: string;
  border: string;
  progressBg: string;
  progressFill: string;
  shadow: string;
}

const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: "#1a1a2e",
    primary: "#2d2d4a",
    secondary: "#3a3a5c",
    accent: "#00ff88",
    accentDim: "#00aa55",
    highlight: "#ff6b9d",
    text: "#e0e0e0",
    textDim: "#8888aa",
    border: "#4a4a6a",
    progressBg: "#0d0d1a",
    progressFill: "linear-gradient(90deg, #00ff88, #00ccff)",
    shadow: "rgba(0, 0, 0, 0.6)",
  },
  light: {
    bg: "#f5f0eb",
    primary: "#e8e0d8",
    secondary: "#ddd5cc",
    accent: "#2d8a4e",
    accentDim: "#1a6b36",
    highlight: "#d6336c",
    text: "#2d2d2d",
    textDim: "#888888",
    border: "#c8c0b8",
    progressBg: "#e0d8d0",
    progressFill: "linear-gradient(90deg, #2d8a4e, #1a8a8a)",
    shadow: "rgba(0, 0, 0, 0.15)",
  },
  winamp: {
    bg: "#1a1a2e",
    primary: "#2d2d4a",
    secondary: "#3a3a5c",
    accent: "#00ff88",
    accentDim: "#00aa55",
    highlight: "#ff6b9d",
    text: "#e0e0e0",
    textDim: "#8888aa",
    border: "#4a4a6a",
    progressBg: "#0d0d1a",
    progressFill: "linear-gradient(90deg, #00ff88, #00ccff)",
    shadow: "rgba(0, 0, 0, 0.6)",
  },
};

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "dark" || stored === "light" || stored === "winamp")) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "winamp";
}

function applyTheme(mode: ThemeMode): void {
  const colors = THEMES[mode];
  const root = document.documentElement;
  root.style.setProperty("--winamp-bg", colors.bg);
  root.style.setProperty("--winamp-primary", colors.primary);
  root.style.setProperty("--winamp-secondary", colors.secondary);
  root.style.setProperty("--winamp-accent", colors.accent);
  root.style.setProperty("--winamp-accent-dim", colors.accentDim);
  root.style.setProperty("--winamp-highlight", colors.highlight);
  root.style.setProperty("--winamp-text", colors.text);
  root.style.setProperty("--winamp-text-dim", colors.textDim);
  root.style.setProperty("--winamp-border", colors.border);
  root.style.setProperty("--winamp-progress-bg", colors.progressBg);
  root.style.setProperty("--winamp-progress-fill", colors.progressFill);
  root.style.setProperty("--winamp-shadow", colors.shadow);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const modes: ThemeMode[] = ["winamp", "dark", "light"];
      const idx = modes.indexOf(prev);
      const next = modes[(idx + 1) % modes.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { theme, setTheme, cycleTheme, themeNames: THEMES };
}
