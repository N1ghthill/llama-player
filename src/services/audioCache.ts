/**
 * Audio cache using IndexedDB for offline playback and faster loading.
 * Caches audio blobs keyed by track ID or source URL.
 * Max cache size: ~200MB by default.
 */

const DB_NAME = "llama-player-audio-cache";
const DB_VERSION = 1;
const STORE_NAME = "audio-blobs";
const META_STORE = "cache-meta";

interface CacheMeta {
  key: string;
  size: number; // bytes
  cachedAt: number;
  trackTitle: string;
  mimeType: string;
}

const DEFAULT_MAX_SIZE = 200 * 1024 * 1024; // 200MB

let dbInstance: IDBDatabase | null = null;

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transaction aborted"));
  });
}

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: "key" });
        metaStore.createIndex("cachedAt", "cachedAt", { unique: false });
        metaStore.createIndex("size", "size", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance!);
    };

    request.onerror = (event) => {
      console.warn("[Llama Player] IndexedDB error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

async function getTotalCacheSize(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const allMeta = await new Promise<CacheMeta[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return allMeta.reduce((sum, meta) => sum + meta.size, 0);
  } catch {
    return 0;
  }
}

async function evictOldest(requiredSpace: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([META_STORE, STORE_NAME], "readwrite");
    const metaStore = tx.objectStore(META_STORE);
    const blobStore = tx.objectStore(STORE_NAME);

    const allMeta = await new Promise<CacheMeta[]>((resolve, reject) => {
      const request = metaStore.index("cachedAt").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Sort oldest first
    allMeta.sort((a, b) => a.cachedAt - b.cachedAt);

    let freed = 0;
    for (const meta of allMeta) {
      if (freed >= requiredSpace) break;
      blobStore.delete(meta.key);
      metaStore.delete(meta.key);
      freed += meta.size;
    }

    await awaitTransaction(tx);
  } catch (err) {
    console.warn("[Llama Player] Error evicting cache:", err);
  }
}

export async function cacheAudioBlob(
  key: string,
  blob: Blob,
  trackTitle: string
): Promise<void> {
  try {
    const db = await openDB();

    // Check if we need to evict
    const totalSize = await getTotalCacheSize();
    const blobSize = blob.size;
    const maxSize = DEFAULT_MAX_SIZE;

    if (totalSize + blobSize > maxSize) {
      await evictOldest(totalSize + blobSize - maxSize);
    }

    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    const blobStore = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE);

    const now = Date.now();

    blobStore.put({ key, blob, cachedAt: now });

    const meta: CacheMeta = {
      key,
      size: blobSize,
      cachedAt: now,
      trackTitle,
      mimeType: blob.type || "audio/mpeg",
    };
    metaStore.put(meta);

    await awaitTransaction(tx);
  } catch (err) {
    console.warn("[Llama Player] Error caching audio:", err);
  }
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const result = await new Promise<{ key: string; blob: Blob; cachedAt: number } | undefined>(
      (resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );

    return result?.blob ?? null;
  } catch {
    return null;
  }
}

export async function getCacheMeta(key: string): Promise<CacheMeta | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);

    const result = await new Promise<CacheMeta | undefined>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return result ?? null;
  } catch {
    return null;
  }
}

export async function removeCachedAudio(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.objectStore(META_STORE).delete(key);
    await awaitTransaction(tx);
  } catch {
    // ignore
  }
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
    await awaitTransaction(tx);
  } catch {
    // ignore
  }
}

export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
  maxSize: number;
}> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const allMeta = await new Promise<CacheMeta[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return {
      count: allMeta.length,
      totalSize: allMeta.reduce((sum, m) => sum + m.size, 0),
      maxSize: DEFAULT_MAX_SIZE,
    };
  } catch {
    return { count: 0, totalSize: 0, maxSize: DEFAULT_MAX_SIZE };
  }
}

export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
