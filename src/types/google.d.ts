/**
 * 🦙 Llama Player — Declarações de tipos para Google APIs
 *
 * Google Identity Services (GIS) e Google API Client (gapi).
 */

// Google Identity Services
declare namespace google.accounts.oauth2 {
  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: any) => void;
  }

  interface TokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
    scope?: string;
  }

  interface TokenClient {
    requestAccessToken: (config?: {
      prompt?: string;
      hint?: string;
      state?: string;
    }) => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(token: string, callback?: () => void): void;
}

declare namespace google.accounts.id {
  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: string;
    native_callback?: (response: CredentialResponse) => void;
    prompt_parent_id?: string;
    state_cookie_domain?: string;
    ux_mode?: "popup" | "redirect";
    allowed_parent_origin?: string | string[];
    intermediate_iframe_close_callback?: () => void;
  }

  interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  function initialize(config: IdConfiguration): void;
  function prompt(momentListener?: (moment: string) => void): void;
  function renderButton(
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      logo_alignment?: string;
      width?: string;
      locale?: string;
    }
  ): void;
  function disableAutoSelect(): void;
  function storeCredential(
    credential: string,
    callback?: () => void
  ): void;
  function cancel(): void;
  function revoke(credential: string, callback?: () => void): void;
}

// Google API Client
declare namespace gapi {
  interface ClientConfig {
    apiKey?: string;
    clientId?: string;
    discoveryDocs?: string[];
    scope?: string;
  }

  interface RequestOptions {
    path?: string;
    method?: string;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
  }

  interface HttpResponse<T = any> {
    result: T;
    body: string;
    headers: Record<string, string>;
    status: number;
    statusText: string;
  }

  interface Client {
    init(config: ClientConfig): Promise<void>;
    request<T = any>(options: RequestOptions): Promise<HttpResponse<T>>;
  }

  interface DriveV3FilesResource {
    list(params?: {
      q?: string;
      fields?: string;
      orderBy?: string;
      pageSize?: number;
      pageToken?: string;
      includeItemsFromAllDrives?: boolean;
      supportsAllDrives?: boolean;
      spaces?: string;
      corpora?: string;
    }): Promise<HttpResponse<{ files: any[]; nextPageToken?: string }>>;
  }

  interface DriveV3Resource {
    files: DriveV3FilesResource;
    about: {
      get(params?: {
        fields?: string;
      }): Promise<HttpResponse<{ user: any }>>;
    };
  }

  interface ClientInstance {
    drive: DriveV3Resource;
  }

  function load(api: string, callback: () => void): void;
  function load(
    api: string,
    version: string,
    callback: () => void
  ): void;

  const client: Client & ClientInstance;
}

// Extensão do ImportMeta para Vite
interface ImportMeta {
  readonly env: {
    readonly VITE_GOOGLE_CLIENT_ID?: string;
    readonly [key: string]: string | undefined;
  };
}
