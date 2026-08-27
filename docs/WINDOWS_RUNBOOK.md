# OS Windows Runbook

This is the operational contract for starting OS from the canonical Windows repository at `S:\OS`.

## 1. Synchronize source first

When the online repository contains newer work, run:

`GIT-DOWNLOAD.cmd`

This replaces the local `S:\OS` mirror with a clean verified clone of `origin/main`. Do this before any local source-wins upload; otherwise an older local mirror can intentionally replace newer online files.

## 2. First machine setup

Run:

`OS-SETUP.cmd`

The setup is idempotent: already installed components are detected and reused. It establishes the source/build/runtime prerequisites required by the current OS desktop:

- Git for Windows
- Node.js LTS
- pnpm 10
- Rust stable MSVC toolchain, `rustfmt`, and `clippy`
- Microsoft Visual Studio 2022 C++ Build Tools with the VCTools workload
- Microsoft Edge WebView2 Runtime
- a local Protocol Buffers compiler under `.tools/protoc` when `protoc` is not already available
- Ollama as the default local-first OpenAI-compatible model runtime
- `llama3.2:3b` as the default chat model
- `nomic-embed-text` as the default embedding model
- JavaScript workspace dependencies

It persists the following user environment defaults only when the user has not already supplied overrides:

- `OS_LLAMA_SERVER=http://127.0.0.1:11434`
- `OS_LLAMA_MODEL=llama3.2:3b`
- `OS_EMBED_SERVER=http://127.0.0.1:11434`
- `OS_EMBED_MODEL=nomic-embed-text`

The Rust workspace, TypeScript workspace, OS CLI doctor and a real Tauri release build are then validated. A successful setup produces:

`S:\OS\target\release\os-desktop.exe`

and records the source commit used for that executable in the ignored local file:

`.os-local\release-head.txt`

### Setup switches

PowerShell switches may be passed through the CMD wrapper:

- `OS-SETUP.cmd -SkipModels` — do not pull the two default Ollama models.
- `OS-SETUP.cmd -SkipBuild` — prepare prerequisites/runtime without building the release executable.
- `OS-SETUP.cmd -Launch` — launch OS after successful setup.

If Visual Studio Build Tools or WebView2 has just been installed and Windows has not made the component visible to the current session yet, setup stops rather than pretending the machine is ready. Restart Windows once and run `OS-SETUP.cmd` again; completed components are reused.

## 3. Start OS

Run:

`OS-START.cmd`

The launcher:

1. loads the local runtime defaults,
2. ensures the Ollama API is running when Ollama is installed,
3. compares the current Git `HEAD` with `.os-local/release-head.txt`,
4. automatically rebuilds the release executable if it is missing or stale,
5. starts `target\release\os-desktop.exe`.

Useful switches:

- `OS-START.cmd -Dev` — run Tauri development mode instead of the release executable.
- `OS-START.cmd -Rebuild` — force a fresh release executable before launching.

OS itself can open even when the local model endpoint is temporarily unavailable. In that state the UI remains usable but a cognitive turn reports a model transport error until a compatible endpoint is online.

## 4. Diagnose the machine

Run:

`OS-DOCTOR.cmd`

Doctor checks:

- release executable
- WebView2
- Ollama command and local HTTP API
- configured chat and embedding models
- Git
- Node.js
- pnpm
- Rust/Cargo
- Protocol Buffers compiler
- MSVC C++ Build Tools
- JavaScript dependencies

Blocking runtime/toolchain failures produce a non-zero exit status and point back to `OS-SETUP.cmd`.

## 5. Build manually

Release executable:

`OS-BUILD.cmd`

Windows NSIS installer:

`OS-BUILD.cmd --installer`

The installer is copied to the ignored local artifact directory:

`Artifacts\Windows\`

The Tauri bundle is intentionally NSIS-first. This avoids making MSI/VBSCRIPT an unnecessary prerequisite for the normal OS Windows package. The installer uses Tauri's WebView2 download-bootstrapper mode when WebView2 is absent.

## 6. Model/runtime overrides

The launcher and setup respect existing user-level environment variables. To use another OpenAI-compatible local server, override the four `OS_*` model variables before launch or persist your own user values. `.env.example` documents the supported variables.

Cloud providers remain optional. Supported environment/API-key names include:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `OLLAMA_API_KEY`

Never commit actual credentials.

## 7. CI/release guarantee

`Core CI` now parses all Windows PowerShell bootstrap files and builds the real Windows release executable, not only a Rust check. The resulting `os-desktop.exe` is uploaded as a workflow artifact.

`Windows Release Package` can be started manually or by a `v*` tag. It validates the workspace, builds the release executable, bundles the NSIS installer and uploads both outputs as GitHub Actions artifacts.

## Recovery

If the local source tree is uncertain, do not repair it by manually mixing copies. Use `GIT-DOWNLOAD.cmd` for a fresh verified `origin/main` mirror, then rerun `OS-SETUP.cmd`.
