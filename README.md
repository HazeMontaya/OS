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

The two root-level command files use **source-wins mirror semantics**. The selected source always replaces and cleans the destination repository state.

- `GIT-DOWNLOAD-ONLINE-NACH-S-OS.cmd` — GitHub `origin/main` is authoritative. The command fetches the current online branch, resets local `S:\OS` hard to that commit and runs `git clean -ffdx`, removing local tracked changes, untracked files and ignored build/output files that are not part of the online repository. Submodules are also reset and cleaned.
- `GIT-UPLOAD-S-OS-NACH-ONLINE.cmd` — local `S:\OS` is authoritative. The command stages all tracked changes and deletions, creates a sync commit when required, fetches the current remote SHA and replaces `origin/main` with the local Git state using `--force-with-lease`. There is no rebase or merge with the old online content.

**Important:** these are intentionally destructive mirror operations. Download discards local repository differences. Upload replaces the remote `main` history/content with the local `main` state. `--force-with-lease` is used instead of blind `--force` so a remote change made after the script's fetch is not silently overwritten.

Files excluded by `.gitignore` are not uploaded because Git does not track them.

Both commands require Git for Windows and valid GitHub credentials for this private repository.

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
