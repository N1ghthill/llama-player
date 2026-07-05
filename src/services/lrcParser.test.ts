import { describe, it, expect } from "vitest";
import { parseLRC, getCurrentLyricLine } from "./lrcParser";

describe("parseLRC", () => {
  it("deve parsear linhas LRC simples", () => {
    const input = `[00:01.00]Linha um
[00:05.50]Linha dois
[00:10.00]Linha tres`;
    const result = parseLRC(input);
    expect(result.metadata).toEqual({});
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toEqual({ time: 1, text: "Linha um" });
    expect(result.lines[1]).toEqual({ time: 5.5, text: "Linha dois" });
    expect(result.lines[2]).toEqual({ time: 10, text: "Linha tres" });
  });

  it("deve parsear timestamps com milissegundos (3 dígitos)", () => {
    const input = `[00:01.500]Meio segundo`;
    const result = parseLRC(input);
    expect(result.lines[0].time).toBe(1.5);
  });

  it("deve parsear timestamps com centésimos (2 dígitos)", () => {
    const input = `[00:01.50]Meio segundo`;
    const result = parseLRC(input);
    expect(result.lines[0].time).toBe(1.5);
  });

  it("deve parsear múltiplos timestamps na mesma linha", () => {
    const input = `[00:01.00][00:15.00]Repeticao`;
    const result = parseLRC(input);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toEqual({ time: 1, text: "Repeticao" });
    expect(result.lines[1]).toEqual({ time: 15, text: "Repeticao" });
  });

  it("deve parsear metadados", () => {
    const input = `[ti:Titulo da Musica]
[ar:Artista Legal]
[al:Album Show]
[by:Letrista]
[offset:+500]
[00:01.00]Comeco`;
    const result = parseLRC(input);
    expect(result.metadata).toEqual({
      title: "Titulo da Musica",
      artist: "Artista Legal",
      album: "Album Show",
      author: "Letrista",
      offset: 500,
    });
    expect(result.lines).toHaveLength(1);
  });

  it("deve ignorar linhas vazias", () => {
    const input = `[00:01.00]Linha um

[00:05.00]Linha dois`;
    const result = parseLRC(input);
    expect(result.lines).toHaveLength(2);
  });

  it("deve retornar lista vazia para string vazia", () => {
    const result = parseLRC("");
    expect(result.lines).toHaveLength(0);
    expect(result.metadata).toEqual({});
  });

  it("deve retornar lista vazia para texto sem timestamps", () => {
    const result = parseLRC("apenas texto sem timestamp");
    expect(result.lines).toHaveLength(0);
  });

  it("deve ordenar linhas por tempo", () => {
    const input = `[00:10.00]Ultima
[00:01.00]Primeira
[00:05.00]Meio`;
    const result = parseLRC(input);
    expect(result.lines[0].text).toBe("Primeira");
    expect(result.lines[1].text).toBe("Meio");
    expect(result.lines[2].text).toBe("Ultima");
  });

  it("deve ignorar offset negativo no metadado", () => {
    const input = `[offset:-200]
[00:01.00]Linha`;
    const result = parseLRC(input);
    expect(result.metadata.offset).toBe(-200);
  });
});

describe("getCurrentLyricLine", () => {
  const lines = [
    { time: 1, text: "Primeira" },
    { time: 5, text: "Segunda" },
    { time: 10, text: "Terceira" },
  ];

  it("deve retornar a linha correta para o tempo atual", () => {
    const result = getCurrentLyricLine(lines, 3);
    expect(result.currentIndex).toBe(0);
    expect(result.currentLine?.text).toBe("Primeira");
    expect(result.nextLine?.text).toBe("Segunda");
  });

  it("deve retornar a segunda linha quando o tempo passa de 5s", () => {
    const result = getCurrentLyricLine(lines, 7);
    expect(result.currentIndex).toBe(1);
    expect(result.currentLine?.text).toBe("Segunda");
    expect(result.nextLine?.text).toBe("Terceira");
  });

  it("deve retornar a última linha quando o tempo passa do último timestamp", () => {
    const result = getCurrentLyricLine(lines, 15);
    expect(result.currentIndex).toBe(2);
    expect(result.currentLine?.text).toBe("Terceira");
    expect(result.nextLine).toBeNull();
    expect(result.progress).toBe(1);
  });

  it("deve retornar null quando não há linhas", () => {
    const result = getCurrentLyricLine([], 5);
    expect(result.currentIndex).toBe(-1);
    expect(result.currentLine).toBeNull();
    expect(result.nextLine).toBeNull();
    expect(result.progress).toBe(0);
  });

  it("deve calcular progresso entre linhas", () => {
    const result = getCurrentLyricLine(lines, 3);
    // Entre 1 e 5, tempo 3 → progresso = (3-1)/(5-1) = 0.5
    expect(result.progress).toBeCloseTo(0.5);
  });

  it("deve aplicar offset em milissegundos", () => {
    const result = getCurrentLyricLine(lines, 0.5, 1000); // offset +1000ms = +1s
    // Tempo ajustado = 0.5 + 1 = 1.5 → primeira linha
    expect(result.currentIndex).toBe(0);
    expect(result.currentLine?.text).toBe("Primeira");
  });

  it("deve retornar índice -1 quando o tempo é anterior a todas as linhas", () => {
    const result = getCurrentLyricLine(lines, 0);
    expect(result.currentIndex).toBe(-1);
    expect(result.currentLine).toBeNull();
    expect(result.nextLine?.text).toBe("Primeira");
    expect(result.progress).toBe(0);
  });
});
