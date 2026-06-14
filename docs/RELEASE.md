# Release

## Local Linux build

```bash
. "$HOME/.cargo/env"
export TAURI_SIGNING_PRIVATE_KEY="$(cat /home/irving/Documentos/llama-player-secrets/updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

Artifacts are written to `src-tauri/target/release/bundle/`.

## Updater signing key

The updater public key is stored in `src-tauri/tauri.conf.json`.

The private key is intentionally outside the repository:

```text
/home/irving/Documentos/llama-player-secrets/updater.key
```

For GitHub Actions, create these repository secrets:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

`TAURI_SIGNING_PRIVATE_KEY` must contain the private key file content. The password can be empty if the key was generated without a password.

## GitHub release

Push a version tag to build Linux, Windows and macOS bundles:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a draft release. Publish the draft after all matrix jobs finish
so `latest.json` is available to the updater endpoint.

The updater endpoint is configured for:

```text
https://github.com/N1ghthill/llama-player/releases/latest/download/latest.json
```

If the GitHub repository owner/name is different, update `src-tauri/tauri.conf.json` before publishing.
