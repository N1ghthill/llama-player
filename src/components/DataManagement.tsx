import { useCallback, useEffect, useState } from "react";
import {
  clearAllLocalData,
  clearLocalPreferences,
  getLocalDataSummary,
  getTotalLocalDataBytes,
  type LocalDataSummary,
} from "../services/localData";
import { clearAudioCache, getCacheStats, formatCacheSize } from "../services/audioCache";

interface DataManagementProps {
  version: string;
  onClose: () => void;
}

export function DataManagement({ version, onClose }: DataManagementProps) {
  const [items, setItems] = useState<LocalDataSummary[]>([]);
  const [cacheSize, setCacheSize] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    const summary = getLocalDataSummary();
    const [cache, totals] = await Promise.all([
      getCacheStats(),
      getTotalLocalDataBytes(),
    ]);

    setItems(summary);
    setCacheSize(cache.totalSize);
    setTotalSize(totals.localStorageBytes + totals.cacheBytes);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClearCache = useCallback(async () => {
    const confirmed = window.confirm("Limpar cache de audio?");
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await clearAudioCache();
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  const handleClearPreferences = useCallback(async () => {
    const confirmed = window.confirm("Limpar favoritos, historico, playlists e tema?");
    if (!confirmed) return;

    clearLocalPreferences();
    window.location.reload();
  }, []);

  const handleClearAll = useCallback(async () => {
    const confirmed = window.confirm("Limpar todos os dados locais do Llama Player?");
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await clearAllLocalData();
      window.location.reload();
    } finally {
      setIsBusy(false);
    }
  }, []);

  return (
    <section className="data-panel">
      <header className="panel-header">
        <span>DADOS LOCAIS</span>
        <button
          className="playlist-manager-close"
          type="button"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar dados locais"
        >
          x
        </button>
      </header>

      <div className="data-panel-body">
        <div className="data-version-row">
          <span>Versao</span>
          <strong>{version}</strong>
        </div>

        <div className="data-total-row">
          <span>Total local</span>
          <strong>{formatCacheSize(totalSize)}</strong>
        </div>

        <ul className="data-list">
          {items.map((item) => (
            <li key={item.key} className="data-list-item">
              <span>{item.label}</span>
              <span>{item.exists ? formatCacheSize(item.bytes) : "vazio"}</span>
            </li>
          ))}
          <li className="data-list-item">
            <span>Cache de audio</span>
            <span>{formatCacheSize(cacheSize)}</span>
          </li>
        </ul>

        <div className="data-actions">
          <button
            className="playlist-manager-btn"
            type="button"
            onClick={handleClearCache}
            disabled={isBusy}
          >
            Limpar cache
          </button>
          <button
            className="playlist-manager-btn playlist-manager-btn-cancel"
            type="button"
            onClick={handleClearPreferences}
            disabled={isBusy}
          >
            Limpar preferencias
          </button>
          <button
            className="playlist-manager-btn data-danger-btn"
            type="button"
            onClick={handleClearAll}
            disabled={isBusy}
          >
            Limpar tudo
          </button>
        </div>
      </div>
    </section>
  );
}
