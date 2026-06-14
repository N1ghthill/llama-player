interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = "🎵 Llama Player v0.1" }: TitleBarProps) {
  return (
    <header className="title-bar">
      <div className="title-bar-text">{title}</div>
      <div className="title-bar-controls">
        <button className="minimize-btn" title="Minimizar">
          _
        </button>
        <button className="close-btn" title="Fechar">
          ✕
        </button>
      </div>
    </header>
  );
}
