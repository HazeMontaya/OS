use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use os_contracts::{
    CognitiveEdge, CognitiveEvent, CognitiveNode, EntityRecord, GraphSnapshot, MemoryKind,
    MemoryRecord, RelationshipRecord, Sensitivity, SystemSnapshot,
};
use os_event_ledger::EventLedger;
use os_knowledge_graph::KnowledgeGraph;
use os_memory::MemoryStore;
use os_retrieval::{RecallHit, RetrievalEngine};
use os_storage::{Storage, StorageError};
use os_telemetry::{SignalKind, TelemetryBuffer, TraceSignal};
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
    retrieval: RetrievalEngine,
    telemetry: TelemetryBuffer,
}

impl Kernel {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, KernelError> {
        Self::from_storage(Storage::open(path)?)
    }

    pub fn in_memory() -> Result<Self, KernelError> {
        Self::from_storage(Storage::in_memory()?)
    }

    fn from_storage(storage: Storage) -> Result<Self, KernelError> {
        let mut memory = MemoryStore::default();
        for record in storage.load_memories()? {
            memory.upsert(record);
        }

        let mut graph = KnowledgeGraph::default();
        for entity in storage.load_entities()? {
            let importance = node_importance(&entity.kind);
            graph.upsert_node(CognitiveNode {
                id: entity.entity_id,
                kind: entity.kind,
                label: entity.canonical_label,
                importance,
                confidence: entity.confidence,
            });
        }
        for relationship in storage.load_relationships()? {
            graph.add_edge(CognitiveEdge {
                id: relationship.edge_id,
                from: relationship.from_entity_id,
                to: relationship.to_entity_id,
                relation: relationship.relation,
                weight: relationship.weight,
                valid_from_ms: relationship.valid_from_ms,
                valid_until_ms: relationship.valid_until_ms,
                provenance: relationship.provenance,
            });
        }

        let now = now_ms();
        let self_entity = EntityRecord {
            entity_id: "self:os".into(),
            kind: "self_model".into(),
            canonical_label: "OS".into(),
            aliases: vec!["Cognitive Operating Environment".into()],
            confidence: 1.0,
            first_seen_ms: now,
            last_seen_ms: now,
            provenance: vec!["kernel:bootstrap".into()],
        };
        storage.upsert_entity(&self_entity)?;
        graph.upsert_node(CognitiveNode {
            id: self_entity.entity_id,
            kind: self_entity.kind,
            label: self_entity.canonical_label,
            importance: 1.0,
            confidence: 1.0,
        });

        Ok(Self {
            storage,
            ledger: EventLedger::default(),
            memory,
            graph,
            retrieval: RetrievalEngine::default(),
            telemetry: TelemetryBuffer::default(),
        })
    }

    pub fn ingest_user_input(&mut self, content: String) -> Result<(), KernelError> {
        let content = content.trim().to_string();
        if content.is_empty() {
            return Ok(());
        }

        let now = now_ms();
        let event_id = Uuid::new_v4().to_string();
        let trace_id = Uuid::new_v4().to_string();
        let memory_id = format!("memory:{event_id}");
        let actor_id = "actor:user".to_string();

        let mut trace = TraceSignal::start(
            trace_id.clone(),
            SignalKind::Input,
            "kernel.ingest_user_input",
        );

        let event = CognitiveEvent {
            event_id: event_id.clone(),
            timestamp_ms: now,
            source: "desktop.command_bar".into(),
            actor: "user".into(),
            event_type: "user.input".into(),
            payload: json!({ "content": content.clone() }),
            context_id: None,
            session_id: None,
            project_id: None,
            sensitivity: Sensitivity::Normal,
            trace_id: trace_id.clone(),
            parent_event: None,
            provenance: vec!["local:user-input".into()],
        };

        self.storage.append_event(&event)?;
        self.ledger.append(event.clone());

        let memory = MemoryRecord {
            id: memory_id.clone(),
            kind: MemoryKind::Episodic,
            text: content.clone(),
            relevance: 0.75,
            confidence: 1.0,
            first_seen_ms: now,
            last_confirmed_ms: now,
            provenance: vec![event_id.clone()],
        };
        self.storage.upsert_memory(&memory)?;
        self.memory.upsert(memory);

        let actor_entity = EntityRecord {
            entity_id: actor_id.clone(),
            kind: "actor".into(),
            canonical_label: "User".into(),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: now,
            last_seen_ms: now,
            provenance: vec![event_id.clone()],
        };
        let memory_entity = EntityRecord {
            entity_id: memory_id.clone(),
            kind: "episodic_memory".into(),
            canonical_label: compact_label(&content),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: now,
            last_seen_ms: now,
            provenance: vec![event_id.clone()],
        };
        self.storage.upsert_entity(&actor_entity)?;
        self.storage.upsert_entity(&memory_entity)?;

        let relationship = RelationshipRecord {
            edge_id: format!("edge:{event_id}:generated"),
            from_entity_id: actor_id.clone(),
            to_entity_id: memory_id.clone(),
            relation: "generated".into(),
            weight: 1.0,
            confidence: 1.0,
            valid_from_ms: now,
            valid_until_ms: None,
            provenance: vec![event_id.clone()],
        };
        self.storage.insert_relationship(&relationship)?;

        self.graph.upsert_node(CognitiveNode {
            id: actor_id.clone(),
            kind: "actor".into(),
            label: "User".into(),
            importance: node_importance("actor"),
            confidence: 1.0,
        });
        self.graph.upsert_node(CognitiveNode {
            id: memory_id.clone(),
            kind: "episodic_memory".into(),
            label: compact_label(&content),
            importance: node_importance("episodic_memory"),
            confidence: 1.0,
        });
        self.graph.add_edge(CognitiveEdge {
            id: relationship.edge_id,
            from: actor_id,
            to: memory_id,
            relation: relationship.relation,
            weight: relationship.weight,
            valid_from_ms: now,
            valid_until_ms: None,
            provenance: vec![event_id],
        });

        trace.complete(true);
        self.telemetry.record(trace);
        Ok(())
    }

    pub fn recall(&mut self, query: &str, limit: usize) -> Result<Vec<RecallHit>, KernelError> {
        let mut trace = TraceSignal::start(
            Uuid::new_v4().to_string(),
            SignalKind::MemoryRecall,
            "kernel.recall",
        );
        let hits = self
            .retrieval
            .lexical_event_recall(&self.storage, query, limit)?;
        trace.complete(true);
        self.telemetry.record(trace);
        Ok(hits)
    }

    pub fn snapshot(&self) -> SystemSnapshot {
        SystemSnapshot {
            kernel_online: true,
            event_count: self
                .storage
                .event_count()
                .unwrap_or_else(|_| self.ledger.len()),
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

    pub fn graph_snapshot(&self) -> GraphSnapshot {
        self.graph.snapshot()
    }

    pub fn telemetry_count(&self) -> usize {
        self.telemetry.len()
    }
}

fn node_importance(kind: &str) -> f32 {
    match kind {
        "self_model" => 1.0,
        "actor" => 0.95,
        "semantic_memory" | "stable_memory" => 0.85,
        "episodic_memory" => 0.70,
        "project" | "goal" => 0.82,
        "agent" | "model" | "tool" => 0.78,
        _ => 0.55,
    }
}

fn compact_label(value: &str) -> String {
    const MAX: usize = 72;
    let mut label = value.chars().take(MAX).collect::<String>();
    if value.chars().count() > MAX {
        label.push('…');
    }
    label
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
    fn kernel_bootstraps_self_model() {
        let kernel = Kernel::in_memory().expect("create kernel");
        let graph = kernel.graph_snapshot();
        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(graph.nodes[0].id, "self:os");
    }

    #[test]
    fn input_materializes_event_memory_and_graph() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_user_input("remember this interaction".into())
            .expect("ingest event");

        let snapshot = kernel.snapshot();
        assert_eq!(snapshot.event_count, 1);
        assert_eq!(snapshot.memory_count, 1);
        assert_eq!(snapshot.node_count, 3);
        assert_eq!(snapshot.edge_count, 1);
        assert_eq!(kernel.telemetry_count(), 1);
        assert_eq!(kernel.graph_snapshot().nodes.len(), 3);
        assert_eq!(kernel.graph_snapshot().edges.len(), 1);
    }

    #[test]
    fn recall_uses_persistent_full_text_index() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_user_input("the temporal graph remembers provenance".into())
            .expect("ingest event");

        let hits = kernel.recall("provenance", 5).expect("recall");
        assert_eq!(hits.len(), 1);
    }
}
