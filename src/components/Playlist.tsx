import { memo, useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { Track } from "../types";

type SortField = "title" | "artist" | "duration";
type SortDirection = "asc" | "desc";

interface PlaylistProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onReorderPlaylist?: (tracks: Track[]) => void;
  onDropFiles?: (files: FileList) => void;
  onToggleFavorite?: (trackId: string) => void;
}

const ITEM_HEIGHT = 32; // px
const OVERSCAN = 5; // render extra items above/below viewport
const VIRTUALIZATION_THRESHOLD = 100; // only virtualize above this many items

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSortValue(track: Track, field: SortField): string {
  switch (field) {
    case "title":
      return normalizeText(track.title);
    case "artist":
      return normalizeText(track.artist ?? "");
    case "duration":
      return String(track.duration).padStart(10, "0");
  }
}

interface TrackItemProps {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  isDragOver: boolean;
  filteredIndex: number;
  shouldVirtualize: boolean;
  onSelect: (track: Track) => void;
  onToggleFavorite?: (trackId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLLIElement>, filteredIndex: number) => void;
  onDragEnd: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLLIElement>, filteredIndex: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>, dropFilteredIndex: number) => void;
}

const TrackItem = memo(function TrackItem({
  track,
  isActive,
  isPlaying,
  isDragOver,
  filteredIndex,
  shouldVirtualize,
  onSelect,
  onToggleFavorite,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: TrackItemProps) {
  return (
    <li
      key={track.id}
      className={`playlist-item ${
        isActive ? "active" : ""
      } ${isDragOver ? "drag-over" : ""}`}
      draggable
      onClick={() => onSelect(track)}
      onDragStart={(e) => onDragStart(e, filteredIndex)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, filteredIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, filteredIndex)}
      title={`${track.title}${track.artist ? ` — ${track.artist}` : ""}`}
      style={shouldVirtualize ? { position: "absolute", top: filteredIndex * ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT } : undefined}
    >
      <span className="playlist-item-drag-handle" title="Arrastar para reordenar">
        ⠿
      </span>
      {onToggleFavorite && (
        <span
          className={`playlist-item-favorite ${track.isFavorite ? "favorite-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(track.id);
          }}
          title={track.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {track.isFavorite ? "♥" : "♡"}
        </span>
      )}
      <span className="playlist-item-icon">
        {isActive && isPlaying ? "▶" : "🎵"}
      </span>
      <span className="playlist-item-title">{track.title}</span>
      {track.artist && (
        <span className="playlist-item-artist">{track.artist}</span>
      )}
      <span className="playlist-item-duration">
        {formatDuration(track.duration)}
      </span>
    </li>
  );
});

export function Playlist({
  tracks,
  currentTrackId,
  isPlaying,
  onSelectTrack,
  onReorderPlaylist,
  onDropFiles,
  onToggleFavorite,
}: PlaylistProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemIndex = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterArtist, setFilterArtist] = useState<string | null>(null);
  const [filterAlbum, setFilterAlbum] = useState<string | null>(null);

  // Virtual scrolling state
  const scrollContainerRef = useRef<HTMLUListElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  // Filtro de busca (memoizado para não recalcular em todo render)
  const normalizedQuery = useMemo(() => normalizeText(searchQuery), [searchQuery]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        const newDirection = sortDirection === "asc" ? "desc" : "asc";
        setSortDirection(newDirection);
        const sorted = [...tracks].sort((a, b) => {
          const aVal = getSortValue(a, field);
          const bVal = getSortValue(b, field);
          const cmp = aVal.localeCompare(bVal);
          return newDirection === "asc" ? cmp : -cmp;
        });
        onReorderPlaylist?.(sorted);
      } else {
        setSortField(field);
        setSortDirection("asc");
        const sorted = [...tracks].sort((a, b) => {
          const aVal = getSortValue(a, field);
          const bVal = getSortValue(b, field);
          return aVal.localeCompare(bVal);
        });
        onReorderPlaylist?.(sorted);
      }
    },
    [tracks, sortField, sortDirection, onReorderPlaylist]
  );

  // Extrai artistas e álbuns únicos para os filtros
  const uniqueArtists = useMemo(() => {
    const artists = new Set<string>();
    tracks.forEach((t) => { if (t.artist) artists.add(t.artist); });
    return Array.from(artists).sort();
  }, [tracks]);

  const uniqueAlbums = useMemo(() => {
    const albums = new Set<string>();
    tracks.forEach((t) => { if (t.album) albums.add(t.album); });
    return Array.from(albums).sort();
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    let result = tracks;

    // Filtro textual
    if (normalizedQuery) {
      result = result.filter((track) => {
        const title = normalizeText(track.title);
        const artist = track.artist ? normalizeText(track.artist) : "";
        return title.includes(normalizedQuery) || artist.includes(normalizedQuery);
      });
    }

    // Filtro por artista
    if (filterArtist) {
      result = result.filter((track) => track.artist === filterArtist);
    }

    // Filtro por álbum
    if (filterAlbum) {
      result = result.filter((track) => track.album === filterAlbum);
    }

    return result;
  }, [tracks, normalizedQuery, filterArtist, filterAlbum]);

  const filteredToOriginalIndex = useMemo(() => {
    if (!normalizedQuery) return null;
    return filteredTracks.map((ft) => tracks.indexOf(ft));
  }, [filteredTracks, tracks, normalizedQuery]);

  // Virtual scrolling calculations
  const shouldVirtualize = filteredTracks.length > VIRTUALIZATION_THRESHOLD;
  const totalHeight = useMemo(
    () => filteredTracks.length * ITEM_HEIGHT,
    [filteredTracks.length]
  );

  const visibleRange = useMemo(() => {
    if (!shouldVirtualize) {
      return { start: 0, end: filteredTracks.length };
    }
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const end = Math.min(
      filteredTracks.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
    );
    return { start, end };
  }, [shouldVirtualize, scrollTop, containerHeight, filteredTracks.length]);

  const visibleTracks = useMemo(() => {
    return filteredTracks.slice(visibleRange.start, visibleRange.end);
  }, [filteredTracks, visibleRange.start, visibleRange.end]);

  // Duração total da playlist (memoizada para evitar reduce duplicado)
  const totalDuration = useMemo(
    () => tracks.reduce((acc, t) => acc + t.duration, 0),
    [tracks]
  );

  // Measure container height on mount and resize (com throttle via RAF)
  const rafResizeRef = useRef<number | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (rafResizeRef.current !== null) {
          cancelAnimationFrame(rafResizeRef.current);
        }
        rafResizeRef.current = requestAnimationFrame(() => {
          setContainerHeight(entry.contentRect.height);
          rafResizeRef.current = null;
        });
      }
    });

    observer.observe(container);
    setContainerHeight(container.clientHeight || 400);

    return () => {
      observer.disconnect();
      if (rafResizeRef.current !== null) {
        cancelAnimationFrame(rafResizeRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setScrollTop(container.scrollTop);
    }
  }, []);

  // Scroll to current track when it changes
  useEffect(() => {
    if (!currentTrackId || !shouldVirtualize) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const idx = filteredTracks.findIndex((t) => t.id === currentTrackId);
    if (idx === -1) return;

    const itemTop = idx * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;

    if (itemTop < scrollTop || itemBottom > scrollTop + containerHeight) {
      container.scrollTop = itemTop - containerHeight / 2 + ITEM_HEIGHT / 2;
    }
  }, [currentTrackId, filteredTracks, shouldVirtualize, scrollTop, containerHeight]);

  // Drag & drop de arquivos do sistema
  const handleDragOverWindow = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeaveWindow = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDropWindow = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDropFiles?.(e.dataTransfer.files);
      }
    },
    [onDropFiles]
  );

  const resolveOriginalIndex = useCallback(
    (filteredIndex: number): number => {
      if (filteredToOriginalIndex) {
        return filteredToOriginalIndex[filteredIndex];
      }
      return filteredIndex;
    },
    [filteredToOriginalIndex]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLLIElement>, filteredIndex: number) => {
      const originalIndex = resolveOriginalIndex(filteredIndex);
      dragItemIndex.current = originalIndex;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(originalIndex));
      e.currentTarget.classList.add("dragging");
    },
    [resolveOriginalIndex]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent<HTMLLIElement>) => {
      e.currentTarget.classList.remove("dragging");
      dragItemIndex.current = null;
      setDragOverIndex(null);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLLIElement>, filteredIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(filteredIndex);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLIElement>, dropFilteredIndex: number) => {
      e.preventDefault();
      const fromIndex = dragItemIndex.current;
      const dropIndex = resolveOriginalIndex(dropFilteredIndex);
      if (fromIndex === null || fromIndex === dropIndex) {
        setDragOverIndex(null);
        return;
      }

      const reordered = [...tracks];
      const [movedItem] = reordered.splice(fromIndex, 1);
      reordered.splice(dropIndex, 0, movedItem);

      onReorderPlaylist?.(reordered);
      dragItemIndex.current = null;
      setDragOverIndex(null);
    },
    [tracks, onReorderPlaylist, resolveOriginalIndex]
  );

  const renderTrackItem = useCallback(
    (track: Track, displayIndex: number) => {
      const filteredIndex = shouldVirtualize
        ? visibleRange.start + displayIndex
        : displayIndex;

      return (
        <TrackItem
          key={track.id}
          track={track}
          isActive={track.id === currentTrackId}
          isPlaying={isPlaying}
          isDragOver={dragOverIndex === filteredIndex}
          filteredIndex={filteredIndex}
          shouldVirtualize={shouldVirtualize}
          onSelect={onSelectTrack}
          onToggleFavorite={onToggleFavorite}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      );
    },
    [
      currentTrackId, isPlaying, dragOverIndex, onSelectTrack,
      handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop,
      onToggleFavorite, shouldVirtualize, visibleRange.start,
    ]
  );

  return (
    <section
      className={`playlist-panel ${isDragOver ? "playlist-drag-over" : ""}`}
      onDragOver={handleDragOverWindow}
      onDragLeave={handleDragLeaveWindow}
      onDrop={handleDropWindow}
    >
      <div className="panel-header">PLAYLIST</div>
      {isDragOver && (
        <div className="playlist-drop-indicator">
          📁 Solte os arquivos para adicionar à playlist
        </div>
      )}
      <div className="playlist-search-container">
        <input
          type="text"
          className="playlist-search-input"
          placeholder="Buscar música..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Buscar música na playlist"
        />
        {searchQuery && (
          <button
            className="playlist-search-clear"
            onClick={() => setSearchQuery("")}
            title="Limpar busca"
            aria-label="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>
      {searchQuery && (
        <div className="playlist-search-count">
          {filteredTracks.length === 0
            ? "Nenhuma música encontrada"
            : `${filteredTracks.length} de ${tracks.length} música${tracks.length !== 1 ? "s" : ""}`}
        </div>
      )}
      <div className="playlist-filter-bar">
        {uniqueArtists.length > 0 && (
          <select
            className="playlist-filter-select"
            value={filterArtist ?? ""}
            onChange={(e) => setFilterArtist(e.target.value || null)}
            aria-label="Filtrar por artista"
          >
            <option value="">Todos os artistas</option>
            {uniqueArtists.map((artist) => (
              <option key={artist} value={artist}>{artist}</option>
            ))}
          </select>
        )}
        {uniqueAlbums.length > 0 && (
          <select
            className="playlist-filter-select"
            value={filterAlbum ?? ""}
            onChange={(e) => setFilterAlbum(e.target.value || null)}
            aria-label="Filtrar por álbum"
          >
            <option value="">Todos os álbuns</option>
            {uniqueAlbums.map((album) => (
              <option key={album} value={album}>{album}</option>
            ))}
          </select>
        )}
        {(filterArtist || filterAlbum) && (
          <button
            className="playlist-filter-clear"
            onClick={() => { setFilterArtist(null); setFilterAlbum(null); }}
            title="Limpar filtros"
            aria-label="Limpar filtros"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>
      <div className="playlist-sort-bar">
        <button
          className={`playlist-sort-btn ${sortField === "title" ? "active" : ""}`}
          onClick={() => handleSort("title")}
          title={`Ordenar por nome${sortField === "title" ? (sortDirection === "asc" ? " (A-Z)" : " (Z-A)") : ""}`}
        >
          Nome {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
        </button>
        <button
          className={`playlist-sort-btn ${sortField === "artist" ? "active" : ""}`}
          onClick={() => handleSort("artist")}
          title={`Ordenar por artista${sortField === "artist" ? (sortDirection === "asc" ? " (A-Z)" : " (Z-A)") : ""}`}
        >
          Artista {sortField === "artist" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
        </button>
        <button
          className={`playlist-sort-btn ${sortField === "duration" ? "active" : ""}`}
          onClick={() => handleSort("duration")}
          title={`Ordenar por duração${sortField === "duration" ? (sortDirection === "asc" ? " (menor)" : " (maior)") : ""}`}
        >
          Duração {sortField === "duration" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
        </button>
      </div>
      <ul
        className="playlist"
        ref={scrollContainerRef}
        onScroll={shouldVirtualize ? handleScroll : undefined}
        style={shouldVirtualize ? { position: "relative", overflowY: "auto", height: "100%", maxHeight: "400px" } : undefined}
      >
        {tracks.length === 0 ? (
          <li className="playlist-item playlist-empty">
            Nenhuma música na playlist
          </li>
        ) : filteredTracks.length === 0 ? (
          <li className="playlist-item playlist-empty">
            Nenhuma música encontrada
          </li>
        ) : shouldVirtualize ? (
          <>
            <div style={{ height: totalHeight, position: "relative" }}>
              {visibleTracks.map((track, i) => renderTrackItem(track, i))}
            </div>
            {filteredTracks.length > 500 && (
              <div className="playlist-virtual-info">
                {filteredTracks.length} músicas · virtual scrolling ativo
              </div>
            )}
          </>
        ) : (
          filteredTracks.map((track, filteredIndex) =>
            renderTrackItem(track, filteredIndex)
          )
        )}
      </ul>
      <div className="panel-footer">
        <span>{tracks.length} música{tracks.length !== 1 ? "s" : ""}</span>
        <span>
          {totalDuration > 0
            ? formatDuration(totalDuration)
            : "—:—:—"}
        </span>
      </div>
    </section>
  );
}
