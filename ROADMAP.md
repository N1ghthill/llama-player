# Llama Player - Roadmap de Produto

Este roadmap organiza o projeto para sair de um app local funcional e chegar em
um produto desktop instalavel, atualizavel, estavel e facil de remover.

Stack atual: React 18, TypeScript, Vite, Tauri v2.

## Objetivo do Produto

O Llama Player deve ser um player de musica local para usuarios finais que:

- instala sem exigir conhecimento tecnico;
- reproduz arquivos locais de forma confiavel;
- atualiza sem quebrar bibliotecas ou preferencias;
- respeita o sistema operacional e suas permissoes;
- pode ser removido sem deixar servicos, processos ou arquivos grandes para tras;
- tem releases reproduziveis, assinadas e testadas.

## Estado Atual

### Concluido

- Player de audio com `HTMLAudioElement`.
- Importacao de arquivos locais e pastas.
- Playlist, favoritos, historico, temas e visualizador.
- Build Tauri v2 para desktop.
- Workflow de release via GitHub Actions.
- Updater Tauri configurado com endpoint de GitHub Releases.
- `assetProtocol` habilitado com escopo restrito para reproduzir arquivos locais.
- Identifier estavel definido como `com.github.n1ghthill.llama-player`.
- CI de validacao criado para TypeScript, build frontend e Tauri no-bundle.
- Release workflow valida tag, exige chave do updater e anexa checksums SHA-256.
- Script `release:validate` verifica versoes, updater, bundle e asset scope.
- Versao visivel no app via build Vite.
- Painel de dados locais para limpar cache, preferencias, favoritos, historico e playlists.
- Templates de issue para bugs e problemas de instalacao/update.
- Build release otimizado: binario Linux reduzido para cerca de 7.4 MB e `.deb` para cerca de 3.4 MB.
- Build local validado com `npm run build` e `npm run desktop:check`.

### Ainda nao pronto para produto

- Releases ainda precisam de politica formal de versionamento, QA e rollback.
- Instaladores precisam ser testados em maquinas limpas por sistema operacional.
- Assinatura de codigo e notarizacao ainda precisam ser definidas por plataforma.
- Desinstalacao precisa ser validada com checklist por artefato.
- Observabilidade local ainda e limitada para diagnostico de falhas de usuarios.

## Marco P0 - Congelar Base Estavel

Meta: ter uma base tecnica confiavel antes de distribuir para usuarios finais.

- [ ] Resolver ou reclassificar todos os itens criticos de `docs/REVIEW-CHECKLIST.md`.
- [ ] Garantir que `npm run build` passe em toda branch de release.
- [ ] Garantir que `npm run desktop:check` passe localmente.
- [ ] Criar fixture manual com pelo menos 10 arquivos de audio:
  - MP3 comum;
  - MP3 com ID3;
  - arquivo com acentos no nome;
  - arquivo em subpasta;
  - arquivo grande;
  - arquivo corrompido;
  - WAV;
  - OGG/Opus;
  - FLAC;
  - M4A/AAC quando suportado pela plataforma.
- [ ] Testar abrir arquivo, abrir pasta, tocar, pausar, buscar, proxima, anterior e volume.
- [x] Definir politica inicial de armazenamento local:
  - cache de audio;
  - playlists;
  - favoritos;
  - historico;
  - logs.

## Marco P1 - Instaladores Confiaveis

Meta: entregar artefatos instalaveis e removiveis em Linux, Windows e macOS.

### Linux

- [ ] Manter `.deb` com dependencias declaradas.
- [x] Gerar `.rpm` para distribuicoes compatveis.
- [ ] Validar instalacao com `apt install ./arquivo.deb` em VM limpa.
- [ ] Validar remocao com `apt remove llama-player`.
- [ ] Validar remocao completa documentada com `apt purge llama-player` quando aplicavel.
- [ ] Publicar AppImage apenas se `linuxdeploy` e a experiencia de desktop integration/remocao forem validados.
- [x] Documentar diferenca entre `.deb` e `.rpm` para usuarios.

### Windows

- [ ] Gerar instalador MSI.
- [ ] Definir se havera NSIS/setup `.exe`; se houver, documentar uninstall no Painel de Controle.
- [ ] Testar instalacao como usuario comum.
- [ ] Testar instalacao em caminho padrao.
- [ ] Testar uninstall pelo "Apps & Features".
- [ ] Validar que atualizacao substitui versao anterior sem duplicar entrada.
- [ ] Planejar assinatura Authenticode antes de release publico amplo.

### macOS

- [ ] Gerar `.dmg` para Intel e Apple Silicon.
- [x] Corrigir identifier para formato estavel: `com.github.n1ghthill.llama-player`.
- [ ] Testar copia para `/Applications`.
- [ ] Testar remocao arrastando o app para a Lixeira.
- [ ] Planejar assinatura Developer ID e notarizacao antes de release publico amplo.
- [ ] Documentar limitacoes enquanto app nao estiver notarizado.

## Marco P2 - Updater Seguro

Meta: atualizar sem expor usuarios a builds falsas ou quebradas.

- [ ] Manter chave privada do updater fora do repositorio.
- [ ] Rotacionar chave se houver suspeita de vazamento.
- [ ] Confirmar que `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` existem no GitHub.
- [ ] Publicar apenas releases assinadas.
- [ ] Gerar `latest.json` em releases publicadas, nao em drafts abandonados.
- [ ] Testar update de `vX.Y.Z` para `vX.Y.Z+1` em cada sistema operacional.
- [ ] Testar comportamento quando nao ha internet.
- [ ] Testar comportamento quando o endpoint retorna erro.
- [ ] Definir politica de rollback:
  - despublicar release quebrada;
  - publicar hotfix;
  - manter changelog claro;
  - nunca substituir binario de uma tag publicada.

## Marco P3 - Estabilidade e QA

Meta: evitar regressao em audio, biblioteca local e empacotamento.

- [ ] Criar teste automatizado minimo para servicos puros:
  - parser LRC;
  - cache metadata;
  - funcoes de ordenacao/filtro quando extraidas.
- [ ] Adicionar lint ou checagem TypeScript dedicada (`tsc --noEmit`) se separar do build.
- [ ] Adicionar smoke test manual por release:
  - primeira execucao;
  - abrir arquivo MP3;
  - abrir pasta;
  - tocar por 60 segundos;
  - trocar faixa;
  - fechar/reabrir;
  - atualizar;
  - desinstalar.
- [ ] Testar nomes de arquivo com espaco, acento e caracteres especiais.
- [ ] Testar biblioteca com 1.000+ faixas.
- [ ] Testar memoria apos importar e tocar varias faixas.
- [ ] Garantir que falha em uma faixa nao derruba o app.

## Marco P4 - Seguranca e Privacidade

Meta: minimizar permissoes e ser claro com o usuario.

- [ ] Manter escopo de `assetProtocol` restrito.
- [ ] Evitar permissao de leitura ampla no filesystem.
- [ ] Permitir `shell.open` apenas para `https://` e `http://` confiavel quando necessario.
- [ ] Revisar CSP antes de release publico.
- [ ] Documentar quais dados ficam locais.
- [ ] Documentar como limpar cache e preferencias.
- [ ] Nao enviar telemetria sem consentimento explicito.
- [ ] Garantir que logs nao gravam caminhos sensiveis em relatorios publicos.

## Marco P5 - Experiencia de Usuario Final

Meta: reduzir suporte causado por instalacao, update e remocao.

- [ ] Criar README publico com:
  - download recomendado por sistema;
  - instalacao;
  - update;
  - desinstalacao;
  - onde ficam dados locais;
  - formatos suportados.
- [x] Criar template de release com checksums.
- [ ] Criar changelog por versao.
- [x] Adicionar versao atual na janela e no painel de dados locais.
- [ ] Mostrar mensagens de erro acionaveis quando uma faixa nao toca.
- [x] Adicionar acao visivel para limpar cache e dados locais.
- [ ] Definir canal beta separado do canal estavel.

## Marco P6 - Distribuicao Publica

Meta: publicar com processo repetivel.

- [ ] Configurar protecao da branch principal.
- [ ] Exigir CI verde antes de tag.
- [ ] Usar tags semanticas `vMAJOR.MINOR.PATCH`.
- [ ] Criar release draft automaticamente.
- [ ] Revisar artefatos manualmente antes de publicar.
- [ ] Publicar apenas depois de testar instalacao em pelo menos uma maquina limpa.
- [ ] Manter releases antigas disponiveis para downgrade manual.
- [ ] Definir processo de suporte para issues de instalacao/update.

## Versionamento

Use SemVer:

- `PATCH`: bugfix seguro, sem mudanca de dados.
- `MINOR`: novo recurso compativel.
- `MAJOR`: mudanca incompativel em dados, preferencias, updater ou instalador.

Antes de `1.0.0`, trate qualquer release publica como potencialmente instavel e use
notas claras. A meta recomendada e:

- `0.2.0`: primeiro beta instalavel com update testado.
- `0.3.0`: beta com uninstall/cache/documentacao validados.
- `1.0.0`: primeira versao estavel para usuarios finais.

## Comandos Principais

```bash
npm ci
npm run release:validate
npm run check
npm run build
npm run desktop:check
npm run desktop:build
npm run checksums
```

## Criterio de Pronto para Release Estavel

Um release so deve ser marcado como estavel quando:

- build passa em Linux, Windows e macOS;
- artefatos instalam e removem corretamente;
- updater instala a proxima versao em todas as plataformas suportadas;
- chave privada do updater nao esta no repositorio;
- changelog e checksums foram publicados;
- smoke test manual foi executado;
- nao ha bug conhecido que impeca reproducao de MP3 local.
