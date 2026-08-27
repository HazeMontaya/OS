import { useMemo } from "react";
import type { CognitiveNode, GraphSnapshot } from "../cognitive";

type NodeInspectorProps = {
  node: CognitiveNode;
  graph: GraphSnapshot;
  onClose: () => void;
};

export default function NodeInspector({ node, graph, onClose }: NodeInspectorProps) {
  const relations = useMemo(() => {
    const labels = new Map(graph.nodes.map((item) => [item.id, item.label]));
    return graph.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => {
        const outgoing = edge.from === node.id;
        const peerId = outgoing ? edge.to : edge.from;
        return {
          id: edge.id,
          direction: outgoing ? "out" : "in",
          relation: edge.relation,
          peer: labels.get(peerId) ?? peerId,
          weight: edge.weight,
          historical: edge.valid_until_ms !== null,
        };
      })
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 10);
  }, [graph, node.id]);

  const incoming = relations.filter((relation) => relation.direction === "in").length;
  const outgoing = relations.filter((relation) => relation.direction === "out").length;

  return (
    <aside className="node-inspector glass" aria-label={`Inspect ${node.label}`}>
      <header className="node-inspector-header">
        <div>
          <span className="eyebrow">SPATIAL FOCUS</span>
          <strong>{node.label}</strong>
          <small>{node.kind.replaceAll("_", " ")}</small>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close node inspector">
          ×
        </button>
      </header>

      <section className="node-score-grid">
        <div>
          <span>Importance</span>
          <strong>{Math.round(node.importance * 100)}%</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{Math.round(node.confidence * 100)}%</strong>
        </div>
        <div>
          <span>Incoming</span>
          <strong>{incoming}</strong>
        </div>
        <div>
          <span>Outgoing</span>
          <strong>{outgoing}</strong>
        </div>
      </section>

      <section className="node-relations">
        <div className="node-section-title">
          <span>Relations</span>
          <small>{relations.length} strongest</small>
        </div>
        {relations.length > 0 ? (
          <div className="relation-list">
            {relations.map((relation) => (
              <div className="relation-row" key={relation.id}>
                <span className={`relation-direction relation-${relation.direction}`}>
                  {relation.direction === "out" ? "→" : "←"}
                </span>
                <div>
                  <strong>{relation.relation.replaceAll("_", " ")}</strong>
                  <small>{relation.peer}</small>
                </div>
                <span className="relation-weight">{relation.weight.toFixed(2)}</span>
                {relation.historical && <span className="relation-history">history</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="node-empty">No visible graph relations for this node.</div>
        )}
      </section>

      <footer className="node-inspector-footer">
        <span>NODE ID</span>
        <code>{node.id}</code>
      </footer>
    </aside>
  );
}
