# AGENTS.md

Instrucoes para agentes trabalhando no Llama Player.

## Contexto do Projeto

Llama Player e um app desktop de musica local feito com React, TypeScript, Vite
e Tauri v2. O objetivo atual e transformar o projeto em produto instalavel,
atualizavel, estavel e facil de remover.

## Regras de Trabalho

- Trate o worktree como potencialmente sujo. Nao reverta alteracoes que voce nao fez.
- Antes de editar, leia os arquivos relacionados e rode `git status --short`.
- Prefira mudancas pequenas, rastreaveis e alinhadas ao estilo existente.
- Use `rg` para buscar arquivos/texto.
- Use `apply_patch` para edicoes manuais.
- Nao commitar secrets, chaves de updater, certificados ou caminhos privados novos.
- Nao ampliar permissoes do Tauri sem justificar em documentacao.
- Nao substituir binarios/assets de uma release ja publicada; use nova tag/hotfix.

## Comandos Padrao

```bash
npm ci
npm run release:validate
npm run check
npm run build
npm run desktop:check
npm run desktop:build
```

Use `npm run desktop:check` para validar frontend, backend Tauri e
configuracao sem gerar instaladores completos.

## Areas Sensiveis

### Audio Local

- Arquivos locais podem chegar como `blob:`, `asset:` ou `http://asset.localhost`.
- Nao trate `asset.localhost` como HTTP remoto cacheavel.
- Nao revogue `URL.createObjectURL` enquanto uma faixa ainda pode tocar.
- Falhas de metadados nao devem impedir a reproducao.

### Tauri e Seguranca

- `assetProtocol` deve permanecer com escopo restrito.
- CSP deve permitir apenas fontes necessarias.
- Permissoes de filesystem devem ser minimas.
- `shell.open` deve ser limitado a URLs seguras.
- Chave privada do updater deve ficar fora do repositorio.

### Release e Produto

- Consulte `docs/PRODUCTIZATION.md` antes de mudar instaladores/update.
- Consulte `docs/RELEASE.md` antes de alterar workflow, updater ou versionamento.
- Consulte `docs/REVIEW-CHECKLIST.md` antes de declarar uma release pronta.
- Atualize `ROADMAP.md` quando uma decisao de produto mudar.

## Criterios Antes de Finalizar Mudancas

- Para codigo TypeScript/Tauri: rode `npm run build`.
- Para configuracao Tauri/Rust: rode `npm run desktop:check`.
- Para mudancas apenas em docs: revise links, comandos e consistencia com os
  arquivos de configuracao atuais.
- Informe explicitamente qualquer teste que nao foi executado.

## Convencoes de Documentacao

- Documente processos de produto em portugues.
- Use comandos copiaveis.
- Separe o que e obrigatorio para release do que e recomendacao futura.
- Inclua sempre instalacao, update, rollback e desinstalacao quando o assunto for release.
