import type { GraphSnapshot } from "../cognitive";

/**
 * Structural signature for the visible cognitive source graph.
 *
 * Importance, confidence, relation weight and provenance are intentionally excluded: they are
 * mutable visual/state attributes and must not force Babylon topology reconstruction. IDs, kinds,
 * labels, relation endpoints and historical/current state are structural because they affect
 * layout, label allocation, batching or relation membership.
 *
 * The hash is order-sensitive by design. A backend reordering an otherwise identical snapshot may
 * cause one conservative rebuild, but can never leave stale geometry behind.
 */
export function graphTopologySignature(graph: GraphSnapshot): string {
  let hash = 2166136261;

  const feed = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  };

  feed(`n:${graph.nodes.length}|e:${graph.edges.length}|`);
  for (const node of graph.nodes) {
    feed(`n:${node.id}:${node.kind}:${node.label}|`);
  }
  for (const edge of graph.edges) {
    feed(
      `e:${edge.id}:${edge.from}:${edge.to}:${edge.relation}:${edge.valid_until_ms === null ? "current" : "history"}|`,
    );
  }

  return `${graph.nodes.length}:${graph.edges.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export type ProjectionDeltaKind = "NO_CHANGE" | "MUTABLE_STATE" | "TOPOLOGY";

export function classifyProjectionDelta(
  previousGraph: GraphSnapshot | null,
  nextGraph: GraphSnapshot,
  previousTopologySignature: string | null,
  nextTopologySignature: string,
): ProjectionDeltaKind {
  if (!previousGraph) return "TOPOLOGY";
  if (previousTopologySignature !== nextTopologySignature) return "TOPOLOGY";
  if (previousGraph === nextGraph) return "NO_CHANGE";
  return "MUTABLE_STATE";
}
