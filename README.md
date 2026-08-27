# OS — Local-First Cognitive Operating Environment

OS is a Windows-first cognitive desktop environment with a Rust kernel, Tauri 2 shell, React/TypeScript experience layer and a Babylon.js WebGPU-first spatial cognition renderer.

The UI is not the canonical state. Memory, graph, model activity and system events live in the core and are projected into the Black-Gold Cognitive Void.

## Windows: first boot

Canonical local repository: `S:\OS`

1. If GitHub contains the newest source, run `GIT-DOWNLOAD.cmd` first.
2. Run `OS-SETUP.cmd` once on the machine.
3. Run `OS-START.cmd` whenever you want to start OS.

`OS-SETUP.cmd` automatically checks/installs the Windows development/runtime prerequisites, configures the local-first Ollama model runtime, pulls the default chat and embedding models, installs repository dependencies, validates Rust/TypeScript and builds a real release executable.

A successful setup produces:

`S:\OS\target\release\os-desktop.exe`

`OS-START.cmd` detects a missing or stale release executable and rebuilds it before launch, so the binary cannot silently lag behind the current Git `HEAD`.

Other operational commands:

- `OS-DOCTOR.cmd` — machine, runtime, model and toolchain diagnostics.
- `OS-BUILD.cmd` — validated Windows release build.
- `OS-BUILD.cmd --installer` — build an NSIS installer into ignored local `Artifacts\Windows`.
- `OS-START.cmd -Dev` — Tauri development mode.
- `OS-START.cmd -Rebuild` — force a release rebuild and then launch.

Full Windows procedure: [`docs/WINDOWS_RUNBOOK.md`](docs/WINDOWS_RUNBOOK.md).

## Default local AI runtime

The automatic Windows setup uses Ollama's OpenAI-compatible local endpoint by default:

- server: `http://127.0.0.1:11434`
- chat model: `llama3.2:3b`
- embedding model: `nomic-embed-text`

The corresponding `OS_LLAMA_*` and `OS_EMBED_*` user environment values are only created when no user override already exists. `.env.example` documents all runtime variables. Cloud model providers remain optional.

OS itself can boot when the model endpoint is unavailable; the UI remains usable and cognitive turns report the model transport problem until a compatible endpoint is restored.

## Core loop

`Observe → Understand → Remember → Connect → Reason → Plan → Act → Verify → Learn → Reorganize`

## Stack

- Rust + Tokio cognitive core
- Tauri 2 / Microsoft Edge WebView2
- React 19 + TypeScript
- Babylon.js 9
- WebGPU/WGSL primary renderer with WebGL fallback
- GPU-resident cognitive node/relation buffers on capable hardware
- semantic LOD and GPU visibility evaluation
- BVH spatial picking
- SQLite / FTS5 canonical persistence
- Lance/vector semantic retrieval
- temporal knowledge graph
- capability-based agent/tool/automation foundations
- local and optional cloud model gateways

## Spatial renderer status

The production renderer is **GPU Spatial Phase 4**.

On WebGPU-capable systems it uses packed node/edge storage buffers, WGSL semantic visibility/LOD and direct storage-to-vertex rendering without per-frame graph readback. Spatial interaction uses a BVH instead of a large field of invisible pick meshes. The validated Phase-3 batched renderer remains the deterministic fallback when WebGPU/compute initialization is unavailable.

Experimental Phase-5 draw compaction/indirect rendering is intentionally not required for launch readiness. It must pass the same Windows/Tauri gates before it can replace the Phase-4 production path.

## Repository layout

- `apps/desktop` — Tauri/React Black-Gold desktop and Cognitive Void
- `apps/cli` — runtime/doctor CLI
- `apps/devtools` — developer diagnostics
- `crates/kernel` — cognitive kernel
- `crates/event-ledger` — append-oriented event foundation
- `crates/memory` — memory lifecycle
- `crates/knowledge-graph` — temporal graph
- `crates/semantic-index` — semantic/vector index
- `crates/model-gateway` — local/cloud model clients
- `crates/agents`, `crates/tools`, `crates/automation`, `crates/runtime`, `crates/system` — execution/runtime foundations
- `packages/*` — protocol, renderer, visualization and design-system contracts
- `docs` — architecture, security, visual system and operational runbooks

## Architecture contracts

Key documents include:

- [`docs/OS_FINAL_PRODUCT_SPEC.md`](docs/OS_FINAL_PRODUCT_SPEC.md)
- [`docs/architecture/SPATIAL_OS_ARCHITECTURE.md`](docs/architecture/SPATIAL_OS_ARCHITECTURE.md)
- [`docs/architecture/IMPLEMENTATION_ROADMAP.md`](docs/architecture/IMPLEMENTATION_ROADMAP.md)
- [`docs/architecture/ADR-001-SPATIAL-STACK.md`](docs/architecture/ADR-001-SPATIAL-STACK.md)
- [`docs/GPU_SPATIAL_PHASE_4_GRAPH.md`](docs/GPU_SPATIAL_PHASE_4_GRAPH.md)
- [`docs/WINDOWS_RUNBOOK.md`](docs/WINDOWS_RUNBOOK.md)

Core rules: the kernel remains headless-capable; the renderer never owns canonical state; visual activity corresponds to real state/events; models and tools remain replaceable; capability boundaries cannot be bypassed by agent or UI code.

## Git mirror synchronization

The canonical remote is `HazeMontaya/OS`, branch `main`, and the canonical Windows working directory is `S:\OS`.

- `GIT-DOWNLOAD.cmd`: **online source wins**. It prepares a fresh verified clone, atomically replaces `S:\OS`, and removes stale local source/build/runtime remnants.
- `GIT-UPLOAD.cmd`: **local source wins**. It writes a fresh repository tree from the current versionable `S:\OS` filesystem and replaces the online source tree. GitHub's current `origin/main` is used as the parent so a concurrent online update causes the push to fail instead of being silently overwritten.

Files at or above 95 MiB plus build output, models, runtime databases, cognition data, archives/installers and secrets are excluded from source synchronization.

**Important:** after online implementation work, run `GIT-DOWNLOAD.cmd` before any local source-wins upload. Otherwise an older local filesystem can intentionally remove newer online source.

## Manual development

After prerequisites are installed:

```bash
pnpm install --no-frozen-lockfile
pnpm dev
```

Release executable without bundling:

```bash
pnpm build:app
```

Workspace validation:

```bash
cargo check --workspace
pnpm typecheck
cargo run -p os-cli -- doctor
```

## CI and release validation

Core CI validates:

- Rust formatting, tests, Clippy, CLI doctor and developer diagnostics
- TypeScript workspace typecheck
- production frontend build
- Windows PowerShell bootstrap syntax
- a real Windows Tauri release executable

The Windows job uploads `target/release/os-desktop.exe` as a workflow artifact.

`Windows Release Package` can be started manually or by a `v*` tag. It produces both the release executable and an NSIS installer artifact.

## Status

The source tree was reset to a clean greenfield architecture on 2026-08-27; the previous implementation is preserved on `legacy-before-greenfield-2026-08-27`.

The current launch target is the validated Black-Gold Phase-4 desktop. Higher GPU phases remain isolated until they pass the same production gates.
