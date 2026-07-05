# Checklist de Qualidade e Release

Use este checklist antes de abrir uma tag ou publicar um instalador. Ele deve
ser tratado como gate de produto, nao como lista cosmetica.

## Bloqueadores de Release

Uma release nao deve ser publicada se qualquer item abaixo estiver aberto:

- [ ] MP3 local nao toca em build Tauri.
- [ ] `npm run release:validate` falha.
- [ ] `npm run build` falha.
- [ ] `npm run desktop:check` falha.
- [ ] App abre com tela branca.
- [ ] File picker nativo nao retorna arquivo tocavel.
- [ ] Updater aponta para repositorio ou chave errada.
- [ ] Chave privada do updater foi commitada ou exposta.
- [ ] Instalador principal da plataforma nao desinstala.
- [ ] Release notes nao avisam riscos conhecidos relevantes.

## Audio e Biblioteca

- [ ] Abrir arquivo MP3 individual.
- [ ] Abrir pasta com subpastas.
- [ ] Tocar por pelo menos 60 segundos.
- [ ] Pausar e retomar.
- [ ] Seek para frente e para tras.
- [ ] Trocar para proxima/anterior.
- [ ] Volume funciona.
- [ ] Arquivo invalido gera erro sem derrubar app.
- [ ] Nome com acentos e espacos funciona.
- [ ] Playlist grande continua responsiva.

## Persistencia Local

- [ ] Favoritos persistem apos reiniciar.
- [ ] Historico persiste apos reiniciar.
- [ ] Playlists salvas persistem apos reiniciar.
- [ ] Tema persiste apos reiniciar.
- [ ] Cache pode ser limpo pelo app ou por instrucao documentada.
- [ ] O painel Dados mostra versao, cache e dados locais.
- [ ] O painel Dados limpa cache sem quebrar a reproducao seguinte.
- [ ] O painel Dados limpa preferencias e reinicia em estado limpo.
- [ ] Dados locais restantes apos uninstall estao documentados.

## Seguranca

- [ ] `assetProtocol` tem escopo restrito.
- [ ] Permissoes de filesystem sao as minimas necessarias.
- [ ] `shell.open` nao permite protocolos perigosos.
- [ ] CSP foi revisada para fontes realmente usadas.
- [ ] Logs nao expoem secrets.
- [ ] Chave privada do updater nao aparece em diff, logs ou artefatos.

## Instaladores

### Linux

- [ ] `.deb` instala em Ubuntu limpo.
- [ ] `.deb` abre pelo launcher.
- [ ] `.deb` remove com `apt remove`.
- [ ] `.deb` purga configuracao empacotada com `apt purge`, quando aplicavel.
- [ ] `.rpm` instala e remove em distro RPM limpa.
- [ ] AppImage, se publicado, executa sem instalacao.
- [ ] AppImage, se publicado, e removido apagando o arquivo.

### Windows

- [ ] MSI instala em usuario comum.
- [ ] App abre pelo Start Menu.
- [ ] Update por cima nao duplica instalacao.
- [ ] Uninstall funciona em Settings > Apps.
- [ ] Atalhos somem apos uninstall.

### macOS

- [ ] DMG abre corretamente.
- [ ] App roda apos mover para `/Applications`.
- [ ] Remocao por Lixeira remove o binario.
- [ ] Notas avisam se app ainda nao e notarizado.

## Updater

- [ ] Versao instalada detecta nova release.
- [ ] Download de update conclui.
- [ ] App reinicia ou pede restart corretamente.
- [ ] Versao apos update confere com release publicada.
- [ ] Sem internet nao quebra o app.
- [ ] Endpoint com erro gera falha controlada.
- [ ] Hotfix pode ser publicado com nova tag.

## Documentacao Publica

- [ ] README informa formatos suportados.
- [ ] README informa instalacao por plataforma.
- [ ] README informa desinstalacao por plataforma.
- [ ] Release notes explicam mudancas.
- [ ] `CHANGELOG.md` foi atualizado.
- [ ] Checksums ou assinaturas foram publicados.
- [ ] Bugs conhecidos estao listados.
- [ ] Link para reportar bug esta visivel.
- [ ] Templates de issue cobrem bugs e problemas de instalacao/update.

## Comandos de Verificacao

```bash
npm ci
npm run release:validate
npm run check
npm run build
npm run desktop:check
```

Build completo de instaladores:

```bash
npm run desktop:build
npm run checksums
```

## Resultado Esperado

Uma release esta pronta quando:

- todos os bloqueadores estao fechados;
- o smoke test principal passou;
- artefatos foram gerados em CI;
- update foi testado a partir da versao anterior;
- desinstalacao foi testada no artefato recomendado;
- notas e instrucoes de remocao estao publicadas.
