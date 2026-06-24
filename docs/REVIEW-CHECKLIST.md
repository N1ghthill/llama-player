# 🦙 Llama Player — Checklist de Correções

> Relatório gerado em: 2026-06-23
> Baseado em análise de código-fonte (React 18 + TypeScript + Tauri v2)

---

## 🔴 CRÍTICOS — Prioridade máxima (potencial crash ou mau funcionamento)

### 1. `visualizer` não declarado em `App.tsx`
- [ ] **Arquivo:** `src/App.tsx` (linhas 367-371)
- [ ] **Problema:** A variável `visualizer` é usada no JSX mas nunca foi declarada ou importada. O hook `useAudioVisualizer` existe mas não é chamado.
- [ ] **Correção:** Adicionar `const visualizer = useAudioVisualizer(audioRef, state.isPlaying);` em App.tsx
- [ ] **Teste:** App não deve crashar ao renderizar; visualizações devem aparecer

### 2. Tipo TypeScript inválido em `useAudioVisualizer.ts`
- [ ] **Arquivo:** `src/hooks/useAudioVisualizer.ts` (linhas 22-23)
- [ ] **Problema:** `Uint8Array<ArrayBuffer>` é um tipo inválido. O correto é apenas `Uint8Array`.
- [ ] **Correção:** Trocar `Uint8Array<ArrayBuffer>` por `Uint8Array`
- [ ] **Teste:** `npx tsc --noEmit` não deve acusar erro

### 3. AudioContext nunca é resumido (visualizações mudas)
- [ ] **Arquivo:** `src/hooks/useAudioVisualizer.ts` (linha 62)
- [ ] **Problema:** `new AudioCtx()` cria um contexto suspenso (autoplay policy). Sem `ctx.resume()`, as visualizações sempre retornam dados zerados.
- [ ] **Correção:** Chamar `await ctx.resume()` após criar o contexto, com try/catch
- [ ] **Teste:** Visualizações (barras, waveform) devem reagir à música tocando

### 4. Transações IndexedDB sem await
- [ ] **Arquivo:** `src/hooks/useAudioCache.ts` (linhas 118, 124, 133, 181-182, 192-193)
- [ ] **Problema:** Operações `put`/`delete`/`clear` disparam transações mas nunca aguardam `tx.done`. Dados podem ser perdidos se a página fechar.
- [ ] **Correção:** Aguardar `new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); })` após cada grupo de operações
- [ ] **Teste:** Cache deve persistir corretamente entre sessões

### 5. Race condition no cache (estouro de limite)
- [ ] **Arquivo:** `src/hooks/useAudioCache.ts` (linhas 110-115)
- [ ] **Problema:** `cacheAudioBlob` lê tamanho, faz evicção e escreve em 3 transações separadas. Entre elas, o estado do cache pode mudar.
- [ ] **Correção:** Usar uma única transação read-write para ler metadados, evictar e escrever o novo blob
- [ ] **Teste:** Cache não deve exceder o limite configurado mesmo com múltiplos arquivos simultâneos

---

## 🟠 GRAVES — Prioridade alta (bugs funcionais ou segurança)

### 6. Stale closure em `state.currentTrack`
- [ ] **Arquivo:** `src/App.tsx` (linhas 232-233, 266-267, 295-296)
- [ ] **Problema:** Handlers assíncronos capturam `state.currentTrack` do closure. Quando a Promise resolve, o valor pode estar desatualizado.
- [ ] **Correção:** Usar `useRef(state.currentTrack)` para ler o valor mais recente dentro dos callbacks assíncronos
- [ ] **Teste:** Ao carregar arquivos rapidamente em sequência, a música correta deve tocar

### 7. fallbackTracks sem marcação de favoritos
- [ ] **Arquivo:** `src/App.tsx` (linhas 220-226)
- [ ] **Problema:** `markFavoriteTracks` só é aplicado em `processedTracks`. `fallbackTracks` são adicionados sem a flag `isFavorite`.
- [ ] **Correção:** Aplicar `markFavoriteTracks` também nos `fallbackTracks` antes de adicioná-los
- [ ] **Teste:** Favoritos devem aparecer corretamente mesmo em arquivos que falharam no fetch

### 8. Vazamento de `URL.createObjectURL`
- [ ] **Arquivo:** `src/hooks/useMetadata.ts` (linha 98)
- [ ] **Problema:** `URL.createObjectURL(file)` é chamado para cada arquivo mas nunca revogado. Vazamento de memória com muitas músicas.
- [ ] **Correção:** Revogar a URL quando o track for removido da playlist ou substituído. Idealmente no `useEffect` de cleanup do `useAudioEngine` ou quando `loadTrack` é chamado com um novo track.
- [ ] **Teste:** Monitorar memória no DevTools — não deve crescer indefinidamente ao trocar de músicas

### 9. `favoriteIds` é snapshot estale
- [ ] **Arquivo:** `src/hooks/useFavorites.ts` (linha 40)
- [ ] **Problema:** `favoriteIds` é computado uma única vez na chamada do hook. A UI nunca reflete mudanças posteriores.
- [ ] **Correção:** Usar `useState` com `loadFavorites()` como inicial, e atualizar o estado dentro de `toggleFavorite`
- [ ] **Teste:** Ao favoritar/desfavoritar, a UI deve refletir imediatamente sem refresh

### 10. CSP inseguro (`'unsafe-inline'` + `asset:` sem escopo)
- [ ] **Arquivo:** `src-tauri/tauri.conf.json` (linha 26)
- [ ] **Problema:** `script-src 'unsafe-inline'` desativa proteção XSS. `asset:` em connect/media/img-src sem restrição permite ler qualquer arquivo.
- [ ] **Correção:** Remover `'unsafe-inline'` (usar hash/nonce se necessário). Restringir `asset:` a diretórios específicos ou remover de `connect-src`.
- [ ] **Teste:** App deve funcionar sem erros de CSP no console; testar com `npx tauri dev`

### 11. `fs:allow-read` sem escopo
- [ ] **Arquivo:** `src-tauri/capabilities/default.json` (linhas 17-18)
- [ ] **Problema:** Permissão de leitura sem restrição de diretório. Frontend pode ler qualquer arquivo do sistema.
- [ ] **Correção:** Adicionar escopo: `{ "path": "$AUDIO/**" }`, `{ "path": "$MUSIC/**" }`, `{ "path": "$HOME/Music/**" }`
- [ ] **Teste:** File picker deve continuar funcionando; testar leitura fora dos diretórios permitidos (deve falhar)

### 12. `shell:allow-open` sem validação de URL
- [ ] **Arquivo:** `src-tauri/capabilities/default.json` + `src/hooks/useTauri.ts` (linha 228)
- [ ] **Problema:** `shell.open(url)` pode abrir `file://` ou protocolos perigosos sem validação.
- [ ] **Correção:** Adicionar escopo de URL nas capabilities (`"url": "https://*"`) e validar scheme no frontend
- [ ] **Teste:** `openUrl("file:///etc/passwd")` deve ser bloqueado; `openUrl("https://...")` deve funcionar

---

## 🟡 MÉDIOS — Prioridade normal (lógica ou performance)

### 13. Shuffle destrutivo (perde ordem original)
- [ ] **Arquivo:** `src/hooks/usePlayer.ts` (linhas 115-119)
- [ ] **Problema:** `TOGGLE_SHUFFLE` modifica a playlist no estado. Ao desativar, a ordem original é perdida.
- [ ] **Correção:** Manter uma cópia da ordem original (`originalPlaylist`) e alternar entre ela e a embaralhada
- [ ] **Teste:** Ao desativar shuffle, a ordem original deve ser restaurada

### 14. Alocação de arrays em todo frame (60fps)
- [ ] **Arquivo:** `src/hooks/useAudioVisualizer.ts` (linhas 84-85)
- [ ] **Problema:** `Array.from(freqBuf)` e `Array.from(waveBuf)` criam novos arrays a 60 quadros/segundo.
- [ ] **Correção:** Usar `useRef` para os dados e atualizar estado em taxa reduzida (ex: a cada 3-4 frames) ou usar `useSyncExternalStore`
- [ ] **Teste:** Visualizações devem continuar suaves; perfil de memória deve melhorar

### 15. RAF race condition (dois loops simultâneos)
- [ ] **Arquivo:** `src/hooks/useAudioVisualizer.ts` (linha 90)
- [ ] **Problema:** `requestAnimationFrame` anterior nunca é cancelado antes de atribuir o novo.
- [ ] **Correção:** Cancelar RAF anterior antes de atribuir: `if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);`
- [ ] **Teste:** Ao alternar modos de visualização rapidamente, não deve haver múltiplos loops

### 16. Cache fetch após `canplay` (ineficiente)
- [ ] **Arquivo:** `src/hooks/useAudioEngine.ts` (linhas 124-144)
- [ ] **Problema:** O fetch para cachear o áudio acontece depois que ele já começou a tocar. O áudio é baixado duas vezes.
- [ ] **Correção:** Fazer o fetch imediatamente em `loadTrack` (em paralelo com `audio.src = track.src`), ou usar a resposta da requisição original
- [ ] **Teste:** Cache deve ser populado sem duplicar o download

### 17. `setTimeout` para `setActivePlaylistId`
- [ ] **Arquivo:** `src/hooks/usePlaylists.ts` (linha 74)
- [ ] **Problema:** `setTimeout(() => setActivePlaylistId(...), 0)` é frágil. Se o componente desmontar, causa warning de memory leak.
- [ ] **Correção:** Usar `useEffect` ou passar o `activePlaylistId` como retorno de `saveCurrentPlaylist`
- [ ] **Teste:** Salvar playlist não deve produzir warnings no console

### 18. Cálculo de cor alpha inconsistente
- [ ] **Arquivo:** `src/hooks/useTheme.ts` (linha 91)
- [ ] **Problema:** `${colors.accentDim}2a` assume que `accentDim` é hex de 6 caracteres. Se o formato mudar, quebra.
- [ ] **Correção:** Usar uma função `hexToRgba(hex, alpha)` que parseia o hex corretamente
- [ ] **Teste:** Temas devem aplicar cores com alpha corretamente

---

## 🔵 LEVES — Prioridade baixa (boas práticas, cosméticos)

### 19. Nome de arquivo enganoso
- [ ] **Arquivo:** `src/hooks/useAudioCache.ts`
- [ ] **Problema:** Nome `useAudioCache.ts` (convenção de hook React) mas exporta funções utilitárias, não hooks.
- [ ] **Correção:** Renomear para `src/services/audioCache.ts` e mover para `src/services/`
- [ ] **Teste:** Importações devem ser atualizadas; `npx tsc --noEmit` deve passar

### 20. `cfg!(debug_assertions)` deveria ser `#[cfg(debug_assertions)]`
- [ ] **Arquivo:** `src-tauri/src/lib.rs` (linha 43)
- [ ] **Problema:** `cfg!()` é runtime e compila o código mesmo em release. `#[cfg()]` excluiria do binário.
- [ ] **Correção:** Trocar `if cfg!(debug_assertions) { ... }` por `#[cfg(debug_assertions)]` no bloco
- [ ] **Teste:** Build release não deve incluir o plugin de log; `npm run tauri build` deve funcionar

### 21. `hostname()` frágil (variáveis de ambiente)
- [ ] **Arquivo:** `src-tauri/src/lib.rs` (linhas 23-27)
- [ ] **Problema:** Depende de `HOSTNAME`/`COMPUTERNAME` que não são garantidos (containers, systemd).
- [ ] **Correção:** Usar `std::process::Command::new("hostname")` ou adicionar crate `hostname`
- [ ] **Teste:** `get_system_info` deve retornar hostname mesmo em containers

### 22. `depends` vazio no pacote deb
- [ ] **Arquivo:** `src-tauri/tauri.conf.json` (linha 42)
- [ ] **Problema:** Pacote deb não declara dependências. Pode falhar ao instalar em sistemas sem as libs necessárias.
- [ ] **Correção:** Adicionar `"depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0", "libappindicator3-1", "libglib2.0-0"]`
- [ ] **Teste:** `dpkg -i` no .deb gerado deve resolver dependências corretamente

### 23. Identificador Apple `.desktop`
- [ ] **Arquivo:** `src-tauri/tauri.conf.json` (linha 5)
- [ ] **Problema:** `com.llamaplayer.desktop` usa `.desktop` como TLD, o que pode causar problemas com notarização da Apple.
- [ ] **Correção:** Trocar para `com.github.n1ghthill.llama-player` ou similar
- [ ] **Teste:** Build macOS deve passar na notarização

---

## 📊 Resumo

| Prioridade | Qtde | Ação |
|---|---|---|
| 🔴 **Crítico** | 5 | Corrigir antes do próximo release |
| 🟠 **Grave** | 7 | Corrigir antes do próximo release |
| 🟡 **Médio** | 6 | Corrigir quando possível |
| 🔵 **Leve** | 5 | Corrigir quando possível |
| **Total** | **23** | |

---

## 🧪 Como testar após correções

```bash
# Verificar tipos TypeScript
npx tsc --noEmit

# Build web
npm run build

# Build Tauri (Linux)
npm run tauri build

# Desenvolvimento
npm run dev          # Web
npm run tauri dev    # Desktop
```
