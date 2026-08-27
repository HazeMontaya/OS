use std::time::{SystemTime, UNIX_EPOCH};

use os_contracts::{CognitiveEvent, Sensitivity, SystemSnapshot};
use os_event_ledger::EventLedger;
use os_knowledge_graph::KnowledgeGraph;
use os_memory::MemoryStore;
use serde_json::json;
use uuid::Uuid;

#[derive(Debug, Default)]
pub struct Kernel {
    ledger: EventLedger,
    memory: MemoryStore,
    graph: KnowledgeGraph,
}

impl Kernel {
    pub fn ingest_user_input(&mut self, content: String) {
        let now = now_ms();
        let event_id = Uuid::new_v4().to_string();
        self.ledger.append(CognitiveEvent {
            event_id,
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
        });
    }

    pub fn snapshot(&self) -> SystemSnapshot {
        SystemSnapshot {
            kernel_online: true,
            event_count: self.ledger.len(),
            memory_count: self.memory.len(),
            node_count: self.graph.node_count(),
            edge_count: self.graph.edge_count(),
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
