/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LOCAL_STORAGE_KEYS,
  getLocalDataSummary,
  clearLocalPreferences,
  getTotalLocalDataBytes,
} from "./localData";

// Mock do audioCache
vi.mock("./audioCache", () => ({
  clearAudioCache: vi.fn().mockResolvedValue(undefined),
  getCacheStats: vi.fn().mockResolvedValue({ count: 0, totalSize: 0, maxSize: 200 * 1024 * 1024 }),
}));

describe("localData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getLocalDataSummary", () => {
    it("deve retornar lista com todas as chaves", () => {
      const summary = getLocalDataSummary();
      expect(summary).toHaveLength(4);
      expect(summary.map((s) => s.key)).toEqual(
        Object.values(LOCAL_STORAGE_KEYS)
      );
    });

    it("deve marcar exists=false quando não há dados", () => {
      const summary = getLocalDataSummary();
      for (const item of summary) {
        expect(item.exists).toBe(false);
        expect(item.bytes).toBe(0);
      }
    });

    it("deve marcar exists=true quando há dados", () => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.favorites, '["track1","track2"]');
      const summary = getLocalDataSummary();
      const fav = summary.find((s) => s.key === LOCAL_STORAGE_KEYS.favorites);
      expect(fav?.exists).toBe(true);
      expect(fav?.bytes).toBeGreaterThan(0);
    });

    it("deve ter labels em português", () => {
      const summary = getLocalDataSummary();
      const labels = summary.map((s) => s.label);
      expect(labels).toContain("Favoritos");
      expect(labels).toContain("Historico");
      expect(labels).toContain("Playlists");
      expect(labels).toContain("Tema");
    });
  });

  describe("clearLocalPreferences", () => {
    it("deve limpar todas as chaves do localStorage", () => {
      for (const key of Object.values(LOCAL_STORAGE_KEYS)) {
        localStorage.setItem(key, "some data");
      }
      clearLocalPreferences();
      for (const key of Object.values(LOCAL_STORAGE_KEYS)) {
        expect(localStorage.getItem(key)).toBeNull();
      }
    });
  });

  describe("getTotalLocalDataBytes", () => {
    it("deve retornar 0 quando não há dados", async () => {
      const result = await getTotalLocalDataBytes();
      expect(result.localStorageBytes).toBe(0);
      expect(result.cacheBytes).toBe(0);
    });

    it("deve calcular bytes do localStorage corretamente", async () => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.favorites, "abc");
      const result = await getTotalLocalDataBytes();
      expect(result.localStorageBytes).toBeGreaterThan(0);
    });
  });
});
