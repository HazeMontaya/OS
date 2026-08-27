# Greenfield Roadmap

## P0 — Foundation ✅
- [x] Rust/Tauri workspace
- [x] typed IPC contracts
- [x] event ledger
- [x] memory/graph domain types
- [x] Cognitive Void shell
- [x] security baseline
- [x] Core CI for format, tests and clippy

## P1 — Durable cognition 🚧
- [x] SQLite schema + migration `0001`
- [x] SQLite WAL mode, foreign keys and busy timeout
- [x] FTS5 indexes for events and memories
- [x] transactional event persistence
- [x] persistent database location in Tauri AppData
- [x] temporal validity/provenance fields in the canonical schema
- [x] entity repository
- [x] fact repository with supersession operations
- [x] relationship repository with temporal invalidation
- [x] memory repository + FTS synchronization
- [x] startup integrity check
- [ ] automated recovery/repair strategy
- [ ] backup/restore primitives

## P2 — Retrieval 🚧
- [x] lexical FTS5 event recall
- [x] weighted lexical/semantic/graph/temporal/procedural fusion primitives
- [ ] embeddings
- [ ] embedded vector index
- [ ] graph traversal retrieval provider
- [ ] temporal retrieval provider
- [ ] procedural retrieval provider
- [ ] reranker
- [ ] provenance-aware context packs

## P3 — Cognitive engine
- [ ] memory compiler
- [ ] entity resolution
- [ ] contradiction engine
- [ ] consolidation/replay
- [ ] importance/relevance model
- [ ] self/world/project/user models

## P4 — Model fabric 🚧
- [x] model registry foundation
- [x] model capability registry
- [x] local-only compatibility filtering
- [x] policy-aware model planning primitive
- [ ] llama.cpp local gateway
- [ ] cloud provider adapters
- [ ] runtime health/latency/cost scoring
- [ ] routing by privacy/cost/latency/quality

## P5 — Agent/runtime security 🚧
- [x] capability policy engine foundation
- [x] explicit policy decisions for model invocation
- [x] cognitive trace signal types and telemetry buffer
- [x] orchestrator planning foundation
- [ ] tool sandbox
- [ ] MCP integration
- [ ] durable execution traces
- [ ] procedural learning

## P6 — Cognitive Void
- [ ] WebGPU renderer adapter + WebGL fallback
- [ ] semantic zoom
- [ ] LOD/clustering/instancing
- [ ] six Void spaces
- [ ] bind real telemetry to synaptic activity
- [ ] inspectors/timeline/search overlays

## P7 — Learning
- [ ] feedback/outcome scoring
- [ ] dataset candidate builder
- [ ] privacy and quality filters
- [ ] LoRA/PEFT training worker
- [ ] evaluation/regression gates

## P8 — Commercial release
- [ ] installers
- [ ] code signing
- [ ] signed updater
- [ ] backup/export/delete/forget workflows
- [ ] SBOM/dependency auditing
- [ ] telemetry controls
- [ ] licensing/billing integration
- [ ] compliance review
