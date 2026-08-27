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

## Status

This repository was intentionally reset to a clean commercial-grade architecture on 2026-08-27. Previous implementation history is preserved on `legacy-before-greenfield-2026-08-27`.

The Spatial OS architecture is now the target architecture for continued development.
