import { useCallback, useRef } from "react";
import jsmediatags from "jsmediatags";
import type { Track } from "../types";

export interface MetadataResult {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  duration: number;
}

const BATCH_SIZE = 5;
const INITIAL_PRIORITY_COUNT = 10;

/**
 * Hook para extrair metadados (ID3 tags) de arquivos de áudio.
 * Usa lazy loading: processa em lotes para não travar a UI.
 */
export function useMetadata() {
  const coverUrlsRef = useRef<Map<string, string>>(new Map());

  /**
   * Extrai metadados de um arquivo de áudio.
   * Retorna um objeto com title, artist, album, coverUrl e duration.
   */
  const extractMetadata = useCallback(
    (file: File): Promise<MetadataResult> => {
      return new Promise((resolve) => {
        // Fallback: usar nome do arquivo se não conseguir ler tags
        const fallback: MetadataResult = {
          title: file.name.replace(/\.[^/.]+$/, ""),
          duration: 0,
        };

        // Só tenta ler tags para formatos suportados
        const supportedTypes = ["audio/mpeg", "audio/mp3", "audio/flac", "audio/ogg", "audio/wav"];
        if (!supportedTypes.includes(file.type)) {
          resolve(fallback);
          return;
        }

        jsmediatags.read(file, {
          onSuccess: (data) => {
            const tags = data.tags;
            let coverUrl: string | undefined;

            // Converte a capa do álbum (se existir) para data URL
            if (tags.picture) {
              const { data: pictureData, format } = tags.picture;
              const base64 = arrayBufferToBase64(pictureData);
              const mimeType = format || "image/jpeg";
              coverUrl = `data:${mimeType};base64,${base64}`;

              // Armazena para evitar recriação
              const key = file.name + file.size;
              coverUrlsRef.current.set(key, coverUrl);
            }

            resolve({
              title: tags.title || fallback.title,
              artist: tags.artist,
              album: tags.album,
              coverUrl,
              duration: tags.duration ?? 0,
            });
          },
          onError: () => {
            // Se falhar, usa o fallback
            resolve(fallback);
          },
        });
      });
    },
    []
  );

  /**
   * Processa uma lista de arquivos com lazy loading (batches).
   *
   * Os primeiros INITIAL_PRIORITY_COUNT arquivos são processados imediatamente
   * para que o usuário veja resultados rápido. O restante é processado em lotes
   * de BATCH_SIZE com yields (setTimeout 0) para não travar a UI.
   *
   * @param files - Lista de arquivos de áudio
   * @param onProgress - Callback opcional para reportar progresso { processed, total }
   */
  const processFiles = useCallback(
    async (
      files: File[],
      onProgress?: (progress: { processed: number; total: number }) => void
    ): Promise<Track[]> => {
      const tracks: Track[] = [];
      const objectUrls: string[] = [];
      const now = Date.now();

      const processOne = async (i: number): Promise<Track> => {
        const file = files[i];
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        const metadata = await extractMetadata(file);

        return {
          id: `local-${now}-${i}`,
          title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration,
          coverUrl: metadata.coverUrl,
          src: url,
        };
      };

      // Fase 1: Processa os primeiros N arquivos imediatamente (prioridade)
      const priorityCount = Math.min(INITIAL_PRIORITY_COUNT, files.length);
      for (let i = 0; i < priorityCount; i++) {
        const track = await processOne(i);
        tracks.push(track);
        onProgress?.({ processed: i + 1, total: files.length });
      }

      // Fase 2: Processa o restante em lotes, cedendo a thread para a UI
      for (let i = priorityCount; i < files.length; i += BATCH_SIZE) {
        // Yield para a UI poder renderizar
        await new Promise((resolve) => setTimeout(resolve, 0));

        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((_, batchIndex) => processOne(i + batchIndex))
        );
        tracks.push(...batchResults);

        onProgress?.({ processed: Math.min(i + BATCH_SIZE, files.length), total: files.length });
      }

      // Revoga URLs temporárias — o áudio já foi carregado no estado do player
      // Nota: as URLs ainda podem estar sendo usadas pelo elemento <audio>,
      // então só revogamos após um pequeno delay para garantir que o áudio carregou
      setTimeout(() => {
        for (const url of objectUrls) {
          URL.revokeObjectURL(url);
        }
      }, 5000);

      return tracks;
    },
    [extractMetadata]
  );

  /**
   * Libera URLs de capas do álbum para evitar vazamento de memória.
   */
  const cleanupCoverUrls = useCallback(() => {
    coverUrlsRef.current.clear();
  }, []);

  return {
    extractMetadata,
    processFiles,
    cleanupCoverUrls,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
