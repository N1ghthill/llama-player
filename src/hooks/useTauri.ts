/**
 * 🦙 Llama Player — useTauri Hook
 *
 * Hook React para acessar funcionalidades nativas do Tauri:
 * - File picker nativo para abrir arquivos de áudio
 * - Notificações do sistema
 * - Atalhos de teclado globais
 * - Informações do sistema
 */

import { useState, useCallback, useEffect, useRef } from "react";

// Detecta se está rodando dentro do Tauri
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export interface TauriState {
  isTauri: boolean;
  isReady: boolean;
  musicDir: string | null;
  systemInfo: Record<string, string> | null;
}

/**
 * Hook para funcionalidades nativas do Tauri.
 * Fornece fallback para navegador quando não está em ambiente Tauri.
 */
export function useTauri() {
  const [state, setState] = useState<TauriState>({
    isTauri: isTauri(),
    isReady: false,
    musicDir: null,
    systemInfo: null,
  });
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isTauri()) return;

    const init = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        const [musicDir, systemInfo] = await Promise.all([
          invoke<string>("get_music_dir").catch(() => null),
          invoke<Record<string, string>>("get_system_info").catch(() => null),
        ]);

        setState({
          isTauri: true,
          isReady: true,
          musicDir,
          systemInfo,
        });
      } catch (err) {
        console.warn("[Llama Player] Erro ao inicializar Tauri:", err);
        setState((prev) => ({ ...prev, isReady: true }));
      }
    };

    init();
  }, []);

  /**
   * Abre o file picker nativo do sistema para selecionar arquivos de áudio.
   * Retorna os caminhos dos arquivos selecionados.
   */
  const openFilePicker = useCallback(async (): Promise<string[] | null> => {
    if (!isTauri()) {
      // Fallback: dispara input file HTML (para desenvolvimento web)
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.multiple = true;
        input.onchange = () => {
          if (input.files) {
            const paths = Array.from(input.files).map((f) => f.name);
            resolve(paths);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");

      const selected = await dialog.open({
        multiple: true,
        filters: [
          {
            name: "Áudio",
            extensions: [
              "mp3",
              "wav",
              "flac",
              "ogg",
              "aac",
              "m4a",
              "wma",
              "opus",
            ],
          },
        ],
      });

      if (!selected) return null;

      const paths = Array.isArray(selected) ? selected : [selected];
      return paths;
    } catch (err) {
      console.error("[Llama Player] Erro no file picker nativo:", err);
      return null;
    }
  }, []);

  /**
   * Abre o seletor de pasta nativo e varre recursivamente por arquivos de áudio.
   * Retorna os caminhos dos arquivos encontrados.
   */
  const openFolderPicker = useCallback(async (): Promise<string[] | null> => {
    if (!isTauri()) {
      // Fallback: input file HTML com webkitdirectory
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.accept = "audio/*";
        input.onchange = () => {
          if (input.files) {
            const paths = Array.from(input.files).map((f) => f.name);
            resolve(paths);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }

    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const selected = await dialog.open({
        multiple: false,
        directory: true,
        title: "Selecionar pasta de músicas",
      });

      if (!selected) return null;

      const dirPath = Array.isArray(selected) ? selected[0] : selected;
      if (!dirPath) return null;

      const files = await invoke<string[]>("scan_audio_dir", { path: dirPath });
      return files;
    } catch (err) {
      console.error("[Llama Player] Erro ao abrir pasta:", err);
      return null;
    }
  }, []);

  /**
   * Converte um caminho de arquivo local para URL acessível pelo frontend.
   */
  const filePathToUrl = useCallback(async (path: string): Promise<string> => {
    if (!isTauri()) return path;

    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(path);
    } catch {
      return path;
    }
  }, []);

  /**
   * Envia uma notificação do sistema.
   */
  const sendNotification = useCallback(
    async (title: string, body?: string) => {
      if (!isTauri()) {
        // Fallback: Notification API do navegador
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body });
        } else if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            new Notification(title, { body });
          }
        }
        return;
      }

      try {
        const notification = await import("@tauri-apps/plugin-notification");
        notification.sendNotification({ title, body });
      } catch (err) {
        console.warn("[Llama Player] Erro ao enviar notificação:", err);
      }
    },
    []
  );

  /**
   * Registra atalhos de teclado globais.
   * Retorna função de cleanup.
   */
  const registerShortcuts = useCallback(
    async (
      shortcuts: Record<string, () => void>
    ): Promise<() => void> => {
      if (!isTauri()) {
        // Fallback: atalhos locais (keydown)
        const handler = (e: KeyboardEvent) => {
          // Media keys
          if (e.code === "MediaPlayPause") shortcuts["MediaPlayPause"]?.();
          if (e.code === "MediaNextTrack") shortcuts["MediaNextTrack"]?.();
          if (e.code === "MediaPrevTrack") shortcuts["MediaPrevTrack"]?.();
          if (e.code === "MediaStop") shortcuts["MediaStop"]?.();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
      }

      try {
        const shortcutPlugin = await import("@tauri-apps/plugin-global-shortcut");

        const registrations = Object.entries(shortcuts).map(
          ([shortcut, handler]) =>
            shortcutPlugin.register(shortcut, () => handler()).catch((err: any) =>
              console.warn(
                `[Llama Player] Erro ao registrar atalho ${shortcut}:`,
                err
              )
            )
        );

        await Promise.all(registrations);

        return async () => {
          await Promise.all(
            Object.keys(shortcuts).map((s) =>
              shortcutPlugin.unregister(s).catch(() => {})
            )
          );
        };
      } catch (err) {
        console.warn("[Llama Player] Erro ao registrar atalhos:", err);
        return () => {};
      }
    },
    []
  );

  /**
   * Abre uma URL no navegador padrão do sistema.
   */
  const openUrl = useCallback(async (url: string) => {
    if (!isSafeExternalUrl(url)) {
      console.warn("[Llama Player] URL externa bloqueada:", url);
      return;
    }

    if (!isTauri()) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const shell = await import("@tauri-apps/plugin-shell");
      await shell.open(url);
    } catch (err) {
      console.warn("[Llama Player] Erro ao abrir URL:", err);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  return {
    state,
    openFilePicker,
    openFolderPicker,
    filePathToUrl,
    sendNotification,
    registerShortcuts,
    openUrl,
    isTauri: isTauri(),
  };
}
