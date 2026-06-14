/**
 * 🦙 Llama Player — Google Drive Service
 *
 * Serviço para autenticação OAuth 2.0, listagem de arquivos e streaming
 * de áudio do Google Drive.
 *
 * No Tauri, usa OAuth 2.0 para apps instalados: navegador externo,
 * callback em loopback e PKCE. No navegador, mantém fallback via GIS popup.
 */

import {
  clearStoredDriveToken,
  getStoredDriveToken,
  storeDriveToken,
} from "./secureTokenStorage";

// Escopos necessários para a aplicação
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || "";
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBase64Url(byteLength = 64): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(new Uint8Array(digest));
}

// Tipos de áudio suportados para filtrar no Drive
const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
]);

// Extensões de áudio para filtrar quando o MIME type não é suficiente
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".ogg",
  ".wav",
  ".aac",
  ".m4a",
  ".wma",
  ".opus",
  ".webm",
]);

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  parents?: string[];
  iconLink?: string;
  /** Duração estimada em segundos (não vem do Drive, calculamos depois) */
  duration?: number;
  /** URL de download temporário */
  downloadUrl?: string;
  /** Web Content Link para streaming */
  webContentLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export type DriveItem = DriveFile | DriveFolder;

export interface DriveUser {
  email: string;
  name: string;
  picture?: string;
}

export interface DriveState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: DriveUser | null;
  currentFolder: DriveFolder | null;
  breadcrumbs: DriveFolder[];
  items: DriveItem[];
  error: string | null;
}

/** Configuração do cache de listas do Drive */
export interface DriveCacheConfig {
  /** Tempo de vida do cache em milissegundos (padrão: 5 minutos) */
  ttl: number;
  /** Máximo de entradas no cache */
  maxEntries: number;
}

const DEFAULT_CACHE_CONFIG: DriveCacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutos
  maxEntries: 50,
};

interface CacheEntry {
  items: DriveItem[];
  timestamp: number;
  folderId: string | null;
}

interface StoredDriveAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
}

interface NativeOAuthResult {
  code: string;
  redirect_uri: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Informações de uma playlist sincronizada com uma pasta do Drive */
export interface SyncedPlaylist {
  folderId: string;
  folderName: string;
  trackIds: string[]; // driveFileId de cada track
  syncedAt: string; // ISO date
}

export function isFolder(item: DriveItem): item is DriveFolder {
  return item.mimeType === "application/vnd.google-apps.folder";
}

export function isAudioFile(item: DriveItem): item is DriveFile {
  if (isFolder(item)) return false;
  const file = item as DriveFile;
  if (AUDIO_MIME_TYPES.has(file.mimeType)) return true;
  // Fallback: verificar extensão do nome
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Classe principal do serviço Google Drive.
 * Gerencia token OAuth, requisições à API e streaming.
 */
export class GoogleDriveService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private clientId: string | null = null;
  private tokenClient: any = null;
  private gisLoaded: boolean = false;

  // Cache de listas de arquivos
  private listCache: Map<string, CacheEntry> = new Map();
  private cacheConfig: DriveCacheConfig = { ...DEFAULT_CACHE_CONFIG };

  constructor() {
    if (!isTauriRuntime()) {
      this.loadGisApi();
    }
  }

  /**
   * Configura o cache de listas.
   */
  setCacheConfig(config: Partial<DriveCacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  /**
   * Limpa o cache de listas.
   */
  clearCache(): void {
    this.listCache.clear();
  }

  /**
   * Invalida entradas expiradas do cache.
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.listCache.entries()) {
      if (now - entry.timestamp > this.cacheConfig.ttl) {
        this.listCache.delete(key);
      }
    }
  }

  /**
   * Gera chave de cache para uma pasta.
   */
  private cacheKey(folderId: string | null): string {
    return folderId ?? "__root__";
  }

  /**
   * Obtém itens do cache se válidos.
   */
  private getCachedItems(folderId: string | null): DriveItem[] | null {
    this.cleanExpiredCache();
    const key = this.cacheKey(folderId);
    const entry = this.listCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
      this.listCache.delete(key);
      return null;
    }
    return entry.items;
  }

  /**
   * Armazena itens no cache.
   */
  private setCachedItems(folderId: string | null, items: DriveItem[]): void {
    const key = this.cacheKey(folderId);
    this.listCache.set(key, {
      items,
      timestamp: Date.now(),
      folderId,
    });
    // Limita o tamanho do cache removendo entradas mais antigas
    if (this.listCache.size > this.cacheConfig.maxEntries) {
      const oldest = this.listCache.entries().next().value;
      if (oldest) this.listCache.delete(oldest[0]);
    }
  }

  /**
   * Carrega a API Google Identity Services dinamicamente.
   */
  private loadGisApi(): void {
    if (typeof google !== "undefined" && google.accounts) {
      this.gisLoaded = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.gisLoaded = true;
      console.log("[Llama Player] GIS API carregada");
    };
    script.onerror = () => {
      console.error("[Llama Player] Erro ao carregar GIS API");
    };
    document.head.appendChild(script);
  }

  /**
   * Inicializa o TokenClient com o Client ID.
   * Deve ser chamado após o usuário interagir (clicar em "Login").
   */
  async initialize(clientId: string): Promise<void> {
    this.clientId = clientId;

    if (isTauriRuntime()) {
      return;
    }

    // Aguarda GIS carregar
    while (!this.gisLoaded) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.tokenClient = (google as any).accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          const auth = this.authFromTokenResponse(response);
          this.applyAuth(auth);
          void this.storeAuth(auth);
        }
      },
    });
  }

  /**
   * Dispara o fluxo de login OAuth.
   * Retorna true se autenticou com sucesso.
   */
  async login(): Promise<boolean> {
    if (isTauriRuntime()) {
      return this.loginWithNativeBrowser();
    }

    if (!this.tokenClient) {
      throw new Error(
        "TokenClient não inicializado. Chame initialize(clientId) primeiro."
      );
    }

    return new Promise((resolve) => {
      this.tokenClient!.callback = async (response: any) => {
        if (response.access_token) {
          const auth = this.authFromTokenResponse(response);
          this.applyAuth(auth);
          await this.storeAuth(auth);
          resolve(true);
        } else {
          console.error("[Llama Player] Erro no OAuth:", response.error);
          resolve(false);
        }
      };

      // Solicita token (pode abrir popup)
      this.tokenClient!.requestAccessToken({ prompt: "consent" });
    });
  }

  /**
   * Fluxo OAuth nativo: navegador externo + callback local + PKCE.
   */
  private async loginWithNativeBrowser(): Promise<boolean> {
    if (!this.clientId) {
      throw new Error("Client ID do Google não configurado");
    }

    const { invoke } = await import("@tauri-apps/api/core");
    const codeVerifier = randomBase64Url(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = randomBase64Url(32);

    const authResult = await invoke<NativeOAuthResult>("google_oauth_authorize", {
      clientId: this.clientId,
      scope: SCOPES,
      codeChallenge,
      state,
    });

    const tokenResponse = await this.exchangeAuthorizationCode(
      authResult.code,
      codeVerifier,
      authResult.redirect_uri
    );
    const auth = this.authFromTokenResponse(tokenResponse);
    this.applyAuth(auth);
    await this.storeAuth(auth);
    return true;
  }

  /**
   * Tenta fazer login silencioso com token existente.
   */
  async trySilentLogin(clientId: string): Promise<boolean> {
    try {
      await this.initialize(clientId);

      const storedAuth = await this.getStoredAuth();
      if (!storedAuth) return false;

      this.applyAuth(storedAuth);

      if (this.shouldRefreshToken() && this.refreshToken) {
        await this.refreshAccessToken();
      }

      // Verifica se o token ainda é válido
      const user = await this.getUserInfo();
      return !!user;
    } catch {
      this.clearInMemoryAuth();
      await this.clearToken();
      return false;
    }
  }

  /**
   * Faz logout: limpa token e revoga.
   */
  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        if (!isTauriRuntime() && typeof google !== "undefined") {
          (google as any).accounts.oauth2.revoke(this.accessToken, () => {});
        } else {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(this.accessToken)}`, {
            method: "POST",
          });
        }
      } catch {
        // Ignora erro no revoke
      }
    }
    this.clearInMemoryAuth();
    await this.clearToken();
  }

  private authFromTokenResponse(response: GoogleTokenResponse): StoredDriveAuth {
    if (!response.access_token) {
      throw new Error(
        response.error_description ||
          response.error ||
          "Resposta OAuth sem access token"
      );
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? this.refreshToken ?? undefined,
      expiresAt: response.expires_in
        ? Date.now() + response.expires_in * 1000
        : undefined,
      scope: response.scope,
      tokenType: response.token_type,
    };
  }

  private applyAuth(auth: StoredDriveAuth): void {
    this.accessToken = auth.accessToken;
    this.refreshToken = auth.refreshToken ?? null;
    this.expiresAt = auth.expiresAt ?? null;
  }

  private clearInMemoryAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
  }

  private shouldRefreshToken(): boolean {
    return !!this.expiresAt && Date.now() + TOKEN_REFRESH_SKEW_MS >= this.expiresAt;
  }

  private async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<GoogleTokenResponse> {
    if (!this.clientId) throw new Error("Client ID do Google não configurado");

    const body = new URLSearchParams({
      client_id: this.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    if (GOOGLE_CLIENT_SECRET) {
      body.set("client_secret", GOOGLE_CLIENT_SECRET);
    }

    return this.postTokenRequest(body);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.clientId || !this.refreshToken) {
      throw new Error("Refresh token do Google não disponível");
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });

    if (GOOGLE_CLIENT_SECRET) {
      body.set("client_secret", GOOGLE_CLIENT_SECRET);
    }

    const response = await this.postTokenRequest(body);
    const auth = this.authFromTokenResponse(response);
    this.applyAuth(auth);
    await this.storeAuth(auth);
  }

  private async postTokenRequest(body: URLSearchParams): Promise<GoogleTokenResponse> {
    if (isTauriRuntime()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<GoogleTokenResponse>("google_oauth_token_request", {
        params: Object.fromEntries(body.entries()),
      });
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok) {
      throw new Error(
        data.error_description ||
          data.error ||
          `Erro OAuth do Google: ${response.status}`
      );
    }

    return data;
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) throw new Error("Não autenticado");

    if (this.shouldRefreshToken()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        this.clearInMemoryAuth();
        await this.clearToken();
        throw new Error("Sessão Google expirada. Faça login novamente.");
      }
    }

    if (!this.accessToken) throw new Error("Não autenticado");
    return this.accessToken;
  }

  /**
   * Retorna informações do usuário autenticado.
   */
  async getUserInfo(): Promise<DriveUser | null> {
    try {
      const accessToken = await this.ensureAccessToken();
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return {
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch {
      return null;
    }
  }

  /**
   * Lista arquivos e pastas em uma pasta do Drive.
   * Se folderId for null, lista a raiz.
   * Utiliza cache para evitar requisições repetidas.
   */
  async listFiles(
    folderId: string | null = null,
    bypassCache: boolean = false
  ): Promise<DriveItem[]> {
    const accessToken = await this.ensureAccessToken();

    // Verifica cache primeiro
    if (!bypassCache) {
      const cached = this.getCachedItems(folderId);
      if (cached) {
        console.debug("[Llama Player] Usando cache para pasta:", folderId ?? "root");
        return cached;
      }
    }

    const query = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false and 'root' in parents";

    const fields =
      "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,iconLink,webContentLink)";

    try {
      const files: any[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          q: query,
          fields,
          orderBy: "folder,name",
          pageSize: "100",
          includeItemsFromAllDrives: "false",
          supportsAllDrives: "false",
        });
        if (pageToken) params.set("pageToken", pageToken);

        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error?.message ||
              `Erro ao listar arquivos do Drive: ${response.status}`
          );
        }

        const data = await response.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      const items: DriveItem[] = files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? parseInt(file.size, 10) : undefined,
        modifiedTime: file.modifiedTime,
        parents: file.parents,
        iconLink: file.iconLink,
        webContentLink: file.webContentLink,
      }));

      // Armazena no cache
      this.setCachedItems(folderId, items);

      return items;
    } catch (err: any) {
      console.error("[Llama Player] Erro ao listar arquivos:", err);
      throw new Error(err?.message || "Erro ao listar arquivos do Drive");
    }
  }

  /**
   * Busca arquivos de áudio no Drive por nome.
   */
  async searchAudio(query: string): Promise<DriveFile[]> {
    const accessToken = await this.ensureAccessToken();

    const mimeFilter = Array.from(AUDIO_MIME_TYPES)
      .map((m) => `mimeType = '${m}'`)
      .join(" or ");

    const q = `(name contains '${query.replace(/'/g, "\\'")}') and (${mimeFilter}) and trashed = false`;
    const fields =
      "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,iconLink,webContentLink)";

    try {
      const files: any[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          q,
          fields,
          orderBy: "name",
          pageSize: "100",
        });
        if (pageToken) params.set("pageToken", pageToken);

        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error?.message ||
              `Erro ao buscar no Drive: ${response.status}`
          );
        }

        const data = await response.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      return files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? parseInt(file.size, 10) : undefined,
        modifiedTime: file.modifiedTime,
        parents: file.parents,
        iconLink: file.iconLink,
        webContentLink: file.webContentLink,
      }));
    } catch (err: any) {
      console.error("[Llama Player] Erro na busca:", err);
      throw new Error(err?.message || "Erro ao buscar no Drive");
    }
  }

  /**
   * Obtém URL de download direto para um arquivo do Drive.
   * Usa exportLinks para arquivos do Google Docs ou download para binários.
   */
  async getDownloadUrl(fileId: string, _mimeType: string): Promise<string> {
    await this.ensureAccessToken();

    // Para arquivos de áudio, usa o download direto
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  /**
   * Cria um URL de mídia sem credenciais embutidas.
   * O player deve usar streamFile() para arquivos privados, enviando o token
   * no header Authorization em vez de expor credenciais na query string.
   */
  getStreamUrl(fileId: string): string {
    if (!this.accessToken) throw new Error("Não autenticado");
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  /**
   * Obtém um ReadableStream para um arquivo de áudio do Drive,
   * suportando Range requests para buffer progressivo.
   *
   * Útil para implementar streaming com fetch manual em vez de
   * depender do HTMLAudioElement com URL direta.
   */
  async streamFile(
    fileId: string,
    options?: { start?: number; end?: number }
  ): Promise<Response> {
    const accessToken = await this.ensureAccessToken();

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (options?.start !== undefined || options?.end !== undefined) {
      const start = options.start ?? 0;
      const end = options.end ?? "";
      headers["Range"] = `bytes=${start}-${end}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 206) {
      throw new Error(
        `Erro no streaming do arquivo ${fileId}: ${response.status} ${response.statusText}`
      );
    }

    return response;
  }

  /**
   * Obtém metadados de um arquivo específico do Drive.
   * Útil para verificar tamanho antes de iniciar streaming.
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(
        `Erro ao obter metadados do arquivo ${fileId}: ${response.status}`
      );
    }

    const file = await response.json();
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : undefined,
      modifiedTime: file.modifiedTime,
    };
  }

  /**
   * Verifica se o token atual é válido fazendo uma requisição leve.
   */
  async validateToken(): Promise<boolean> {
    try {
      const accessToken = await this.ensureAccessToken();
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // --- Playlists Sincronizadas com Pastas do Drive ---

  private SYNCED_PLAYLISTS_KEY = "llama-player-synced-playlists";

  /**
   * Salva uma playlist sincronizada com uma pasta do Drive.
   */
  saveSyncedPlaylist(playlist: SyncedPlaylist): void {
    try {
      const stored = this.getSyncedPlaylists();
      const existingIndex = stored.findIndex(
        (p) => p.folderId === playlist.folderId
      );
      if (existingIndex >= 0) {
        stored[existingIndex] = playlist;
      } else {
        stored.push(playlist);
      }
      localStorage.setItem(this.SYNCED_PLAYLISTS_KEY, JSON.stringify(stored));
    } catch {
      // localStorage pode não estar disponível
    }
  }

  /**
   * Remove uma playlist sincronizada.
   */
  removeSyncedPlaylist(folderId: string): void {
    try {
      const stored = this.getSyncedPlaylists();
      const filtered = stored.filter((p) => p.folderId !== folderId);
      localStorage.setItem(
        this.SYNCED_PLAYLISTS_KEY,
        JSON.stringify(filtered)
      );
    } catch {
      // Ignora
    }
  }

  /**
   * Retorna todas as playlists sincronizadas.
   */
  getSyncedPlaylists(): SyncedPlaylist[] {
    try {
      const data = localStorage.getItem(this.SYNCED_PLAYLISTS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Sincroniza a playlist atual com uma pasta do Drive:
   * salva os IDs dos arquivos de áudio da pasta.
   */
  async syncPlaylistWithFolder(folderId: string, folderName: string): Promise<SyncedPlaylist> {
    const items = await this.listFiles(folderId, true); // bypass cache para garantir dados frescos
    const audioFiles = items.filter(isAudioFile) as DriveFile[];

    const synced: SyncedPlaylist = {
      folderId,
      folderName,
      trackIds: audioFiles.map((f) => f.id),
      syncedAt: new Date().toISOString(),
    };

    this.saveSyncedPlaylist(synced);
    return synced;
  }

  /**
   * Verifica se uma pasta do Drive tem uma playlist sincronizada.
   */
  getSyncedPlaylistForFolder(folderId: string): SyncedPlaylist | null {
    const playlists = this.getSyncedPlaylists();
    return playlists.find((p) => p.folderId === folderId) ?? null;
  }

  // --- Gerenciamento de Token ---

  private async storeAuth(auth: StoredDriveAuth): Promise<void> {
    try {
      await storeDriveToken(JSON.stringify(auth));
    } catch (err) {
      console.warn("[Llama Player] Erro ao salvar token:", err);
    }
  }

  private async getStoredAuth(): Promise<StoredDriveAuth | null> {
    try {
      const stored = await getStoredDriveToken();
      if (!stored) return null;

      try {
        const parsed = JSON.parse(stored) as StoredDriveAuth;
        if (parsed.accessToken) return parsed;
      } catch {
        // Formato legado: o valor salvo era apenas o access token.
      }

      return { accessToken: stored };
    } catch (err) {
      console.warn("[Llama Player] Erro ao carregar token salvo:", err);
      return null;
    }
  }

  private async clearToken(): Promise<void> {
    try {
      await clearStoredDriveToken();
    } catch (err) {
      console.warn("[Llama Player] Erro ao limpar token salvo:", err);
    }
  }

  /**
   * Verifica se o usuário está autenticado.
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Retorna o token de acesso atual.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Instância singleton do serviço
export const driveService = new GoogleDriveService();
