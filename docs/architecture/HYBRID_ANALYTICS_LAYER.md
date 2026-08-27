# Hybrid Spatial Analytics Layer

## Status

Implemented foundation.

## Purpose

OS combines two complementary representations of the same canonical system state:

1. **Spatial intelligence** — Babylon.js/WebGPU Cognitive Void for knowledge topology, memory, agents, tools and live execution relationships.
2. **Analytical precision** — Apache ECharts for metrics, distributions, timelines and dense numerical inspection.

The analytics layer is not a second source of truth. It consumes the same typed snapshots and graph data already exposed by the Rust/Tauri core.

## Current implementation

- `apps/desktop/src/analytics/EChart.tsx` — tree-shaken ECharts renderer using Canvas.
- `apps/desktop/src/analytics/AnalyticsPanel.tsx` — live runtime and graph analytics.
- `apps/desktop/src/analytics/analytics.css` — isolated visual layer.
- `apps/desktop/src/App.tsx` — contextual toggle and integration with the Cognitive Void.

## Data integrity rule

Charts must not contain fabricated demo values in production UI. Current charts use only:

- `SystemSnapshot.event_count`
- `SystemSnapshot.memory_count`
- `SystemSnapshot.node_count`
- `SystemSnapshot.edge_count`
- real `GraphSnapshot.nodes` grouped by node kind
- real current cognitive activity phase

If data is unavailable, the UI renders an explicit empty state.

## Renderer boundaries

- Babylon.js owns 3D/spatial rendering.
- ECharts owns dense 2D analytics.
- React owns orchestration and conventional controls.
- Rust remains canonical state owner.
- No Three.js/React Three Fiber runtime is introduced.

## Next extensions

- trace timeline fed by versioned trace events
- model/tool latency distributions
- retrieval score inspection
- token/cost analytics when providers expose trustworthy counters
- system CPU/RAM/GPU telemetry from the Rust system layer
- linked selection: selecting a chart segment focuses corresponding nodes in the Cognitive Void
- semantic zoom from aggregate metric to source/provenance
