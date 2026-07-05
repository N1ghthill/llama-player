import { useState, useCallback, useEffect } from "react";
import { LOCAL_STORAGE_KEYS } from "../services/localData";

const STORAGE_KEY = LOCAL_STORAGE_KEYS.theme;

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
  appBorder: string;
  panelHeader: string;
  titlebar: string;
  surfaceHover: string;
  controlHover: string;
  controlHoverBorder: string;
  progressBg: string;
  progressFill: string;
  shadow: string;
}

const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: "#101114",
    primary: "#17191f",
    secondary: "#20242c",
    accent: "#21c16b",
    accentDim: "#169653",
    highlight: "#ef5a76",
    text: "#eceff3",
    textDim: "#939aa6",
    border: "#303641",
    appBorder: "rgba(255, 255, 255, 0.08)",
    panelHeader: "#1f242c",
    titlebar: "#15171c",
    surfaceHover: "rgba(255, 255, 255, 0.055)",
    controlHover: "#2a303a",
    controlHoverBorder: "#4a5361",
    progressBg: "#0a0b0e",
    progressFill: "linear-gradient(90deg, #21c16b 0%, #58d6ff 100%)",
    shadow: "rgba(0, 0, 0, 0.5)",
  },
  light: {
    bg: "#f6f7f9",
    primary: "#ffffff",
    secondary: "#eef1f5",
    accent: "#147d4d",
    accentDim: "#147d4d",
    highlight: "#c4365d",
    text: "#1d232b",
    textDim: "#66717f",
    border: "#d5dbe3",
    appBorder: "rgba(20, 28, 38, 0.14)",
    panelHeader: "#eef1f5",
    titlebar: "#edf1f5",
    surfaceHover: "rgba(20, 28, 38, 0.075)",
    controlHover: "#dde4eb",
    controlHoverBorder: "#bdc8d5",
    progressBg: "#e7ebf0",
    progressFill: "linear-gradient(90deg, #147d4d 0%, #1878a5 100%)",
    shadow: "rgba(18, 24, 32, 0.14)",
  },
  winamp: {
    bg: "#141217",
    primary: "#1e1b24",
    secondary: "#292631",
    accent: "#f1b84b",
    accentDim: "#c28723",
    highlight: "#ff6f91",
    text: "#f3f0e8",
    textDim: "#a9a1ad",
    border: "#393340",
    appBorder: "rgba(255, 255, 255, 0.08)",
    panelHeader: "#26222c",
    titlebar: "#17131b",
    surfaceHover: "rgba(255, 255, 255, 0.06)",
    controlHover: "#342f3d",
    controlHoverBorder: "#50475a",
    progressBg: "#0d0b10",
    progressFill: "linear-gradient(90deg, #f1b84b 0%, #39c1a0 100%)",
    shadow: "rgba(0, 0, 0, 0.55)",
  },
};

/**
 * Converte uma cor hex (#rrggbb) para rgba com alpha.
 * Ex: hexToRgba("#00aa55", 0.16) → "rgba(0, 170, 85, 0.16)"
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "dark" || stored === "light" || stored === "winamp")) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "dark";
}

function applyTheme(mode: ThemeMode): void {
  const colors = THEMES[mode];
  const root = document.documentElement;

  root.style.setProperty("--player-bg", colors.bg);
  root.style.setProperty("--panel-bg", colors.primary);
  root.style.setProperty("--panel-raised", colors.secondary);
  root.style.setProperty("--panel-sunken", colors.progressBg);
  root.style.setProperty("--text", colors.text);
  root.style.setProperty("--text-muted", colors.textDim);
  root.style.setProperty("--border", colors.border);
  root.style.setProperty("--app-border", colors.appBorder);
  root.style.setProperty("--panel-header", colors.panelHeader);
  root.style.setProperty("--titlebar-bg", colors.titlebar);
  root.style.setProperty("--surface-hover", colors.surfaceHover);
  root.style.setProperty("--control-hover", colors.controlHover);
  root.style.setProperty("--control-hover-border", colors.controlHoverBorder);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-soft", hexToRgba(colors.accentDim, 0.16));
  root.style.setProperty("--danger", colors.highlight);
  root.style.setProperty("--meter", colors.progressFill);
  root.style.setProperty("--shadow", colors.shadow);

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
      const modes: ThemeMode[] = ["dark", "light", "winamp"];
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
