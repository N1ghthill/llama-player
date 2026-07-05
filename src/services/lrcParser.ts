/**
 * 🦙 Llama Player — Parser de Letras Sincronizadas (LRC)
 *
 * Formato LRC:
 * [mm:ss.xx]linha de letra
 * [mm:ss.xx]linha de letra
 * ...
 *
 * Suporta:
 * - Timestamps no formato [mm:ss.xx] e [mm:ss.xxx]
 * - Múltiplos timestamps na mesma linha: [00:01.00][00:15.00]repetição
 * - Metadados: [ti:Título], [ar:Artista], [al:Álbum], [by:Autor], [offset:+/-ms]
 */

export interface LRCLine {
  time: number; // seconds
  text: string;
}

export interface LRCMetadata {
  title?: string;
  artist?: string;
  album?: string;
  author?: string;
  offset?: number; // ms offset to apply to all timestamps
}

export interface LRCData {
  metadata: LRCMetadata;
  lines: LRCLine[];
}

/**
 * Parseia uma string no formato LRC e retorna dados estruturados.
 */
export function parseLRC(lrcText: string): LRCData {
  const metadata: LRCMetadata = {};
  const lines: LRCLine[] = [];

  const metaRegex = /^\[(ti|ar|al|by|offset):(.*)\]$/i;

  for (const rawLine of lrcText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for metadata
    const metaMatch = line.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      switch (key) {
        case "ti": metadata.title = value; break;
        case "ar": metadata.artist = value; break;
        case "al": metadata.album = value; break;
        case "by": metadata.author = value; break;
        case "offset": metadata.offset = parseInt(value, 10) || 0; break;
      }
      continue;
    }

    // Check for timed lines
    // Handle multiple timestamps: [00:01.00][00:15.00]text
    const tsRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;
    const timestamps: number[] = [];
    let lastIndex = 0;
    let tsMatch;

    while ((tsMatch = tsRegex.exec(line)) !== null) {
      const minutes = parseInt(tsMatch[1], 10);
      const seconds = parseInt(tsMatch[2], 10);
      const centiseconds = parseInt(tsMatch[3], 10);
      // If 3 digits, it's milliseconds; if 2, it's centiseconds
      const time = minutes * 60 + seconds + (tsMatch[3].length === 3 ? centiseconds / 1000 : centiseconds / 100);
      timestamps.push(time);
      lastIndex = tsMatch.index + tsMatch[0].length;
    }

    if (timestamps.length > 0) {
      const text = line.slice(lastIndex).trim();
      for (const time of timestamps) {
        lines.push({ time, text });
      }
    }
  }

  // Sort by time
  lines.sort((a, b) => a.time - b.time);

  return { metadata, lines };
}

/**
 * Encontra a linha de letra ativa para um dado tempo.
 * Retorna o índice da linha atual e a próxima linha (para progresso).
 */
export function getCurrentLyricLine(
  lines: LRCLine[],
  currentTime: number,
  offset: number = 0
): { currentIndex: number; currentLine: LRCLine | null; nextLine: LRCLine | null; progress: number } {
  const adjustedTime = currentTime + offset / 1000;

  if (lines.length === 0) {
    return { currentIndex: -1, currentLine: null, nextLine: null, progress: 0 };
  }

  // Find the last line whose time <= adjustedTime
  let currentIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= adjustedTime) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const currentLine = currentIndex >= 0 ? lines[currentIndex] : null;
  const nextLine = currentIndex + 1 < lines.length ? lines[currentIndex + 1] : null;

  // Calculate progress between current and next line
  let progress = 0;
  if (currentLine && nextLine && nextLine.time > currentLine.time) {
    progress = Math.min(1, Math.max(0, (adjustedTime - currentLine.time) / (nextLine.time - currentLine.time)));
  } else if (currentLine && !nextLine) {
    progress = 1;
  }

  return { currentIndex, currentLine, nextLine, progress };
}
