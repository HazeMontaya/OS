use std::collections::HashMap;

use os_contracts::{CognitiveEdge, CognitiveNode};

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
        self.edges.push(edge);
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }
}
