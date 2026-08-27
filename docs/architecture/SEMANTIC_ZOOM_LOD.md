# Semantic Zoom, LOD and Cluster Navigation

This document defines the spatial exploration behavior of the OS Cognitive Void.

## Principle

Zoom is semantic, not merely geometric. Camera distance changes which real graph structures are rendered and inspectable.

## Levels

| Level | Camera radius | Meaning | Visible state |
|---|---:|---|---|
| Universe | >= 28 | System overview | Self model + derived kind clusters |
| Cluster | 18–28 | Domain overview | Cluster anchors + high-importance nodes |
| Network | 10–18 | Knowledge topology | Nodes + active current edges + priority labels |
| Detail | 5.5–10 | Local graph exploration | All nodes, edges and node labels |
| Inspect | < 5.5 | Focused entity inspection | Full local labels, stronger neighborhood emphasis |

Thresholds are implementation defaults and may later become adaptive to graph density and hardware.

## Cluster derivation

Clusters are not persisted knowledge and are not fake data. They are ephemeral render projections derived from the current `GraphSnapshot`, grouped by `node.kind`. Each cluster exposes:

- kind
- member count
- centroid derived from member positions
- average importance
- maximum confidence

Selecting a cluster moves the camera target toward its centroid and reduces radius to the network/detail range. Selecting a real node still opens the canonical Node Inspector.

## LOD rules

1. `self_model` remains visible at every level.
2. Universe level hides individual non-core nodes and knowledge edges.
3. Cluster level shows only high-importance nodes plus cluster anchors.
4. Network level shows all nodes and current edges; labels are restricted to important or hovered/selected nodes.
5. Detail/Inspect show all current nodes and labels; historical edges remain intentionally subdued.
6. Trace packets remain tied to real `cognitive-activity` phases and only animate on currently visible matching edges.

## Labels

Labels are Babylon billboard planes backed by `DynamicTexture`; they are not HTML overlays. This keeps them in the same spatial depth model as the graph. Label visibility follows LOD and hover/selection state.

## Hover and picking

- pointer move performs Babylon scene picking
- hover never mutates canonical OS state
- hovered node receives a lightweight visual emphasis and label promotion
- click on a node selects the canonical node
- click on a cluster enters that cluster
- click on empty space clears node selection; cluster focus remains until overview navigation is requested

## Performance boundary

LOD decisions happen inside the render projection and do not change the canonical graph. Future large-graph work should replace per-node meshes with thin instances / GPU buffers while preserving the same semantic levels.
