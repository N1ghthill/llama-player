# Llama Player

Llama Player e um player desktop de musica local feito com React, TypeScript,
Vite e Tauri v2.

O objetivo do projeto e entregar um app instalavel, atualizavel, estavel e facil
de remover para usuarios finais.

## Status

Projeto em fase de preparacao para beta instalavel.

Funcionalidades principais:

- reproducao de arquivos locais;
- importacao de arquivos e pastas;
- playlists, favoritos e historico locais;
- temas e visualizador de audio;
- tela de dados locais para limpar cache e preferencias;
- builds desktop com Tauri;
- updater Tauri configurado.

Antes de usar como produto estavel, siga `ROADMAP.md` e `docs/PRODUCTIZATION.md`.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Build frontend:

```bash
npm run release:validate
npm run check
npm run build
```

Executar desktop em desenvolvimento:

```bash
npm run tauri dev
```

Validar build Tauri sem gerar instaladores:

```bash
npm run desktop:check
```

Gerar instaladores:

```bash
npm run desktop:build
```

Gerar checksums locais dos artefatos:

```bash
npm run checksums
```

## Instalacao

Os instaladores oficiais devem ser publicados em GitHub Releases.

Artefatos planejados:

- Linux: `.deb` e `.rpm`;
- Windows: MSI;
- macOS: DMG para Intel e Apple Silicon.

Enquanto nao houver release estavel, prefira builds beta e leia as notas da
release antes de instalar.

## Update

O app usa Tauri Updater com artefatos assinados. Para publicar updates:

1. configure os secrets do updater no GitHub;
2. crie uma tag SemVer;
3. aguarde o workflow gerar o draft;
4. confira os checksums anexados;
5. teste os artefatos;
6. publique o draft somente depois da validacao.

Detalhes em `docs/RELEASE.md`.

## Desinstalacao

### Linux `.deb`

```bash
sudo apt remove llama-player
sudo apt purge llama-player
```

### Linux `.rpm`

```bash
sudo rpm -e llama-player
```

### Windows

Remova em Settings > Apps > Installed apps.

### macOS

Mova o app de `/Applications` para a Lixeira.

Dados locais como cache, favoritos, historico e playlists podem permanecer nos
diretorios de dados do usuario. No app, use `Dados` para limpar cache,
favoritos, historico, playlists e tema antes de remover.

## Documentacao do Produto

- `ROADMAP.md`: roadmap completo para produto.
- `docs/PRODUCTIZATION.md`: plano de acao para instaladores, update e remocao.
- `docs/RELEASE.md`: processo de release.
- `docs/REVIEW-CHECKLIST.md`: checklist de qualidade e publicacao.
- `CHANGELOG.md`: historico de mudancas por release.
- `AGENTS.md`: instrucoes para agentes e manutencao tecnica.
- `.github/ISSUE_TEMPLATE/`: templates para bugs e problemas de instalacao/update.

## Seguranca

- A chave privada do updater nunca deve entrar no repositorio.
- Permissoes Tauri devem permanecer restritas.
- Releases publicas devem ser assinadas quando a plataforma exigir ou quando o
  produto sair de beta.
