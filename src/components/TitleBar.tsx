interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = `🎵 Llama Player v${__APP_VERSION__}` }: TitleBarProps) {
  const handleToggleMaximize = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  };

  const handleMinimize = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  };

  const handleClose = async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };

  return (
    <header
      className="title-bar"
      data-tauri-drag-region
      onDoubleClick={(event) => {
        if (event.target instanceof HTMLButtonElement) return;
        handleToggleMaximize();
      }}
    >
      <div className="title-bar-brand" data-tauri-drag-region>
        <span className="title-bar-mark" aria-hidden="true">🎵</span>
        <div className="title-bar-text" data-tauri-drag-region>
          {title.replace(/^🎵\s*/, "")}
        </div>
      </div>
      <div className="title-bar-controls">
        <button className="minimize-btn" title="Minimizar" aria-label="Minimizar" onClick={handleMinimize}>
          _
        </button>
        <button className="maximize-btn" title="Maximizar" aria-label="Maximizar" onClick={handleToggleMaximize}>
          □
        </button>
        <button className="close-btn" title="Fechar" aria-label="Fechar" onClick={handleClose}>
          ✕
        </button>
      </div>
    </header>
  );
}
