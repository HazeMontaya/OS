# OS GPU Spatial Phase 2

Status: implemented on the `gpu-spatial-phase-2` integration branch and gated by the normal OS CI pipeline.

## Purpose

Phase 2 converts the Black-Gold spatial experience from a predominantly CPU-authored Babylon scene into a hybrid renderer with a real GPU-resident simulation path. The goal is not decorative particle count. The goal is to establish the primitives required for larger cognitive worlds without transferring simulation state back to JavaScript every frame.

## Non-negotiable constraints

1. WebGPU is an acceleration tier, never a startup requirement. WebGL remains the compatibility path.
2. The canonical cognitive state remains outside the renderer. GPU buffers are projections of that state, not authoritative memory.
3. Direct user camera manipulation always wins over autonomous camera motion.
4. Reduced-motion settings must disable non-essential autonomous motion.
5. GPU failure must degrade cleanly to the batched Babylon path.
6. No renderer subsystem may require a GPU-to-CPU readback in the normal frame loop.
7. High object counts must be governed by explicit budgets instead of uncontrolled allocation.

## Architecture

```text
OS state / GraphSnapshot
        |
        +---- CPU cognitive projection ------------------------+
        |                                                      |
        |    ranked nodes -> SPS node batch                    |
        |    ranked edges -> LineSystem batches                |
        |    selected nodes -> bounded pick proxies            |
        |    labels -> bounded DynamicTexture planes           |
        |    active relations -> bounded trace packet SPS      |
        |                                                      |
        +---- WebGPU signal projection ------------------------+
             tiny parameter buffer                             |
                    |                                          |
                    v                                          |
             WGSL ComputeShader                                |
                    |                                          |
                    v                                          |
             StorageBuffer (vec4 positions)                    |
                    |                                          |
                    +---- same GPU buffer ----> VertexBuffer ---+
                                              point rendering
```

The critical property is that the WebGPU signal field writes into a `StorageBuffer` that is also consumed directly as a vertex buffer. JavaScript updates only a small parameter buffer containing time, activity, workspace identity and motion controls. Particle positions remain GPU resident.

## GPU feature tiers

### `WEBGL_BATCHED`

Compatibility tier:

- Babylon `SolidParticleSystem` for cognitive nodes and fallback ambient signals.
- batched `LineSystem` relations.
- bounded labels and picking proxies.
- CPU-created topology, GPU-rendered batches.
- adaptive resolution and explicit density budgets.

### `WEBGPU_COMPUTE`

Acceleration tier:

- everything in `WEBGL_BATCHED` remains available.
- WGSL compute shader for large ambient/system signal fields.
- shared storage/vertex buffer; no per-frame positional uploads.
- up to 96,000 GPU signal particles, bounded by the active render profile and ambient intensity.
- per-Void compute choreography.

The compute tier is selected only when Babylon reports compute-shader support on the active engine.

## Camera Director

`CameraDirector` implements the canonical camera state machine:

- `FREE` — user owns the camera; autonomous motion stops.
- `FOCUS` — selected entity is centered with controlled close orbit.
- `FOLLOW` — follows an active entity with a more energetic orbit.
- `TRACE` — diagnostic/execution camera with wider motion and activity response.
- `OVERVIEW` — returns to the semantic workspace radius and origin.
- `CINEMATIC` — slow breathing radius and restrained presentation motion.

Pointer wheel/down immediately switches to `FREE`. Selecting a node switches to `FOCUS`. Each Void restores its preferred semantic mode when entered. All autonomous camera motion respects the global reduced-motion setting.

## Distinct Void layouts

Phase 2 makes workspace identity geometrically real rather than simply filtering a shared constellation.

| Void | Layout | Primary visual logic |
| --- | --- | --- |
| Cognitive Core | `COGNITIVE_CONSTELLATION` | central self-model with semantic clusters |
| Knowledge | `KNOWLEDGE_SPHERE` | concepts distributed across spherical semantic shells |
| Memory | `TEMPORAL_HELIX` | memory classes arranged in temporal/depth helices |
| Agents | `EXECUTION_ORBITS` | agents, models, tools and goals on execution orbits |
| Developer | `TRACE_MATRIX` | diagnostic lanes, rows and execution decks |
| System | `SYSTEM_RINGS` | infrastructure classes on concentric system rings |
| Settings | `CONFIGURATION_CHAMBER` | restrained core-centric chamber |
| Automation | `AUTOMATION_CIRCUIT` | workflow-like lanes and execution paths |

The WGSL signal field mirrors those identities at the ambient/system level, so the large-scale field and cognitive topology communicate the same workspace semantics.

## Render budgets

The existing LOW/MEDIUM/HIGH/ULTRA profiles remain authoritative. Phase 2 splits ambient rendering into two budgets:

- compatibility SPS ambient field: hard-capped at 900 signals;
- WebGPU compute field: derived from 50% of the profile particle budget and hard-capped at 96,000 signals.

This prevents the fallback path from allocating thousands of CPU-managed particle objects while allowing WebGPU hardware to carry substantially denser spatial fields.

## Failure behavior

If WebGPU initialization fails, OS falls back to WebGL as before. If WebGPU starts but compute-field construction or shader compilation fails, the compute field is disabled and the rest of the spatial renderer remains active. The HUD reports the effective render fabric as either `GPU COMPUTE` or `BATCHED`.

## What Phase 2 does not claim

Phase 2 does **not** move the canonical cognitive graph itself into WGSL storage buffers. Cognitive nodes still use the Babylon SPS projection and topology rebuilds are still required when the visible graph topology changes. It also does not yet provide GPU ID-buffer picking or MSDF text.

Those are the next scaling boundary.

## Phase 3 target

The next renderer phase should implement:

1. a topology signature and delta compiler so non-topological state updates do not rebuild the entire projection;
2. packed GPU records for cognitive nodes and relations;
3. separate immutable topology and mutable activity buffers;
4. compute-assisted layout relaxation for large graphs;
5. GPU ID-buffer picking for large visible sets;
6. MSDF/SDF text atlas and GPU label culling;
7. indirect/instanced draw paths for cognitive geometry;
8. GPU temporal fading/history fields;
9. instrumentation for CPU frame time, GPU frame time, buffer memory and rebuild cost;
10. graceful tiering so every advanced path has a deterministic lower-capability fallback.

## Acceptance criteria

Phase 2 is considered mergeable only when all standard repository gates pass:

- workspace TypeScript typecheck;
- production Vite build;
- Windows Tauri compile;
- Rust formatting;
- Rust tests;
- Clippy with warnings denied;
- CLI runtime doctor;
- developer diagnostics.

No GPU-specific feature bypasses these gates.
