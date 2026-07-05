# Plano de Acao para Produto Instalavel

Este documento descreve o caminho pragmatico para transformar o Llama Player em
um produto desktop distribuivel para usuarios finais.

## Principios

- Instalacao deve ser simples e reversivel.
- Update deve ser assinado, testado e recuperavel.
- O app deve funcionar offline para reproducao local.
- Dados do usuario devem ficar locais e documentados.
- Releases devem ser reproduziveis e nunca depender de passos manuais ocultos.
- Uma versao publicada nao deve ter seus binarios substituidos; publique hotfix.

## Fase 1 - Base Tecnica Confiavel

Resultado esperado: o app toca MP3 local de forma estavel e tem build repetivel.

1. Congelar uma branch de release.
2. Rodar `npm ci`, `npm run check`, `npm run build` e `npm run desktop:check`.
3. Testar manualmente:
   - abrir um MP3 por arquivo;
   - abrir uma pasta;
   - reproduzir por pelo menos 60 segundos;
   - trocar de faixa;
   - pausar/retomar;
   - fechar e abrir novamente.
4. Corrigir qualquer erro de audio antes de investir em empacotamento.
5. Registrar bugs conhecidos na release notes.

## Fase 2 - Instaladores

Resultado esperado: cada sistema tem um artefato recomendado e uma forma clara de remover.

| Sistema | Artefato recomendado | Remocao esperada | Observacao |
|---|---|---|---|
| Linux Debian/Ubuntu | `.deb` | `apt remove` / `apt purge` | Melhor integracao com dependencias |
| Linux RPM | `.rpm` | `rpm -e llama-player` | Validar em distro RPM limpa |
| Linux generico | AppImage | apagar arquivo AppImage | Futuro; publicar apenas se testado |
| Windows | MSI | Apps & Features | Planejar assinatura Authenticode |
| macOS | DMG | mover app para Lixeira | Planejar Developer ID/notarizacao |

Checklist por artefato:

- instala em maquina limpa;
- abre pelo menu/atalho do sistema;
- reproduz MP3 local;
- fecha sem processo preso;
- atualiza por cima da versao anterior;
- desinstala sem deixar binario executavel;
- dados locais restantes sao documentados e removiveis manualmente.

## Fase 3 - Updater

Resultado esperado: update seguro de uma versao publicada para outra.

1. Guardar chave privada fora do repositorio.
2. Configurar secrets no GitHub:
   - `TAURI_SIGNING_PRIVATE_KEY`;
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. Garantir que `src-tauri/tauri.conf.json` aponta para o repositorio correto.
4. Criar release draft por tag.
5. Baixar e testar artefatos antes de publicar.
6. Publicar draft somente depois que todos os jobs terminarem.
7. Testar update usando uma versao instalada anterior.
8. Em caso de release quebrada, publicar hotfix; nao substituir binarios da tag.

## Fase 4 - Assinatura e Confianca

Resultado esperado: reduzir alertas de seguranca dos sistemas operacionais.

- Windows: planejar certificado Authenticode antes de divulgar fora do beta.
- macOS: usar Apple Developer ID e notarizacao antes de release estavel.
- Linux: publicar checksums SHA-256 e, idealmente, assinatura dos artefatos.
- GitHub Releases: manter changelog, checksums e assets por plataforma.

## Fase 5 - QA de Release

Resultado esperado: uma release nao sai sem passar por smoke test.

Smoke test minimo:

- primeira execucao sem configuracao;
- abrir arquivo MP3;
- abrir pasta com subpastas;
- reproduzir, pausar, seek e trocar faixa;
- favoritos e playlist persistem;
- update detecta nova versao;
- app reinicia depois do update;
- uninstall remove o app;
- cache/preferencias remanescentes estao documentados.

Ambientes recomendados:

- Ubuntu LTS limpo;
- Windows 10 ou 11 limpo;
- macOS Intel;
- macOS Apple Silicon.

## Fase 6 - Suporte e Remocao Limpa

Resultado esperado: usuario final consegue resolver problema sem depender do desenvolvedor.

Documentar:

- onde baixar;
- qual instalador escolher;
- como atualizar;
- como desinstalar;
- como limpar cache e preferencias;
- onde ficam logs;
- como reportar bug com versao e sistema operacional.

Dados locais ja mapeados:

- IndexedDB/cache de audio;
- `localStorage` de playlists/favoritos/historico/tema;

Dados locais ainda a mapear antes de `1.0.0`:

- logs do plugin Tauri;
- diretorios de configuracao do app por sistema.

## Politica de Canais

- `stable`: releases recomendadas para usuarios finais.
- `beta`: releases com novos recursos, aceitando regressao moderada.
- `nightly/dev`: apenas para desenvolvimento; nao prometer compatibilidade de update.

Enquanto o projeto estiver antes de `1.0.0`, use `beta` para releases publicas.

## Decisoes Pendentes

- Assinatura Windows/macOS.
- Canal beta separado ou apenas prerelease no GitHub.
- Publicacao em lojas ou somente GitHub Releases.
- Politica de retencao/limpeza automatica do cache local.
