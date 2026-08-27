# GPU Spatial Phase 4 — GPU-Resident Cognitive Graph

Status: implemented on the Phase 4 integration branch and gated by the normal OS CI pipeline.

## Objective

Phase 4 moves the primary WebGPU cognitive node/relation projection away from CPU-allocated Babylon SPS spheres and line systems.

The WebGPU path now treats the cognitive graph as packed GPU data:

`GraphSnapshot → deterministic projection plan → packed storage buffers → WGSL visibility/LOD pass → shared storage/vertex buffers → point/line rendering`

WebGL and failed WebGPU/compute initialization continue to use the validated Phase 3 renderer.

## GPU graph buffers

`GpuGraphField` owns five principal GPU resources:

1. node source storage
2. edge source storage
3. node render storage/vertex buffer
4. edge render storage/vertex buffer
5. compute parameter storage

### Node source record

Each node is packed into three `vec4<f32>` records:

- position + visual size
- semantic RGB + confidence
- importance + core flag + reserved fields

### Edge source record

Each edge is packed into two `vec4<f32>` records:

- source/target node indices
- semantic RGB + relation weight

The source buffers remain GPU-resident until topology/allocation changes. Mutable importance, confidence, color and edge-weight state can be uploaded into the existing allocation without recreating meshes or vertex buffers.

## Shared storage / vertex path

The compute shader writes directly into buffers created with both storage and vertex usage.

For nodes, the output layout is:

`position vec4 | color vec4`

For edges, each logical relation produces two line-list vertices:

`from position | from color | to position | to color`

Babylon binds the same underlying GPU buffers as vertex/color buffers. OS does not read the computed positions or visibility state back into JavaScript each frame.

## Semantic GPU LOD

The WGSL pass receives:

- camera target
- camera radius
- semantic zoom level
- selected-node index
- motion/time state
- node/edge counts

Node visibility is computed from:

- semantic LOD
- importance
- core/self status
- selection status
- distance from the current cognitive focus

Relations additionally use:

- current semantic zoom
- edge weight
- endpoint visibility

Selected nodes and the cognitive core bypass ordinary importance thresholds so they remain inspectable.

## Culling terminology

Phase 4 performs **GPU visibility culling**, but not yet GPU draw compaction.

The compute pass writes rejected nodes/edge vertices outside the visible world and gives them zero alpha. Babylon still issues a fixed-size point/line draw for the allocated graph buffer.

Therefore Phase 4 reduces:

- CPU topology traversal per frame
- CPU mesh allocation
- per-object Babylon overhead
- CPU-side LOD decisions
- CPU/GPU synchronization pressure

It does **not yet** reduce the submitted vertex count through prefix-sum compaction or indirect draw commands.

That distinction is intentional and is part of the Phase 5 boundary.

## Scalable picking

The old renderer used a bounded set of invisible Babylon sphere meshes as pick proxies.

Phase 4 introduces `SpatialPickIndex`, an immutable binary BVH over conservative node pick spheres.

The BVH is built only when topology/layout selection changes. Pointer queries traverse bounding volumes and perform exact ray/sphere tests only inside candidate leaves.

Benefits:

- all visible projected nodes can participate in selection, not only the pick-proxy budget
- no invisible Babylon mesh allocation per node
- hover/click cost scales with BVH traversal rather than scene-level mesh picking
- mutable confidence/importance updates do not require rebuilding the index

The BVH remains CPU-side. GPU ID-buffer picking is deferred to Phase 5.

## Projection selection correctness

Phase 4 uses a projection key combining:

- structural graph topology signature
- ordered visible node IDs
- ordered visible edge IDs
- ordered label allocation IDs
- workspace identity

This closes an important boundary in Phase 3: importance/confidence or relation-weight changes may stay incremental only while they do not change which nodes, edges or labels occupy a finite render budget.

If budget membership changes, the projection is rebuilt conservatively.

## Retained CPU/Babylon layers

The GPU graph does not attempt to move every visual primitive to compute in one step.

The following remain lightweight Babylon resources:

- semantic cluster shells
- cluster labels
- bounded high-value node labels
- core rings
- focus halo
- bounded execution trace packets

The ambient signal field remains its own GPU compute pipeline from Phase 2.

## Fallback contract

`SpatialRendererV4` is GPU-first, not GPU-only.

Fallback to the validated Phase 3 renderer occurs when:

- `navigator.gpu` is unavailable
- Babylon WebGPU initialization fails
- compute shaders are unavailable during initialization
- GPU graph allocation throws during setup

The canonical application state and user controls are independent of the renderer selected.

## Current performance hierarchy

### WebGPU / compute capable

- GPU graph source buffers
- GPU semantic LOD/visibility
- shared storage/vertex output
- GPU ambient signal field
- BVH node picking
- adaptive resolution

### WebGL / compatibility

- Phase 3 incremental SPS nodes
- batched relation line systems
- bounded pick proxies
- CPU ambient SPS
- same semantic camera/navigation contract

## Phase 5 boundary

The next rendering stage should target:

1. GPU prefix-sum/stream compaction for visible nodes and edges
2. indirect draw argument generation where Babylon/WebGPU integration allows it cleanly
3. GPU ID-buffer picking with asynchronous readback only on pointer demand
4. GPU-resident or atlas/MSDF label placement
5. compute-assisted force/constraint layout for large dynamic graph regions
6. hierarchical cluster buffers and GPU cluster reduction
7. explicit GPU timing instrumentation where supported

Phase 5 must keep the same hard rules established here:

- no canonical state hidden in the renderer
- no mandatory GPU readback in the frame loop
- deterministic compatibility fallback
- semantic LOD, not decorative particle density
- measured CI/runtime gates before promotion to `main`
