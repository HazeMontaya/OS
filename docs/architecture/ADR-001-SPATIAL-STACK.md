# ADR-001 – Spatial OS Technology Stack

## Status

Accepted for implementation branch.

## Context

OS requires a Windows desktop shell, a headless-capable systems core, a high-performance spatial renderer, live graph visualization, GPU effects, agent/tool observability and a UI layer for precise 2D controls.

## Decision

Use the following primary architecture:

- Rust for core/runtime/security/storage integration.
- Tokio for asynchronous runtime work.
- Tauri 2 as desktop shell and Rust↔frontend bridge.
- TypeScript + React for conventional UI.
- Babylon.js for the 3D scene/renderer.
- WebGPU + WGSL as preferred GPU path.
- WebGL 2 as renderer fallback where required.
- SQLite for structured local persistence.
- Hybrid search composed from graph traversal, full-text indexing and vector retrieval.
- Versioned event/state protocol between Core and Experience Layer.

## Consequences

### Positive

- Core remains testable without a GUI.
- Native/system-sensitive work stays in Rust.
- Renderer can exploit modern GPU APIs without coupling the core to a game engine.
- Existing web UI ecosystem remains usable for forms, text, logs and settings.
- Real events can drive visualization directly.
- Provider, model and tool implementations remain replaceable.

### Costs

- Two language/runtime domains must be maintained (Rust and TypeScript).
- IPC/state contracts require versioning discipline.
- WebGPU support must have explicit graceful degradation.
- Spatial UX needs performance budgets and accessibility fallbacks from the start.

## Guardrails

- Never put canonical business/system state only in React state.
- Never make the renderer responsible for executing tools or agents.
- Never emit decorative activity that cannot be tied to a real event/state.
- Never require 3D interaction for a task that needs a precise accessible 2D representation.
- Never bypass the capability/security layer for convenience.
