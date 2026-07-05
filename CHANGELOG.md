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

### Fixed

- Reproducao de audio local via `blob:`, `asset:` e `http://asset.localhost`.
- URLs `blob:` de faixas locais nao sao mais revogadas enquanto ainda podem tocar.
- Fallback de faixa local quando metadados nao podem ser extraidos.

## [0.1.1]

### Notes

- Versao de desenvolvimento local antes do primeiro beta publico.
