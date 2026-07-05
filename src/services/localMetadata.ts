/**
 * 🦙 Llama Player — Extração de metadados de arquivos locais via Tauri
 *
 * Quando o usuário abre arquivos pelo seletor nativo (Tauri dialog),
 * não temos acesso a objetos File do navegador. Este serviço lê os bytes
 * do arquivo via comando Tauri e extrai as tags ID3 usando jsmediatags.
 */

import type { Track } from "../types";

export interface LocalMetadataResult {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  duration: number;
}

/**
 * Tenta extrair metadados ID3 de um arquivo local usando jsmediatags.
 * A biblioteca jsmediatags aceita tanto File quanto ArrayBuffer.
 *
 * @param filePath - Caminho absoluto do arquivo no sistema
 * @param fileName - Nome do arquivo (para fallback)
 * @returns Metadados extraídos ou fallback com nome do arquivo
 */
export async function extractLocalMetadata(
  filePath: string,
  fileName: string
): Promise<LocalMetadataResult> {
  const fallback: LocalMetadataResult = {
    title: fileName.replace(/\.[^/.]+$/, ""),
    duration: 0,
  };

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[]>("read_audio_file", { path: filePath });

    if (!bytes || bytes.length === 0) return fallback;

    // Converte para ArrayBuffer para o jsmediatags
    const arrayBuffer = new Uint8Array(bytes).buffer;

    // Tenta extrair metadados via jsmediatags
    const metadata = await readId3Tags(arrayBuffer, fileName);
    return metadata ?? fallback;
  } catch (err) {
    console.warn("[Llama Player] Erro ao ler metadados locais:", err);
    return fallback;
  }
}

/**
 * Lê tags ID3 de um ArrayBuffer usando jsmediatags.
 */
function readId3Tags(
  buffer: ArrayBuffer,
  fileName: string
): Promise<LocalMetadataResult | null> {
  return new Promise((resolve) => {
    const fallback: LocalMetadataResult = {
      title: fileName.replace(/\.[^/.]+$/, ""),
      duration: 0,
    };

    try {
      // jsmediatags espera um objeto com slice(), como ArrayBuffer
      const jsmediatags = require("jsmediatags");

      jsmediatags.read(buffer, {
        onSuccess: (data: any) => {
          const tags = data.tags;
          let coverUrl: string | undefined;

          if (tags.picture) {
            const { data: pictureData, format } = tags.picture;
            const base64 = arrayBufferToBase64(pictureData);
            const mimeType = format || "image/jpeg";
            coverUrl = `data:${mimeType};base64,${base64}`;
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
          resolve(null);
        },
      });
    } catch {
      resolve(null);
    }
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Cria um Track a partir de um caminho de arquivo local,
 * extraindo metadados ID3 quando possível.
 *
 * @param filePath - Caminho absoluto do arquivo no sistema
 * @param src - URL opcional (ex: asset:// ou convertFileSrc). Se omitido,
 *              o audio engine usará filePath para ler o arquivo.
 */
export async function createTrackFromLocalPath(
  filePath: string,
  src?: string
): Promise<Track> {
  const name = filePath.split(/[/\\]/).pop() || filePath;
  const metadata = await extractLocalMetadata(filePath, name);

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: metadata.title || name.replace(/\.[^/.]+$/, ""),
    artist: metadata.artist,
    album: metadata.album,
    duration: metadata.duration,
    coverUrl: metadata.coverUrl,
    src,
    filePath,
    mimeType: inferAudioMimeType(name),
  };
}

function inferAudioMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    case "aac":
      return "audio/aac";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/ogg";
    default:
      return "audio/mpeg";
  }
}
