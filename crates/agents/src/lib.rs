use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentState {
    Dormant,
    Spawned,
    Planning,
    Executing,
    Waiting,
    Evaluating,
    Completed,
    Failed,
    Blocked,
    Cancelled,
    Suspended,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpec {
    pub id: Uuid,
    pub name: String,
    pub objective: String,
    pub capabilities: Vec<String>,
    pub memory_scopes: Vec<String>,
    pub model_preferences: Vec<String>,
    pub max_parallel_actions: u16,
}

impl AgentSpec {
    pub fn new(name: impl Into<String>, objective: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            objective: objective.into(),
            capabilities: Vec::new(),
            memory_scopes: vec!["working".into(), "project".into()],
            model_preferences: Vec::new(),
            max_parallel_actions: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRecord {
    pub spec: AgentSpec,
    pub state: AgentState,
    pub revision: u64,
    pub active_trace_id: Option<Uuid>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AgentError {
    #[error("agent already registered: {0}")]
    Duplicate(Uuid),
    #[error("agent not found: {0}")]
    NotFound(Uuid),
    #[error("invalid agent state transition: {from:?} -> {to:?}")]
    InvalidTransition { from: AgentState, to: AgentState },
}

#[derive(Debug, Default)]
pub struct AgentRegistry {
    agents: BTreeMap<Uuid, AgentRecord>,
}

impl AgentRegistry {
    pub fn register(&mut self, spec: AgentSpec) -> Result<Uuid, AgentError> {
        let id = spec.id;
        if self.agents.contains_key(&id) {
            return Err(AgentError::Duplicate(id));
        }
        self.agents.insert(
            id,
            AgentRecord {
                spec,
                state: AgentState::Dormant,
                revision: 0,
                active_trace_id: None,
            },
        );
        Ok(id)
    }

    pub fn get(&self, id: Uuid) -> Option<&AgentRecord> {
        self.agents.get(&id)
    }

    pub fn list(&self) -> impl Iterator<Item = &AgentRecord> {
        self.agents.values()
    }

    pub fn transition(
        &mut self,
        id: Uuid,
        next: AgentState,
        trace_id: Option<Uuid>,
    ) -> Result<&AgentRecord, AgentError> {
        let record = self.agents.get_mut(&id).ok_or(AgentError::NotFound(id))?;
        if record.state != next && !valid_transition(record.state, next) {
            return Err(AgentError::InvalidTransition {
                from: record.state,
                to: next,
            });
        }
        record.state = next;
        record.revision = record.revision.saturating_add(1);
        record.active_trace_id = if matches!(
            next,
            AgentState::Completed
                | AgentState::Failed
                | AgentState::Cancelled
                | AgentState::Dormant
        ) {
            None
        } else {
            trace_id.or(record.active_trace_id)
        };
        Ok(record)
    }
}

fn valid_transition(from: AgentState, to: AgentState) -> bool {
    use AgentState::*;
    matches!(
        (from, to),
        (Dormant, Spawned)
            | (Spawned, Planning)
            | (Planning, Executing)
            | (Planning, Blocked)
            | (Planning, Cancelled)
            | (Executing, Waiting)
            | (Executing, Evaluating)
            | (Executing, Failed)
            | (Executing, Blocked)
            | (Executing, Suspended)
            | (Waiting, Executing)
            | (Waiting, Cancelled)
            | (Waiting, Suspended)
            | (Evaluating, Completed)
            | (Evaluating, Executing)
            | (Evaluating, Failed)
            | (Blocked, Planning)
            | (Blocked, Cancelled)
            | (Suspended, Executing)
            | (Suspended, Cancelled)
            | (Completed, Dormant)
            | (Failed, Dormant)
            | (Cancelled, Dormant)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforces_agent_lifecycle() {
        let mut registry = AgentRegistry::default();
        let id = registry
            .register(AgentSpec::new("analyst", "inspect repository"))
            .expect("agent registers");
        registry
            .transition(id, AgentState::Spawned, Some(Uuid::new_v4()))
            .expect("spawn works");
        registry
            .transition(id, AgentState::Planning, None)
            .expect("planning works");
        let error = registry
            .transition(id, AgentState::Completed, None)
            .expect_err("planning cannot jump to completed");
        assert!(matches!(error, AgentError::InvalidTransition { .. }));
    }
}
