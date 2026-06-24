interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = "🎵 Llama Player v0.1" }: TitleBarProps) {
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
    <header className="title-bar">
      <div className="title-bar-text">{title}</div>
      <div className="title-bar-controls">
        <button className="minimize-btn" title="Minimizar" onClick={handleMinimize}>
          _
        </button>
        <button className="close-btn" title="Fechar" onClick={handleClose}>
          ✕
        </button>
      </div>
    </header>
  );
}
