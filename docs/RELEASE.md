# Release

Este processo existe para gerar builds instalaveis, assinadas pelo updater e
faceis de remover. Nao publique releases diretamente sem passar pelo checklist.

## Pre-requisitos

- Node 20.
- Rust toolchain estavel.
- Dependencias nativas do Tauri por sistema operacional.
- Secrets configurados no GitHub:
  - `TAURI_SIGNING_PRIVATE_KEY`;
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Chave do Updater

A chave publica fica em `src-tauri/tauri.conf.json`.

A chave privada deve ficar fora do repositorio. Caminho local usado atualmente:

```text
/home/irving/Documentos/llama-player-secrets/updater.key
```

Para build local assinado:

```bash
. "$HOME/.cargo/env"
export TAURI_SIGNING_PRIVATE_KEY="$(cat /home/irving/Documentos/llama-player-secrets/updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run desktop:build
```

Se a chave privada vazar, gere outra chave e publique uma release que atualize a
chave publica com uma comunicacao clara. Nao commitar secrets.

## Validacao Local

Execute antes de criar tag:

```bash
npm ci
npm run release:validate
npm run check
npm run build
npm run desktop:check
```

Para gerar instaladores locais:

```bash
npm run desktop:build
```

Para gerar checksums locais depois do build:

```bash
npm run checksums
```

Artefatos locais ficam em:

```text
src-tauri/target/release/bundle/
```

## Versionamento

Use tags SemVer:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Regras:

- `PATCH`: correcao pequena e compativel.
- `MINOR`: recurso novo compativel.
- `MAJOR`: mudanca incompativel em dados, update, instalador ou permissoes.
- Antes de `1.0.0`, publique como beta/prerelease se houver risco conhecido.

## GitHub Actions

O workflow `.github/workflows/release.yml` cria builds para:

- Linux;
- Windows;
- macOS Intel;
- macOS Apple Silicon.

Ele cria release draft. Publique o draft apenas depois que todos os jobs
terminarem e os artefatos forem revisados.

O workflow tambem:

- valida que a tag `vX.Y.Z` bate com `package.json`;
- valida consistencia entre `package.json`, `tauri.conf.json` e `Cargo.toml`;
- valida updater, bundle e `assetProtocol`;
- falha se `TAURI_SIGNING_PRIVATE_KEY` nao estiver configurada;
- publica checksums SHA-256 por plataforma no draft da release;
- marca releases geradas como prerelease enquanto o produto estiver em beta.
- usa templates de issue para capturar bugs de audio, instalacao e update.

Endpoint atual do updater:

```text
https://github.com/N1ghthill/llama-player/releases/latest/download/latest.json
```

Se o repositorio mudar, atualize `src-tauri/tauri.conf.json` antes de publicar.

## Checklist Antes de Publicar

- [ ] `npm run build` passou.
- [ ] `npm run release:validate` passou.
- [ ] `npm run desktop:check` passou.
- [ ] Workflow de release passou em todas as plataformas.
- [ ] Artefatos esperados existem no draft.
- [ ] `latest.json` foi gerado.
- [ ] Release notes explicam mudancas e riscos conhecidos.
- [ ] `CHANGELOG.md` foi atualizado.
- [ ] Checksums foram publicados ou anexados.
- [ ] O app mostra a versao esperada na barra de titulo ou em Dados.
- [ ] Instalacao foi testada em pelo menos uma maquina limpa.
- [ ] MP3 local toca por pelo menos 60 segundos.
- [ ] Update a partir da versao anterior foi testado.
- [ ] Desinstalacao foi testada para o artefato principal da plataforma.

## Instalacao e Remocao por Plataforma

### Linux `.deb`

Teste de instalacao:

```bash
sudo apt install ./llama-player_*_amd64.deb
```

Teste de remocao:

```bash
sudo apt remove llama-player
sudo apt purge llama-player
```

Confirme que o binario e o launcher foram removidos. Dados do usuario podem
continuar no diretorio de configuracao/cache; use o painel `Dados` para limpar
cache e preferencias antes da remocao quando necessario.

### Linux AppImage

AppImage nao e artefato padrao neste momento. So publique depois de validar
`linuxdeploy` e desktop integration.

Teste futuro:

```bash
chmod +x Llama.Player*.AppImage
./Llama.Player*.AppImage
```

Remocao esperada: apagar o arquivo AppImage e qualquer atalho criado por
integracao de desktop.

### Windows

Teste:

- instalar MSI em usuario comum;
- abrir pelo menu iniciar;
- atualizar instalando versao nova por cima;
- remover em Settings > Apps > Installed apps.

Antes de release estavel, planeje assinatura Authenticode para reduzir alertas.

### macOS

Teste:

- abrir DMG;
- mover app para `/Applications`;
- abrir o app;
- remover movendo para a Lixeira.

Antes de release estavel, planeje Developer ID e notarizacao.

## Rollback e Hotfix

- Nao substitua assets de uma tag publicada.
- Se uma release quebrou update ou reproducao, marque a release como problematica
  nas notas e publique hotfix com nova tag.
- Mantenha releases antigas disponiveis para downgrade manual.
- Se `latest.json` apontar para uma versao ruim, publique uma versao corrigida
  mais nova assim que possivel.

## Observacoes Atuais

- O updater ja esta configurado, mas precisa de teste real entre duas versoes
  instaladas.
- O app usa permissao de asset local com escopo restrito para diretorios comuns
  de musica, desktop e downloads.
- O build release usa LTO e `strip`; a primeira compilacao limpa pode demorar
  mais, mas gera pacotes menores.
