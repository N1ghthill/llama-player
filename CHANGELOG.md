# Changelog

Todas as mudancas relevantes do Llama Player devem ser registradas aqui.

Formato baseado em Keep a Changelog e versionamento SemVer.

## [Unreleased]

### Added

- CI para validacao TypeScript, build frontend e Tauri no-bundle.
- Workflow de release com validacao de tag, chave do updater e checksums SHA-256.
- Script `release:validate` para checar versoes, bundle, updater e asset scope.
- Script `checksums` para gerar SHA-256 dos artefatos da versao atual.
- Painel de dados locais para limpar cache, preferencias, favoritos, historico e playlists.
- Versao do app injetada no build e exibida na janela.
- Templates de issue para bugs e problemas de instalacao/update.
- Template de release.

### Changed

- Identifier do app alterado para `com.github.n1ghthill.llama-player`.
- Targets padrao de bundle ajustados para `.deb`, `.rpm`, MSI e DMG.
- Perfil de release Rust otimizado com strip, LTO, `opt-level = "z"` e `panic = "abort"`.
- Importacao de arquivos locais no Tauri agora usa URL direta em vez de copiar audio inteiro para `Blob`.
- Visualizador de audio reduzido para desenho com dados limitados, diminuindo loops e alocacoes por frame.
- Dependencias Debian aceitam nomes novos `t64` e nomes antigos.
- Permissao `dialog:allow-save` removida porque nao e usada.
- Abertura de URL externa agora bloqueia protocolos que nao sejam HTTP/HTTPS.
- Documentacao reorganizada para produto instalavel, update e desinstalacao.

## [0.2.0] — 2026-07-05

### Added

- Componentes `MixerPanel`, `DeckPanel` e `LibraryShell` extraídos do `App.tsx` (Fase 2 de componentização).
- `React.memo` em `HistoryPanel`, `PlaylistManager`, `LyricsDisplay` e `DataManagement`.
- Suporte a `prefers-reduced-motion` no CSS para acessibilidade.

### Changed

- **Performance:** `usePlayer` retorna `{ state, actions }` com `useMemo` estável — elimina cascata de re-renderizações.
- **Performance:** `setTimeout` de 50ms substituído por evento `seeked` nativo — barra de progresso sem saltos.
- **Performance:** Cópia dupla de buffer em `readLocalTrackBlob` eliminada — consumo de RAM reduzido.
- **Performance:** Crossfade com generation token — race conditions eliminadas.
- **Performance:** `gaplessLoadTrack` com ref para evitar closure stale.
- **Performance:** `AudioVisualizer` pausa RAF quando fora da viewport (`IntersectionObserver`).
- **Performance:** `Playlist` com `normalizedQuery`, `totalHeight`, `totalDuration` memoizados; `TrackItem` como `React.memo`; `ResizeObserver` com throttle.
- **Performance:** `PlayerControls`, `ProgressBar`, `AudioVisualizer` envolvidos em `React.memo`.
- **Performance:** `arrayBufferToBase64` otimizado com `String.fromCharCode`.
- **Performance:** Efeito de teclado usa refs em vez de estado — listener registrado uma vez.
- **Performance:** `addTracksToPlaylist` usa `currentTrackRef` — não recriado a cada música.
- **Performance:** Objetos `playlists` e `lyrics` desestruturados em props individuais — `React.memo(LibraryShell)` funciona efetivamente.
- **Performance:** Todos os callbacks inline (`onToggleShow*`, `onReplaceTracks`, `onToggleCompact`) extraídos para `useCallback` estável.
- **Manutenção:** `require("jsmediatags")` substituído por `import` estático — tree-shaking funciona.
- **Manutenção:** Dependências não usadas (`@tauri-apps/plugin-process`, `@tauri-apps/plugin-updater`) removidas do `package.json`.
- **Manutenção:** Variáveis CSS mortas (`--panel-header`, `--control-hover`, `--control-hover-border`, `--shadow`) removidas.

### Fixed

- `usePlayer` retornava objeto novo a cada render — corrigido com `useMemo`.
- `handleSelectTrack` recriado a cada entrada no histórico — corrigido com ref para `history.addEntry`.
- `loadingProgress` não limpo no `finally` do Tauri `handleOpenFolder` — corrigido.
- `eslint-disable` no `useEffect` de favoritos — dependências adicionadas.
- `sendNotification` e `registerShortcuts` não usados — removidos do destructuring.

### Fixed

- Reproducao de audio local via `blob:`, `asset:` e `http://asset.localhost`.
- URLs `blob:` de faixas locais nao sao mais revogadas enquanto ainda podem tocar.
- Fallback de faixa local quando metadados nao podem ser extraidos.

## [0.1.1]

### Notes

- Versao de desenvolvimento local antes do primeiro beta publico.
