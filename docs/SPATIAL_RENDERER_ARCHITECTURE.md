# OS Spatial Renderer Architecture

Status: **implementation contract and migration path**.

The renderer must support a visually extreme cognitive environment without coupling canonical OS state to presentation objects. Babylon.js remains the spatial runtime. WebGPU is preferred; WebGL remains a required fallback.

## 1. Architecture boundary

```text
Rust kernel / runtime / event ledger
        ↓ Tauri commands + events
Canonical snapshots / deltas
        ↓
Visualization projection
        ↓
SpatialRenderer
  ├─ node batches
  ├─ relation batches
  ├─ labels
  ├─ pick proxies / picking
  ├─ cognitive trace packets
  └─ ambient depth field
        ↓
Babylon.js
  ├─ WebGPU preferred
  └─ WebGL fallback
        ↓
React instrument shell / ECharts analytics
```

The renderer is a projection. It may discard visual detail for performance but may not mutate or redefine canonical knowledge/runtime state.

## 2. Current production foundation

`apps/desktop/src/rendering/SpatialRenderer.tsx` replaces the previous per-node `CognitiveVoid` implementation.

Current implementation uses:

- deterministic semantic projection positions;
- workspace-specific node filtering and camera configuration;
- `SolidParticleSystem` for batched node geometry;
- `SolidParticleSystem` for bounded ambient signals;
- `SolidParticleSystem` for bounded cognitive trace packets;
- `CreateLineSystem` for batched current relations;
- separate batched historical relations;
- strict label budgets;
- bounded invisible pick proxies rather than pickable geometry for every visible point;
- semantic zoom visibility rules;
- WebGPU initialization with WebGL fallback;
- quality-profile-driven resolution and object budgets;
- adaptive resolution using measured engine FPS;
- theme-driven gold/obsidian scene lighting, fog and bloom;
- reduced-motion support;
- live phase-specific relation traces.

This is a major scaling improvement over a mesh/material/texture per graph element. It is still an intermediate renderer, not the final custom WebGPU architecture.

## 3. Render profiles

Profiles live in `@os/renderer` and define hard visual budgets.

| Profile | Nodes | Edges | Labels | Pick proxies | Generic particle budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOW | 2,500 | 5,000 | 18 | 64 | 8,000 |
| MEDIUM | 8,000 | 16,000 | 36 | 128 | 24,000 |
| HIGH | 24,000 | 48,000 | 72 | 256 | 64,000 |
| ULTRA | 64,000 | 120,000 | 128 | 384 | 160,000 |

`graphDensity`, `labelDensity` and `ambientParticles` scale effective budgets. Budgets are ceilings, not promises that every element should be rendered.

## 4. Semantic LOD

LOD is based on meaning and visual utility, not only geometry complexity.

### UNIVERSE
- aggregated clusters
- very low relation visibility
- no individual labels
- topology/orientation over detail

### CLUSTER
- cluster nodes and cluster labels
- selected high-importance objects may surface
- no dense edge forest

### NETWORK
- node field visible
- relation batches visible
- high-importance labels only

### DETAIL
- focused local topology
- labels and active traces
- richer interaction proxies

### INSPECT
- selected/local object context
- strongest relation semantics
- contextual 2D inspector

Future LOD should additionally aggregate remote graph regions into density volumes or cluster impostors before data reaches draw buffers.

## 5. Adaptive quality

Current adaptive resolution changes hardware scaling within the active profile's requested scale and lower bound. It must never scale above the selected profile.

Future adaptive controller inputs should include:

- rolling frame-time percentile rather than only instantaneous FPS;
- GPU timing when exposed;
- visible nodes/edges;
- dynamic texture pressure;
- WebGPU vs WebGL backend;
- Windows device pixel ratio;
- user interaction state;
- battery/power mode where safely available.

Adaptive quality should reduce in this order:

1. ambient signals;
2. label count;
3. edge density;
4. post effects;
5. render resolution;
6. visible node detail/aggregation.

Selected/focused content must be protected as long as possible.

## 6. Final WebGPU target

The next renderer generation should progressively replace CPU/object-oriented Babylon abstractions for extreme datasets while retaining Babylon for scene/camera/platform integration.

### Node storage
Use packed GPU/storage buffers containing stable IDs, position, visual scale, category, confidence, importance, activity and state flags.

### Indirect / instanced drawing
Render large node sets through GPU-driven or indirect instancing where Babylon/WebGPU integration permits. Avoid JavaScript object creation per visual entity.

### Compute layout
WGSL compute should be evaluated for:

- force/constraint relaxation;
- local collision separation;
- cluster centroids;
- temporal interpolation;
- trace propagation;
- visibility/LOD compaction.

Layout must remain deterministic enough that navigation does not become spatially unstable between frames.

### Relation rendering
Replace high-count line meshes with packed edge buffers and a custom shader/geometry strategy. Width, temporal status and signal travel should be encoded without one mesh per edge.

### Labels
Move from individual `DynamicTexture` planes toward a shared SDF/MSDF atlas with GPU instance buffers. Label placement needs priority, overlap rejection, distance thresholds and temporal stability.

### Picking
For very large visible sets use an ID-buffer or equivalent GPU-assisted picking pass plus a CPU spatial index for coarse filtering. Do not allocate a pick mesh for every node.

### Temporal data
Historical knowledge should use aggregation and temporal slices rather than attempting to draw the full ledger simultaneously.

## 7. Camera state machine

Canonical modes:

- FREE — manual spatial exploration;
- FOCUS — smooth target acquisition;
- FOLLOW — agent/runtime target tracking;
- TRACE — camera follows an execution/data path;
- OVERVIEW — topology framing;
- CINEMATIC — constrained low-motion presentation/configuration state.

Workspaces define a preferred camera, but user interaction can temporarily override automated movement.

## 8. Truthful visualization

Production visuals must distinguish:

- real graph data;
- real cognitive execution signals;
- ambient/decorative depth cues;
- fallback/preview state.

Ambient particles are allowed only as atmosphere and must not be presented as memories, agents, events, confidence or runtime activity.

## 9. Lifecycle and update policy

Current implementation rebuilds a batched projection when graph/workspace/density/theme-relevant configuration changes. This is acceptable as an intermediate architecture.

Final architecture must become delta-driven:

```text
state delta → projection delta → buffer patch → frame
```

Large graph updates must not require destroying all GPU resources.

## 10. Performance correctness rules

- No unbounded particle/node/edge creation.
- No DynamicTexture per arbitrary unbounded graph node.
- No material per arbitrary node.
- No per-frame React state updates for individual visual entities.
- No fabricated telemetry to make the scene look active.
- WebGL fallback must remain functional.
- Render settings exposed in UI must either affect the renderer or be clearly identified as unavailable.
- Reduced-motion must remove ambient auto-motion and nonessential pulses.

## 11. Implementation priorities

P0 — keep builds, WebGPU fallback and canonical-state projection correct.

P1 — incremental buffer updates and stronger adaptive frame-time controller.

P2 — SDF/MSDF label system and scalable GPU picking.

P3 — packed edge/node GPU buffers and custom WGSL material pipeline.

P4 — compute-driven layout/LOD compaction and million-element temporal aggregation.

The architectural goal is not a benchmark number. It is stable, readable, explorable cognition at the highest information density the current machine can sustain without losing interaction quality or semantic truth.
