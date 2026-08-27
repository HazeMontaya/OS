# Architecture

## Cognitive pipeline

```text
Input / Observation
        ↓
Event Ledger
        ↓
Sensitivity + Context Analysis
        ↓
Memory Compiler
        ↓
Entity / Fact / Relation Extraction
        ↓
Temporal Knowledge Graph
        ↓
Hybrid Retrieval + Ranking
        ↓
Reasoning / Agent Runtime
        ↓
Action / Output
        ↓
Outcome Evaluation
        ↓
Learning + Consolidation
        ↺
```

## Separation of concerns

```text
React + Babylon Cognitive Void
            │ typed Tauri IPC
            ▼
        Rust Kernel
   ┌────────┼─────────┐
 Event    Memory     Graph
 Ledger   Engine     Engine
   │        │          │
   └────────┼──────────┘
            ▼
      Policy / Agents
            │
      ┌─────┴─────┐
      ▼           ▼
 Model Gateway  Tool Sandbox
```

## Canonical storage target

SQLite + FTS5 is the canonical transactional store. Embedded vector storage is a retrieval index, never the source of truth. Graph compute may be materialized in memory from canonical entities/relationships.

## Temporal graph invariant

Facts and edges carry `valid_from`, `valid_until`, confidence and provenance. New evidence supersedes previous derived state without silently rewriting origin events.

## Learning layers

1. Online: memory, graph, ranking, preferences and procedural outcomes.
2. Consolidation: replay, deduplication, contradiction detection, clustering and reweighting.
3. Model adaptation: isolated dataset generation, privacy filtering, adapter training, evaluation and accept/reject gate.

## Cognitive Void spaces

- Focus Void
- Knowledge Void
- Memory Void
- Process Void
- System Void
- Evolution Void

Rendering must be driven by real kernel state/telemetry, not decorative animation.
