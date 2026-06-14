const TOKEN_KEY = "llama-player-drive-token";
const STRONGHOLD_CLIENT = "llama-player";
const STRONGHOLD_PASSWORD = "llama-player-token-vault-v1";
const STRONGHOLD_FILE = "llama-player.vault.hold";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function encode(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function decode(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

async function getStrongholdStore() {
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);

  const baseDir = await appDataDir();
  const vaultPath = await join(baseDir, STRONGHOLD_FILE);
  const stronghold = await Stronghold.load(
    vaultPath,
    STRONGHOLD_PASSWORD
  );

  let client;
  try {
    client = await stronghold.loadClient(STRONGHOLD_CLIENT);
  } catch {
    client = await stronghold.createClient(STRONGHOLD_CLIENT);
  }

  return {
    stronghold,
    store: client.getStore(),
  };
}

export async function storeDriveToken(token: string): Promise<void> {
  if (isTauri()) {
    const { stronghold, store } = await getStrongholdStore();
    await store.insert(TOKEN_KEY, encode(token));
    await stronghold.save();
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

export async function getStoredDriveToken(): Promise<string | null> {
  if (isTauri()) {
    const { stronghold, store } = await getStrongholdStore();
    const value = await store.get(TOKEN_KEY);
    if (value) return decode(value);

    const legacyToken = localStorage.getItem(TOKEN_KEY);
    if (!legacyToken) return null;

    await store.insert(TOKEN_KEY, encode(legacyToken));
    await stronghold.save();
    localStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export async function clearStoredDriveToken(): Promise<void> {
  if (isTauri()) {
    const { stronghold, store } = await getStrongholdStore();
    await store.remove(TOKEN_KEY);
    await stronghold.save();
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}
