/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayer } from "./usePlayer";
import type { Track } from "../types";

function createTrack(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    title: `Track ${id}`,
    duration: 200,
    ...overrides,
  };
}

describe("usePlayer", () => {
  const trackA = createTrack("A", { title: "Musica A" });
  const trackB = createTrack("B", { title: "Musica B" });
  const trackC = createTrack("C", { title: "Musica C" });

  describe("estado inicial", () => {
    it("deve iniciar com estado padrão quando não há playlist", () => {
      const { result } = renderHook(() => usePlayer());
      expect(result.current.state.currentTrack).toBeNull();
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.playlist).toEqual([]);
      expect(result.current.state.volume).toBe(100);
      expect(result.current.state.repeatMode).toBe("none");
      expect(result.current.state.isShuffled).toBe(false);
    });

    it("deve iniciar com a primeira faixa quando playlist é fornecida", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB]));
      expect(result.current.state.currentTrack?.id).toBe("A");
      expect(result.current.state.playlist).toHaveLength(2);
    });
  });

  describe("play", () => {
    it("deve iniciar reprodução da faixa atual", () => {
      const { result } = renderHook(() => usePlayer([trackA]));
      act(() => result.current.play());
      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.currentTrack?.id).toBe("A");
    });

    it("deve tocar uma faixa específica", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB]));
      act(() => result.current.play(trackB));
      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.currentTrack?.id).toBe("B");
    });
  });

  describe("pause", () => {
    it("deve pausar a reprodução", () => {
      const { result } = renderHook(() => usePlayer([trackA]));
      act(() => result.current.play());
      act(() => result.current.pause());
      expect(result.current.state.isPlaying).toBe(false);
    });
  });

  describe("next / prev", () => {
    it("deve avançar para a próxima faixa", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB, trackC]));
      act(() => result.current.play(trackA));
      act(() => result.current.next());
      expect(result.current.state.currentTrack?.id).toBe("B");
    });

    it("deve voltar para a faixa anterior", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB, trackC]));
      act(() => result.current.play(trackB));
      act(() => result.current.prev());
      expect(result.current.state.currentTrack?.id).toBe("A");
    });

    it("deve ir para o final da playlist quando prev na primeira faixa", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB, trackC]));
      act(() => result.current.play(trackA));
      act(() => result.current.prev());
      expect(result.current.state.currentTrack?.id).toBe("C");
    });
  });

  describe("seek", () => {
    it("deve alterar currentTime", () => {
      const { result } = renderHook(() => usePlayer([trackA]));
      act(() => result.current.seek(50));
      expect(result.current.state.currentTime).toBe(50);
    });
  });

  describe("setVolume", () => {
    it("deve alterar o volume", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setVolume(50));
      expect(result.current.state.volume).toBe(50);
    });

    it("deve aplicar clamp no volume mínimo", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setVolume(-10));
      expect(result.current.state.volume).toBe(0);
    });

    it("deve aplicar clamp no volume máximo", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setVolume(150));
      expect(result.current.state.volume).toBe(100);
    });
  });

  describe("addTrack", () => {
    it("deve adicionar faixa ao final da playlist", () => {
      const { result } = renderHook(() => usePlayer([trackA]));
      act(() => result.current.addTrack(trackB));
      expect(result.current.state.playlist).toHaveLength(2);
      expect(result.current.state.playlist[1].id).toBe("B");
    });
  });

  describe("removeTrack", () => {
    it("deve remover faixa da playlist", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB]));
      act(() => result.current.removeTrack("A"));
      expect(result.current.state.playlist).toHaveLength(1);
      expect(result.current.state.playlist[0].id).toBe("B");
    });
  });

  describe("toggleShuffle", () => {
    it("deve ativar shuffle", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB, trackC]));
      act(() => result.current.toggleShuffle());
      expect(result.current.state.isShuffled).toBe(true);
    });

    it("deve desativar shuffle e restaurar ordem original", () => {
      const { result } = renderHook(() => usePlayer([trackA, trackB, trackC]));
      act(() => result.current.toggleShuffle()); // ativa
      act(() => result.current.toggleShuffle()); // desativa
      expect(result.current.state.isShuffled).toBe(false);
      expect(result.current.state.playlist.map((t) => t.id)).toEqual(["A", "B", "C"]);
    });
  });

  describe("setRepeatMode", () => {
    it("deve alterar o modo de repetição", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setRepeatMode("one"));
      expect(result.current.state.repeatMode).toBe("one");
      act(() => result.current.setRepeatMode("all"));
      expect(result.current.state.repeatMode).toBe("all");
    });
  });

  describe("toggleFavorite", () => {
    it("deve marcar/desmarcar faixa como favorita", () => {
      const { result } = renderHook(() => usePlayer([trackA]));
      act(() => result.current.toggleFavorite("A"));
      expect(result.current.state.playlist[0].isFavorite).toBe(true);
      act(() => result.current.toggleFavorite("A"));
      expect(result.current.state.playlist[0].isFavorite).toBe(false);
    });
  });

  describe("setCrossfade", () => {
    it("deve alterar a duração do crossfade", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setCrossfade(5));
      expect(result.current.state.crossfadeDuration).toBe(5);
    });

    it("deve aplicar clamp máximo de 30s", () => {
      const { result } = renderHook(() => usePlayer());
      act(() => result.current.setCrossfade(60));
      expect(result.current.state.crossfadeDuration).toBe(30);
    });
  });

  describe("toggleGapless", () => {
    it("deve alternar gapless", () => {
      const { result } = renderHook(() => usePlayer());
      expect(result.current.state.gaplessEnabled).toBe(false);
      act(() => result.current.toggleGapless());
      expect(result.current.state.gaplessEnabled).toBe(true);
      act(() => result.current.toggleGapless());
      expect(result.current.state.gaplessEnabled).toBe(false);
    });
  });
});
