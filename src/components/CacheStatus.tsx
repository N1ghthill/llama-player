import { useState, useEffect, useCallback } from "react";
import { getCacheStats, clearAudioCache, formatCacheSize } from "../services/audioCache";

export function CacheStatus() {
  const [stats, setStats] = useState<{ count: number; totalSize: number; maxSize: number } | null>(null);
  const [show, setShow] = useState(false);

  const refreshStats = useCallback(async () => {
    const s = await getCacheStats();
    setStats(s);
  }, []);

  useEffect(() => {
    if (show) {
      refreshStats();
    }
  }, [show, refreshStats]);

  const handleClear = async () => {
    await clearAudioCache();
    await refreshStats();
  };

  if (!show) {
    return (
      <button
        className="cache-status-toggle"
        onClick={() => setShow(true)}
        title="Cache de áudio"
        aria-label="Mostrar cache de áudio"
      >
        💾
      </button>
    );
  }

  return (
    <div className="cache-status">
      <div className="cache-status-info">
        <span className="cache-status-label">Cache:</span>
        {stats ? (
          <>
            <span className="cache-status-count">{stats.count} arquivos</span>
            <span className="cache-status-size">
              {formatCacheSize(stats.totalSize)} / {formatCacheSize(stats.maxSize)}
            </span>
          </>
        ) : (
          <span className="cache-status-loading">carregando...</span>
        )}
      </div>
      <div className="cache-status-actions">
        <button
          className="cache-status-btn"
          onClick={refreshStats}
          title="Atualizar"
          aria-label="Atualizar estatísticas do cache"
        >
          🔄
        </button>
        <button
          className="cache-status-btn cache-status-btn-clear"
          onClick={handleClear}
          title="Limpar cache"
          aria-label="Limpar cache de áudio"
        >
          🗑
        </button>
        <button
          className="cache-status-btn"
          onClick={() => setShow(false)}
          title="Fechar"
          aria-label="Fechar cache"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
