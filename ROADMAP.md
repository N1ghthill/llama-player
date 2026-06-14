# 🦙 Llama Player — Roadmap de Desenvolvimento

> Player de música nostálgico inspirado no Winamp, conectado ao Google Drive.
> Stack: React 18 + TypeScript + Vite + Tauri

---

## Fase 1 — Fundação 🏗️

### 1.1 Estrutura de Componentes
- [x] Separar `App.tsx` em componentes modulares:
  - `TitleBar` — barra de título com botões minimizar/fechar
  - `Playlist` — lista de músicas com scroll
  - `PlayerControls` — botões play/pause, anterior, próximo
  - `ProgressBar` — barra de progresso com tempo decorrido/total
  - `StatusBar` — status e volume
- [x] Criar pasta `src/types/` com tipos compartilhados (Track, PlayerState, etc.)
- [x] Criar pasta `src/hooks/` para hooks customizados

### 1.2 Estado Global do Player
- [x] Implementar um contexto/hook `usePlayer` com:
  - `currentTrack: Track | null`
  - `isPlaying: boolean`
  - `volume: number` (0–100)
  - `currentTime: number`
  - `duration: number`
  - `playlist: Track[]`
  - Ações: `play`, `pause`, `next`, `prev`, `seek`, `setVolume`, `loadPlaylist`

### 1.3 Estilos
- [x] Refinar tema Winamp nostálgico (cores, bordas, sombras)
- [x] Criar CSS modules ou arquivos de estilo por componente
- [x] Responsividade básica (mobile-first, já que é Tauri + Web)

---

## Fase 2 — Player de Áudio 🎵

### 2.1 Engine de Áudio
- [x] Implementar player de áudio real usando `HTMLAudioElement`
- [x] Suporte a formatos: MP3, WAV, OGG, FLAC (via file picker nativo)
- [x] Controles: play, pause, stop, seek, próximo, anterior
- [x] Barra de progresso sincronizada com `timeupdate`
- [x] Ajuste de volume com slider
- [x] Hook `useAudioEngine` com callbacks de tempo, duração, erro
- [x] Hook `usePlayerWithAudio` integrando estado + áudio real

### 2.2 Gerenciamento de Playlist
- [x] Playlist funcional com lista de tracks
- [x] Destaque da música atual
- [x] Clique para tocar
- [x] Modos: repetir uma, repetir todas (repeatMode + UI)
- [x] Aleatório (shuffle) — hook e UI implementados
- [x] Arrastar para reordenar (drag & drop)

### 2.3 Metadados
- [x] Leitura de metadados de arquivos de áudio (ID3 tags)
  - Título, artista, álbum, duração
- [x] Exibição de "now playing" com arte do álbum (se disponível)

---

## Fase 3 — Google Drive Integration ☁️

### 3.1 Autenticação
- [x] Integração com Google OAuth 2.0 (Google Identity Services)
- [x] Login com conta Google (popup OAuth)
- [x] Armazenamento do token no Tauri Stronghold (fallback localStorage no navegador)
- [x] Login silencioso (restaura sessão automaticamente)
- [x] Logout com revogação de token

### 3.2 Navegação no Drive
- [x] Listar arquivos de áudio do Google Drive (filtro por MIME type + extensão)
- [x] Navegação por pastas com breadcrumbs clicáveis
- [x] Cache de lista de arquivos (TTL configurável, 5 min padrão, max 50 entradas)
- [x] Sincronização de playlist com pastas do Drive (salva/restaura)
- [x] Busca textual de músicas no Drive
- [x] Seleção múltipla de arquivos com checkbox
- [x] Botão "Recarregar" para bypass do cache

### 3.3 Streaming
- [x] Streaming de áudio do Google Drive sem token em query string
- [x] URLs de download direto (alt=media)
- [x] Buffer progressivo via Range requests integrado ao player (MediaSource + fallback)
- [x] Método `streamFile()` com suporte a byte ranges
- [x] Método `getFileMetadata()` para obter tamanho antes do streaming

---

## Fase 4 — Experiência Desktop (Tauri) 🖥️

### 4.1 Configuração Tauri
- [x] Inicializar `src-tauri/` com configuração básica
- [x] Ícone e identidade visual do app (ícones gerados)
- [x] Configurar permissões (Google Drive via CSP, sistema de arquivos local, diálogos)
- [x] Plugins Tauri configurados: dialog, fs, shell, notification, global-shortcut, log
- [x] Comandos nativos: `get_music_dir`, `get_system_info`

### 4.2 Funcionalidades Nativas
- [x] Abrir arquivos de áudio locais (file picker nativo Tauri + fallback HTML)
- [x] Arrastar e soltar arquivos/pastas do sistema (drag & drop na playlist)
- [x] Notificações do sistema (música atual, via Tauri plugin + fallback Notification API)
- [x] Media Session API (controles multimídia do SO: play/pause/next/prev)
- [x] Atalhos de teclado globais (MediaPlayPause, MediaNextTrack, MediaPrevTrack, MediaStop)

### 4.3 Build e Distribuição
- [x] Build para Linux (.deb, .AppImage)
- [x] Build para Windows (.msi, setup .exe via GitHub Actions)
- [x] Build para macOS (.dmg para x64/aarch64 via GitHub Actions)
- [x] Auto-update com Tauri Updater e artefatos assinados

---

## Fase 5 — Polimento ✨

### 5.1 Visual
- [x] Animações sutis (transição de faixas, pulso no play, fade-in-up, glow-pulse)
- [x] Visualizações de áudio (barras de frequência + waveform + equalizador visual, alternável)
- [x] Modo compacto / mini-mode (como o Winamp)
- [x] Temas (Winamp nostálgico, Escuro, Claro — alternável com persistência)
- [x] Equalizador visual (estético — 10 bandas com labels de frequência)

### 5.2 Performance
- [x] Virtual scrolling para playlists grandes
- [x] Lazy loading de metadados (processamento em lotes com prioridade nos primeiros 10)
- [x] Cache de áudio em IndexedDB (integrado ao useAudioEngine com fallback automático)

### 5.3 Qualidade de Vida
- [x] Histórico de reprodução (com persistência localStorage, max 100 entradas)
- [x] Favoritos (com persistência localStorage, toggle na playlist e controles)
- [x] Playlists customizáveis (salvar, carregar, renomear, excluir — com persistência)
- [x] Pesquisa na playlist (filtro textual por nome/artista)
- [x] Ordenação por nome, artista, duração (asc/desc)

---

## Fase 6 — Extras 🚀

### 6.1 Recursos Avançados
- [ ] Suporte a podcasts (RSS feeds)
- [ ] Letras sincronizadas (LRC)
- [ ] Crossfade entre músicas
- [ ] Gapless playback
- [ ] Controle remoto via HTTP (como o Winamp)

### 6.2 Integrações
- [ ] Last.fm scrobbling
- [ ] YouTube Music / Spotify import
- [ ] Download de músicas do Drive para cache offline

---

## Marcos (Milestones)

| Marco | Previsão | Entregas |
|-------|----------|----------|
| **M1** | Fase 1 | Componentes modulares, estado do player, tema visual |
| **M2** | Fase 2 | Player funcional com áudio real e playlist |
| **M3** | Fase 3 | Google Drive conectado, streaming funcional |
| **M4** | Fase 4 | App desktop com Tauri, builds para 3 SOs |
| **M5** | Fase 5 | UI polida, visualizações, performance |
| **M6** | Fase 6 | Recursos avançados e integrações |

---

## Como Contribuir / Trabalhar

```bash
# Desenvolvimento web
npm run dev

# Build
npm run build

# Preview
npm run preview

# Tauri (após configurar src-tauri/)
npm run tauri dev
npm run tauri build
```

> **Status atual:** Fases 1-4 concluídas. Fase 5 — Visual, Qualidade de Vida, Temas e Performance concluídos. Próximo passo: Fase 6 — Recursos avançados (podcasts, letras sincronizadas, crossfade, gapless, Last.fm, etc.) ou builds para distribuição (Fase 4.3).
