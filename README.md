# OS — Local-First Cognitive Operating Environment

OS is a greenfield cognitive desktop platform: local-first, model-independent, observable and designed around a living temporal knowledge graph.

## Product thesis

OS does not treat chat as the primary interface. Knowledge, memory, agents, tools, model activity and system state are first-class objects in a navigable Cognitive Void.

## Core loop

`Observe → Understand → Remember → Connect → Reason → Act → Evaluate → Learn → Reorganize`

## Stack

- Rust kernel
- Tauri 2 desktop shell
- React 19 + TypeScript
- Babylon.js 9 cognitive visualization
- SQLite/FTS5 as canonical persistence target
- Embedded vector retrieval target
- Temporal knowledge graph
- Capability-based agent/tool runtime
- Local and optional cloud model gateway

## Repository layout

- `apps/desktop` — commercial desktop client and Cognitive Void
- `crates/kernel` — privileged cognitive kernel
- `crates/event-ledger` — append-oriented event foundation
- `crates/memory` — memory compilation and lifecycle
- `crates/knowledge-graph` — temporal graph foundation
- `crates/contracts` — typed IPC/domain contracts
- `docs` — product, architecture, security and roadmap

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

## Status

This repository was intentionally reset to a clean commercial-grade architecture on 2026-08-27. Previous implementation history is preserved on `legacy-before-greenfield-2026-08-27`.
