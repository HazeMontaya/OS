# OS — Local-First Cognitive Operating Environment

OS is a greenfield cognitive desktop platform: local-first, model-independent, observable and designed around a living temporal knowledge graph.

## Product thesis

OS does not treat chat as the primary interface. Knowledge, memory, agents, tools, model activity and system state are first-class objects in a navigable Cognitive Void.

The Spatial OS architecture makes this explicit: the visual world is a real-time projection of canonical core state and traceable system events, not a decorative animation layer.

## Core loop

`Observe → Understand → Remember → Connect → Reason → Act → Evaluate → Learn → Reorganize`

## Stack

- Rust kernel
- Tokio async runtime target
- Tauri 2 desktop shell
- React 19 + TypeScript
- Babylon.js 9 cognitive visualization
- WebGPU/WGSL preferred rendering path with graceful WebGL fallback
- SQLite/FTS5 as canonical persistence target
- Embedded vector retrieval target
- Temporal knowledge graph
- Capability-based agent/tool runtime
- Local and optional cloud model gateway
- Versioned event/state bridge between core and experience layer

## Repository layout

- `apps/desktop` — commercial desktop client and Cognitive Void
- `crates/kernel` — privileged cognitive kernel
- `crates/event-ledger` — append-oriented event foundation
- `crates/memory` — memory compilation and lifecycle
- `crates/knowledge-graph` — temporal graph foundation
- `crates/contracts` — typed IPC/domain contracts
- `docs` — product, architecture, security and roadmap

## Spatial architecture

The detailed implementation contract is maintained in:

- [`docs/architecture/SPATIAL_OS_ARCHITECTURE.md`](docs/architecture/SPATIAL_OS_ARCHITECTURE.md) — full system/experience architecture
- [`docs/architecture/IMPLEMENTATION_ROADMAP.md`](docs/architecture/IMPLEMENTATION_ROADMAP.md) — implementation milestones and acceptance criteria
- [`docs/architecture/ADR-001-SPATIAL-STACK.md`](docs/architecture/ADR-001-SPATIAL-STACK.md) — accepted stack decision and guardrails

Core rules: the kernel must remain headless-capable; the renderer must not own canonical state; visual activity must correspond to real events; models and tools remain replaceable; capability boundaries cannot be bypassed by agents or UI code.

## Windows Git synchronization

The canonical local working directory is `S:\OS` and the canonical remote is `https://github.com/HazeMontaya/OS.git` on branch `main`.

The two root-level command files use **strict source-wins mirror semantics**. The selected source replaces the destination repository rather than being merged with it.

### Online → local

`GIT-DOWNLOAD-ONLINE-NACH-S-OS.cmd` treats GitHub `origin/main` as authoritative.

The command copies itself to `%TEMP%`, creates a completely fresh verified clone at `S:\OS.__incoming__`, enables Git long-path handling, synchronizes submodules, hard-resets and cleans the clone, verifies that `HEAD` exactly matches `origin/main`, then swaps the old `S:\OS` out and activates the new clone. Only after the new clone is active is the old `S:\OS.__old__` removed.

This means old local tracked files, ignored build files, runtime data, untracked files and stale `.git` state do not survive a successful download mirror.

### Local → online

`GIT-UPLOAD-S-OS-NACH-ONLINE.cmd` treats the current filesystem content under `S:\OS` as authoritative.

The command does **not** push arbitrary local Git history. It creates a fresh temporary Git index from the current filesystem, respecting `.gitignore`, then writes a new repository tree and creates a mirror commit directly on top of the current `origin/main`. The resulting online tree therefore removes every old online file that is not part of the current clean local source tree.

Before the tree is written, every candidate upload file is checked. Files at or above **95 MiB** are automatically excluded from normal GitHub Git synchronization, recorded in `S:\OS\.os-sync-excluded-local.txt`, and kept local. This gives safety margin below GitHub's 100 MiB per-file Git limit. The local path is also added to `.git/info/exclude` so subsequent syncs do not repeatedly stage it.

`.gitignore` additionally excludes data that should not belong to the source repository, including:

- `node_modules`, Rust `target`, frontend/build caches and generated Tauri output
- local cognition/runtime data, logs, SQLite/Lance databases and dumps
- model weights such as GGUF, ONNX, SafeTensors, checkpoints and PyTorch/HDF5 weights
- generated archives, disk images and installer packages such as ZIP, 7z, RAR, ISO, VHD/VHDX, MSI/MSIX and APPX bundles
- secrets and private key material

These exclusions are intentional: the online repository is an exact mirror of the **versionable OS source tree**, not of machine-local runtime state, downloaded models or generated build artifacts.

The upload first fetches `origin/main` and creates its mirror commit with that exact remote commit as parent. If the remote changes before push, Git rejects the update rather than silently overwriting a newer remote change. No rebase or merge is used to reintroduce old online files.

Both commands require Git for Windows and valid GitHub credentials for this private repository. The download command is destructive to the old local repository after the fresh clone has been verified; the upload command is destructive to files in the current online tree that are absent from the clean local source tree.

## Start

Prerequisites: current stable Rust, Node.js, pnpm, Tauri platform prerequisites.

```bash
pnpm install
pnpm dev
```

Rust workspace check:

```bash
cargo check --workspace
```

Full repository validation:

```bash
pnpm check
```

## CI validation

GitHub Actions validates:

- Rust formatting, core tests and Clippy on Ubuntu
- TypeScript type checking and the production frontend build
- Windows desktop compilation for the real Tauri application
- Protocol Buffers compiler availability for Lance/DataFusion dependencies

## Status

This repository was intentionally reset to a clean commercial-grade architecture on 2026-08-27. Previous implementation history is preserved on `legacy-before-greenfield-2026-08-27`.

The Spatial OS architecture is now the target architecture for continued development.
