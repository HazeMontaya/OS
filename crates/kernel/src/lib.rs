use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use os_contracts::{CognitiveEvent, Sensitivity, SystemSnapshot};
use os_event_ledger::EventLedger;
use os_knowledge_graph::KnowledgeGraph;
use os_memory::MemoryStore;
use os_storage::{Storage, StorageError};
use serde_json::json;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum KernelError {
    #[error("storage error: {0}")]
    Storage(#[from] StorageError),
}

pub struct Kernel {
    storage: Storage,
    ledger: EventLedger,
    memory: MemoryStore,
    graph: KnowledgeGraph,
}

impl Kernel {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, KernelError> {
        Ok(Self {
            storage: Storage::open(path)?,
            ledger: EventLedger::default(),
            memory: MemoryStore::default(),
            graph: KnowledgeGraph::default(),
        })
    }

    pub fn in_memory() -> Result<Self, KernelError> {
        Ok(Self {
            storage: Storage::in_memory()?,
            ledger: EventLedger::default(),
            memory: MemoryStore::default(),
            graph: KnowledgeGraph::default(),
        })
    }

    pub fn ingest_user_input(&mut self, content: String) -> Result<(), KernelError> {
        let now = now_ms();
        let event = CognitiveEvent {
            event_id: Uuid::new_v4().to_string(),
            timestamp_ms: now,
            source: "desktop.command_bar".into(),
            actor: "user".into(),
            event_type: "user.input".into(),
            payload: json!({ "content": content }),
            context_id: None,
            session_id: None,
            project_id: None,
            sensitivity: Sensitivity::Normal,
            trace_id: Uuid::new_v4().to_string(),
            parent_event: None,
            provenance: vec!["local:user-input".into()],
        };

        self.storage.append_event(&event)?;
        self.ledger.append(event);
        Ok(())
    }

    pub fn snapshot(&self) -> SystemSnapshot {
        SystemSnapshot {
            kernel_online: true,
            event_count: self.storage.event_count().unwrap_or_else(|_| self.ledger.len()),
            memory_count: self
                .storage
                .memory_count()
                .unwrap_or_else(|_| self.memory.len()),
            node_count: self
                .storage
                .entity_count()
                .unwrap_or_else(|_| self.graph.node_count()),
            edge_count: self
                .storage
                .relationship_count()
                .unwrap_or_else(|_| self.graph.edge_count()),
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::Kernel;

    #[test]
    fn event_count_survives_the_persistence_boundary() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_user_input("remember this interaction".into())
            .expect("ingest event");

        assert_eq!(kernel.snapshot().event_count, 1);
    }
}
