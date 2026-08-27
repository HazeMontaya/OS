# OS — Final Product Specification

Status: canonical product contract
Date: 2026-08-27

## Product definition

OS is a local-first cognitive operating environment for Windows. It is not a chat wrapper and not a decorative AI dashboard. It is a persistent, model-independent cognitive runtime whose canonical state is projected into a navigable spatial interface.

The product loop is:

`Observe → Understand → Remember → Connect → Reason → Plan → Act → Verify → Learn → Reorganize`

Every visible cognitive effect must originate from real state or real events. The renderer never invents activity.

## Non-negotiable product properties

1. **Persistent cognition** — relevant input, output, actions, observations and outcomes are continuously evaluated for memory, graph and retrieval integration.
2. **Inspectable provenance** — raw evidence, memories, conclusions, derived knowledge and model outputs stay distinguishable and traceable.
3. **Model independence** — local and remote providers are routed through one model gateway; no product feature may depend on a single vendor.
4. **Capability security** — agents and tools receive explicit capabilities and scoped permissions; privileged actions remain auditable.
5. **Headless core** — cognition, storage, retrieval, agents, automation and tools work without the GUI.
6. **Spatial projection** — the 3D Cognitive Void is a projection of canonical OS state and event traces, not a second source of truth.
7. **Precision 2D UI** — forms, tables, logs, settings, code, permissions and diagnostics remain available in dense 2D panels.
8. **User control** — visual quality, density, motion, labels, telemetry, models, memory behavior, permissions and automation behavior are configurable.
9. **Resilience** — UI, agent and tool failures are isolated; persistence is transactional where possible.
10. **Performance discipline** — adaptive LOD, batching, instancing and quality scaling protect interactive frame time.

## Canonical architecture

### Cognitive Core

- Rust / Tokio runtime
- event ledger
- canonical state engine
- SQLite/FTS persistence
- embedded semantic/vector index
- temporal knowledge graph
- memory compiler and consolidation
- hybrid retrieval and rank fusion
- model gateway/router
- agent runtime and orchestration
- tool runtime / MCP adapters
- automation engine
- policy / privacy / capability enforcement
- telemetry, traces and audit records

### Desktop Runtime

- Tauri 2
- React + TypeScript
- Babylon.js
- WebGPU preferred, WebGL fallback
- Apache ECharts for analytical views

### Protocol

The UI consumes versioned snapshots and event/delta streams. No renderer component may mutate canonical cognitive state directly.

## Cognitive memory model

OS stores multiple memory classes:

- working
- episodic
- semantic
- procedural
- project
- user
- environment
- historical

All relevant interactions flow through a memory compiler:

`event → relevance → classification → entities → relations → deduplication → contradiction analysis → confidence → persistence → graph integration → semantic index`

Memory is not a flat transcript archive. Consolidation may strengthen, merge, supersede or decay derived representations while preserving source provenance.

## Knowledge graph

The graph is temporal, typed and provenance-aware. Core node families include people, projects, concepts, memories, files, directories, agents, models, tools, tasks, conversations, decisions, observations, applications, devices, repositories, processes and system entities.

Relations are typed and weighted. Every derived relationship records origin, confidence and temporal validity.

## Retrieval

Context construction combines:

- intent analysis
- entity resolution
- graph traversal
- full-text search
- semantic search
- temporal relevance
- recency and access signals
- confidence/provenance weighting
- rank fusion

Retrieved context must be inspectable from the UI.

## Agents and tools

Agents are runtime entities with identity, objective, memory scope, allowed models, allowed tools, permissions, plan, execution state and lifecycle.

Tool execution is capability-scoped and risk-rated. Filesystem, process, network, Git, browser, database, clipboard, Windows API, code execution, applications and MCP integrations use the same permission model.

No agent can grant itself new capabilities.

## Automation

Automations are persistent executable graphs:

`Trigger → Condition → Agent/Model → Tool → Decision → Action → Verification`

Supported node classes include trigger, agent, model, tool, memory, condition, loop, transform, output and human approval.

## Experience architecture

### Main Cognitive Void

The default workspace centers cognition, not chat. It contains:

- central self/model activity core
- spatial knowledge graph
- live process traces
- contextual input/output layer
- analytical overlays
- node inspector
- command palette
- workspace navigation

### Semantic zoom / LOD

LOD changes information content rather than merely object size:

- LOD 0 — energy point
- LOD 1 — primitive node
- LOD 2 — node + icon + minimal label
- LOD 3 — node + relation context + metrics
- LOD 4 — full inspectable spatial panel

### Camera modes

- FREE
- FOCUS
- FOLLOW
- TRACE
- OVERVIEW
- CINEMATIC

Manual input always overrides automatic camera movement.

### Voids

- Main Void
- Knowledge Void
- Memory Void
- Agent Void
- Automation Void
- System Void
- Settings Void
- Developer Void

These are workspaces over one renderer/runtime, not separate applications.

## High-end visual system

The visual language is a functional FUI rather than decoration:

- black/near-black volumetric void
- physically coherent depth and fog
- restrained emissive energy colors mapped to semantic classes
- temporal tracer lines for real event flow
- GPU particles for active cognitive regions
- dynamic graph topology
- spatial labels with semantic visibility rules
- glass/transparent precision panels for 2D information
- adaptive bloom, antialiasing, resolution scaling and particle budgets
- motion mapped to activity, latency, confidence, freshness and risk

Visual complexity must never obscure state, permissions or failure conditions.

## Personalization and settings contract

Every tunable behavior belongs to a versioned settings domain. Minimum domains:

### Experience
- interface density
- panel opacity
- typography scale
- reduced motion
- animation intensity
- telemetry visibility

### Renderer
- quality profile: LOW/MEDIUM/HIGH/ULTRA/CUSTOM
- resolution scale
- antialiasing
- bloom/glow
- fog
- particles
- graph density
- label density
- LOD thresholds
- target FPS

### Camera
- default mode
- inertia
- zoom speed
- orbit speed
- auto-focus
- trace-follow behavior

### Cognition
- memory capture threshold
- consolidation aggressiveness
- contradiction handling
- retrieval breadth/depth
- provenance strictness
- learning/adaptation policy

### Models
- provider priority
- task routing
- cost/latency/privacy constraints
- local-only mode
- fallback models

### Agents and tools
- autonomy level
- parallelism
- default capability scopes
- approval thresholds
- sandbox policy

### Privacy and security
- data retention
- sensitive-data handling
- network permissions
- filesystem scopes
- audit retention

All settings require defaults, validation, migration and inspectable effective values.

## Observability

OS exposes metrics, logs, events and traces for:

- model calls
- agent lifecycle
- tool calls
- retrieval
- memory compilation
- graph mutation
- storage
- latency
- tokens/cost
- CPU/RAM/GPU
- renderer frame time
- errors and retries

The Developer Void can inspect the same trace from input through retrieval, agent/model/tool execution to persisted output.

## Definition of done

OS is not considered product-complete until all of the following are true:

1. A real user request can generate an end-to-end trace from input to persisted knowledge.
2. The same trace is visible spatially and textually.
3. Memory retrieval changes future behavior based on persisted prior interactions.
4. Knowledge relations are inspectable with provenance and confidence.
5. At least one local and one remote model provider are interchangeable through the gateway.
6. Agents can execute scoped tools under capability policy and produce an auditable result.
7. Automations can persist, execute and recover after restart.
8. Settings persist and control effective renderer/UI/runtime behavior.
9. The application remains functional if the 3D renderer is disabled.
10. CI validates Rust, TypeScript and Windows/Tauri builds.
11. Destructive/system actions are permission-gated and auditable.
12. The Cognitive Void maintains interactive performance using adaptive LOD/quality.

## Implementation priority

P0 — canonical event/state protocol, storage integrity, settings persistence, permission enforcement

P1 — memory consolidation, retrieval quality, graph provenance, model routing, agent/tool lifecycle

P2 — complete workspace/void system, semantic zoom, camera intelligence, trace visualization

P3 — automation graph editor/runtime, developer diagnostics, GPU simulation/effects, advanced personalization

P4 — optimization, accessibility, packaging, update/recovery, migrations, production hardening

This document is the final product contract. Architecture decisions, roadmap items and UI work must be evaluated against it.