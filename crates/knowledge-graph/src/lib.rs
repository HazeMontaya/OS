use std::collections::HashMap;

use os_contracts::{CognitiveEdge, CognitiveNode, GraphSnapshot};

#[derive(Debug, Default)]
pub struct KnowledgeGraph {
    nodes: HashMap<String, CognitiveNode>,
    edges: Vec<CognitiveEdge>,
}

impl KnowledgeGraph {
    pub fn upsert_node(&mut self, node: CognitiveNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    pub fn add_edge(&mut self, edge: CognitiveEdge) {
        if let Some(existing) = self.edges.iter_mut().find(|item| item.id == edge.id) {
            *existing = edge;
        } else {
            self.edges.push(edge);
        }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    pub fn snapshot(&self) -> GraphSnapshot {
        let mut nodes = self.nodes.values().cloned().collect::<Vec<_>>();
        let mut edges = self.edges.clone();
        nodes.sort_by(|a, b| a.id.cmp(&b.id));
        edges.sort_by(|a, b| a.id.cmp(&b.id));
        GraphSnapshot { nodes, edges }
    }
}

#[cfg(test)]
mod tests {
    use os_contracts::{CognitiveEdge, CognitiveNode};

    use super::KnowledgeGraph;

    #[test]
    fn snapshot_is_stable_and_edges_are_upserted() {
        let mut graph = KnowledgeGraph::default();
        graph.upsert_node(CognitiveNode {
            id: "b".into(),
            kind: "concept".into(),
            label: "B".into(),
            importance: 0.5,
            confidence: 1.0,
        });
        graph.upsert_node(CognitiveNode {
            id: "a".into(),
            kind: "concept".into(),
            label: "A".into(),
            importance: 0.5,
            confidence: 1.0,
        });
        graph.add_edge(CognitiveEdge {
            id: "edge".into(),
            from: "a".into(),
            to: "b".into(),
            relation: "related".into(),
            weight: 0.5,
            valid_from_ms: 1,
            valid_until_ms: None,
            provenance: vec![],
        });
        graph.add_edge(CognitiveEdge {
            id: "edge".into(),
            from: "a".into(),
            to: "b".into(),
            relation: "related".into(),
            weight: 0.8,
            valid_from_ms: 1,
            valid_until_ms: None,
            provenance: vec![],
        });

        let snapshot = graph.snapshot();
        assert_eq!(snapshot.nodes[0].id, "a");
        assert_eq!(snapshot.edges.len(), 1);
        assert_eq!(snapshot.edges[0].weight, 0.8);
    }
}
