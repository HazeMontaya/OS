# OS GPU Spatial Phase 3 — Incremental Projection

Status: integration phase for the Black-Gold SpatialRenderer.

## Objective

Phase 3 removes the most expensive remaining CPU-side behavior from ordinary cognitive state updates: destroying and reconstructing the complete Babylon projection whenever a new `GraphSnapshot` object arrives.

The renderer now distinguishes **structural topology** from **mutable cognitive state**.

## Delta model

`ProjectionDelta.ts` computes a deterministic structural signature from graph node/edge identity and structural fields.

Structural changes include changes that alter geometry, batching, labeling or relation membership, such as:

- node count;
- node ID;
- node kind;
- node label;
- edge count;
- edge ID;
- relation endpoints;
- relation kind;
- current/historical edge state.

Mutable state includes values that can be projected into already allocated GPU/Babylon objects without changing topology, principally:

- node importance;
- node confidence;
- non-geometric snapshot metadata.

A conservative structural rebuild remains correct when the topology signature changes. A snapshot with the same topology uses the incremental path.

## Incremental node updates

The visible node allocation stores a stable `visibleNodeIds` order together with the Babylon `SolidParticleSystem`.

For a mutable update OS now:

1. maps the latest snapshot by node ID;
2. replaces the projection's current `nodeById` records;
3. recomputes visual node size;
4. updates SPS particle scaling;
5. updates semantic alpha/color from confidence;
6. updates label importance metadata used by semantic zoom;
7. adjusts bounded pick proxies;
8. commits the modified particle batch with `setParticles()`.

No meshes, materials, textures, cluster geometry or relation line systems are recreated for that update.

## Stable allocation epochs

Node/edge capacity selection is intentionally stable inside a topology epoch. Importance/confidence changes modify the already allocated visible set instead of continuously reallocating objects. Reallocation happens on structural topology or render-budget/workspace changes.

This trades short-lived ranking churn for predictable frame cost and object identity, which is required for stable picking, focus, camera following and future GPU buffer residency.

## Trace isolation

Execution traces no longer belong to the immutable graph projection resource set.

They now have a dedicated lifecycle:

- the cognitive topology remains allocated;
- phase changes dispose/rebuild only the bounded trace SPS/material;
- a topology rebuild creates the static projection first and then attaches the current trace layer;
- frame animation updates only trace packet positions.

Changing `memory_recall` → `model_inference` → `output_persist` therefore no longer destroys the cognitive world.

## Live renderer settings

Phase 3 also separates live scene calibration from structural rebuilds:

- depth fog is applied directly to the current scene;
- glow intensity is applied directly to the existing `GlowLayer`;
- camera/motion settings remain ref-driven per frame;
- only capacity/material changes that alter allocated resources trigger reconstruction.

## Instrumentation

The spatial HUD reports two counters:

- `R` — full projection rebuilds;
- `Δ` — mutable in-place graph updates.

These counters make renderer behavior inspectable during development and allow performance work to verify that high-frequency state changes are using the intended delta path.

## Relationship to Phase 2

Phase 2 established:

- real WebGPU WGSL compute;
- a GPU-resident ambient signal field;
- shared storage/vertex buffers with no positional readback;
- camera-state control;
- distinct Void layouts.

Phase 3 reduces CPU allocation/reconstruction around the still-CPU-authored cognitive graph. The two phases are complementary: Phase 2 increases GPU-resident simulation density; Phase 3 prevents ordinary cognitive updates from rebuilding the surrounding Babylon scene.

## Remaining scaling boundary

The canonical cognitive node/edge batches are not yet packed into WebGPU storage buffers. The next renderer stage should move the mutable cognitive projection itself toward:

- packed node records;
- packed relation records;
- GPU activity/state buffers;
- GPU ID-buffer picking;
- GPU/compute culling and LOD;
- MSDF/SDF text atlas;
- indirect/instanced cognitive draws;
- GPU timing and memory instrumentation.

Phase 3 is therefore an allocation and state-management prerequisite for the later fully GPU-resident cognitive graph.
