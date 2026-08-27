use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkflowNodeKind {
    Trigger,
    Condition,
    Agent,
    Model,
    Tool,
    Memory,
    Loop,
    Transform,
    Output,
    HumanApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub id: String,
    pub kind: WorkflowNodeKind,
    pub label: String,
    pub config: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEdge {
    pub from: String,
    pub to: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationGraph {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
}

impl AutomationGraph {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            enabled: false,
            nodes: Vec::new(),
            edges: Vec::new(),
        }
    }

    pub fn validate(&self) -> Result<CompiledAutomation, AutomationError> {
        let node_map = self
            .nodes
            .iter()
            .map(|node| (node.id.as_str(), node))
            .collect::<BTreeMap<_, _>>();
        if node_map.len() != self.nodes.len() {
            return Err(AutomationError::DuplicateNodeId);
        }

        let triggers = self
            .nodes
            .iter()
            .filter(|node| node.kind == WorkflowNodeKind::Trigger)
            .map(|node| node.id.clone())
            .collect::<Vec<_>>();
        let outputs = self
            .nodes
            .iter()
            .filter(|node| node.kind == WorkflowNodeKind::Output)
            .map(|node| node.id.clone())
            .collect::<Vec<_>>();
        if triggers.is_empty() {
            return Err(AutomationError::MissingTrigger);
        }
        if outputs.is_empty() {
            return Err(AutomationError::MissingOutput);
        }

        let mut adjacency: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
        for edge in &self.edges {
            if !node_map.contains_key(edge.from.as_str()) {
                return Err(AutomationError::UnknownNode(edge.from.clone()));
            }
            if !node_map.contains_key(edge.to.as_str()) {
                return Err(AutomationError::UnknownNode(edge.to.clone()));
            }
            adjacency
                .entry(edge.from.as_str())
                .or_default()
                .push(edge.to.as_str());
        }

        let reachable = reachable_from(&triggers, &adjacency);
        for output in &outputs {
            if !reachable.contains(output.as_str()) {
                return Err(AutomationError::UnreachableOutput(output.clone()));
            }
        }

        Ok(CompiledAutomation {
            graph_id: self.id,
            triggers,
            outputs,
            reachable_nodes: reachable.into_iter().map(str::to_owned).collect(),
        })
    }
}

fn reachable_from<'a>(
    starts: &'a [String],
    adjacency: &BTreeMap<&'a str, Vec<&'a str>>,
) -> BTreeSet<&'a str> {
    let mut seen = BTreeSet::new();
    let mut queue = starts.iter().map(String::as_str).collect::<VecDeque<_>>();
    while let Some(current) = queue.pop_front() {
        if !seen.insert(current) {
            continue;
        }
        if let Some(next) = adjacency.get(current) {
            queue.extend(next.iter().copied());
        }
    }
    seen
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledAutomation {
    pub graph_id: Uuid,
    pub triggers: Vec<String>,
    pub outputs: Vec<String>,
    pub reachable_nodes: Vec<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AutomationError {
    #[error("automation must contain at least one trigger")]
    MissingTrigger,
    #[error("automation must contain at least one output")]
    MissingOutput,
    #[error("automation contains duplicate node ids")]
    DuplicateNodeId,
    #[error("automation references unknown node: {0}")]
    UnknownNode(String),
    #[error("output is not reachable from a trigger: {0}")]
    UnreachableOutput(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_reachable_workflow() {
        let mut graph = AutomationGraph::new("analysis");
        graph.nodes = vec![
            WorkflowNode {
                id: "start".into(),
                kind: WorkflowNodeKind::Trigger,
                label: "Manual".into(),
                config: Value::Null,
            },
            WorkflowNode {
                id: "agent".into(),
                kind: WorkflowNodeKind::Agent,
                label: "Analyst".into(),
                config: Value::Null,
            },
            WorkflowNode {
                id: "done".into(),
                kind: WorkflowNodeKind::Output,
                label: "Result".into(),
                config: Value::Null,
            },
        ];
        graph.edges = vec![
            WorkflowEdge {
                from: "start".into(),
                to: "agent".into(),
                condition: None,
            },
            WorkflowEdge {
                from: "agent".into(),
                to: "done".into(),
                condition: None,
            },
        ];
        let compiled = graph.validate().expect("workflow compiles");
        assert_eq!(compiled.reachable_nodes.len(), 3);
    }
}
