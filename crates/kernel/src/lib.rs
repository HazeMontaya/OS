use std::{
    collections::HashMap,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use os_contracts::{
    CognitiveEdge, CognitiveEvent, CognitiveNode, ContextItem, ContextPack, EntityRecord,
    GraphSnapshot, MemoryKind, MemoryRecord, RelationshipRecord, SystemSnapshot,
};
use os_event_ledger::EventLedger;
use os_knowledge_graph::KnowledgeGraph;
use os_memory::{MemoryCompileInput, MemoryCompiler, MemoryStore};
use os_privacy::PrivacyFilter;
use os_retrieval::{RecallHit, RetrievalEngine, RetrievalSignal};
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemanticMemoryProjection {
    pub memory_id: String,
    pub kind: String,
    pub text: String,
    pub updated_at_ms: i64,
}

pub struct Kernel {
    storage: Storage,
    ledger: EventLedger,
    memory: MemoryStore,
    memory_compiler: MemoryCompiler,
    graph: KnowledgeGraph,
    retrieval: RetrievalEngine,
    privacy: PrivacyFilter,
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
            memory_compiler: MemoryCompiler,
            graph,
            retrieval: RetrievalEngine::default(),
            privacy: PrivacyFilter,
            telemetry: TelemetryBuffer::default(),
        })
    }

    pub fn ingest_user_input(
        &mut self,
        content: String,
    ) -> Result<Option<SemanticMemoryProjection>, KernelError> {
        self.ingest_text(
            content,
            "actor:user",
            "User",
            "actor",
            "user",
            "desktop.command_bar",
            "user.input",
            SignalKind::Input,
            true,
        )
    }

    pub fn ingest_assistant_output(
        &mut self,
        content: String,
        model_id: &str,
    ) -> Result<Option<SemanticMemoryProjection>, KernelError> {
        let model_id = model_id.trim();
        let model_label = if model_id.is_empty() {
            "Local model"
        } else {
            model_id
        };
        let actor_id = format!("model:{model_label}");
        self.ingest_text(
            content,
            &actor_id,
            model_label,
            "model",
            model_label,
            "model.gateway",
            "assistant.output",
            SignalKind::Output,
            false,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn ingest_text(
        &mut self,
        content: String,
        actor_id: &str,
        actor_label: &str,
        actor_kind: &str,
        actor_event_name: &str,
        source: &str,
        event_type: &str,
        signal_kind: SignalKind,
        allow_memory_promotion: bool,
    ) -> Result<Option<SemanticMemoryProjection>, KernelError> {
        let content = content.trim().to_string();
        if content.is_empty() {
            return Ok(None);
        }

        let privacy = self.privacy.assess(&content);
        let stored_content = privacy.stored_text.clone();
        let now = now_ms();
        let event_id = Uuid::new_v4().to_string();
        let trace_id = Uuid::new_v4().to_string();
        let memory_id = format!("memory:{event_id}");

        let mut trace = TraceSignal::start(trace_id.clone(), signal_kind, event_type);
        let event = CognitiveEvent {
            event_id: event_id.clone(),
            timestamp_ms: now,
            source: source.into(),
            actor: actor_event_name.into(),
            event_type: event_type.into(),
            payload: json!({
                "content": stored_content.clone(),
                "redacted": privacy.redacted,
                "secret_categories": privacy.secret_categories,
            }),
            context_id: None,
            session_id: None,
            project_id: None,
            sensitivity: privacy.sensitivity,
            trace_id,
            parent_event: None,
            provenance: vec![format!("local:{source}")],
        };

        self.storage.append_event(&event)?;
        self.ledger.append(event);

        let mut memory = self.memory_compiler.compile(MemoryCompileInput {
            id: memory_id.clone(),
            text: stored_content.clone(),
            sensitivity: privacy.sensitivity,
            observed_at_ms: now,
            provenance: vec![event_id.clone()],
        });
        if !allow_memory_promotion && !privacy.redacted {
            memory.kind = MemoryKind::Episodic;
            memory.relevance = memory.relevance.min(0.68);
        }
        let semantic_projection = (!privacy.redacted).then(|| semantic_projection(&memory));
        let memory_entity_kind = if privacy.redacted {
            "secret_reference"
        } else {
            memory_node_kind(&memory.kind)
        };
        let memory_relevance = memory.relevance;
        self.storage.upsert_memory(&memory)?;
        self.memory.upsert(memory);

        let actor_entity = EntityRecord {
            entity_id: actor_id.into(),
            kind: actor_kind.into(),
            canonical_label: actor_label.into(),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: now,
            last_seen_ms: now,
            provenance: vec![event_id.clone()],
        };
        let memory_entity = EntityRecord {
            entity_id: memory_id.clone(),
            kind: memory_entity_kind.into(),
            canonical_label: compact_label(&stored_content),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: now,
            last_seen_ms: now,
            provenance: vec![event_id.clone()],
        };
        self.storage.upsert_entity(&actor_entity)?;
        self.storage.upsert_entity(&memory_entity)?;

        let generated = RelationshipRecord {
            edge_id: format!("edge:{event_id}:generated"),
            from_entity_id: actor_id.into(),
            to_entity_id: memory_id.clone(),
            relation: "generated".into(),
            weight: (0.4 + memory_relevance * 0.6).clamp(0.0, 1.0),
            confidence: 1.0,
            valid_from_ms: now,
            valid_until_ms: None,
            provenance: vec![event_id.clone()],
        };
        self.storage.insert_relationship(&generated)?;

        self.graph.upsert_node(CognitiveNode {
            id: actor_id.into(),
            kind: actor_kind.into(),
            label: actor_label.into(),
            importance: node_importance(actor_kind),
            confidence: 1.0,
        });
        self.graph.upsert_node(CognitiveNode {
            id: memory_id.clone(),
            kind: memory_entity_kind.into(),
            label: compact_label(&stored_content),
            importance: ((node_importance(memory_entity_kind) + memory_relevance) / 2.0)
                .clamp(0.0, 1.0),
            confidence: 1.0,
        });
        self.graph.add_edge(CognitiveEdge {
            id: generated.edge_id,
            from: actor_id.into(),
            to: memory_id,
            relation: generated.relation,
            weight: generated.weight,
            valid_from_ms: now,
            valid_until_ms: None,
            provenance: vec![event_id.clone()],
        });

        if actor_kind == "model" {
            let invoked = RelationshipRecord {
                edge_id: format!("edge:self:invokes:{actor_id}"),
                from_entity_id: "self:os".into(),
                to_entity_id: actor_id.into(),
                relation: "invokes".into(),
                weight: 0.82,
                confidence: 1.0,
                valid_from_ms: now,
                valid_until_ms: None,
                provenance: vec![event_id],
            };
            self.storage.insert_relationship(&invoked)?;
            self.graph.add_edge(CognitiveEdge {
                id: invoked.edge_id,
                from: invoked.from_entity_id,
                to: invoked.to_entity_id,
                relation: invoked.relation,
                weight: invoked.weight,
                valid_from_ms: invoked.valid_from_ms,
                valid_until_ms: None,
                provenance: invoked.provenance,
            });
        }

        trace.complete(true);
        self.telemetry.record(trace);
        Ok(semantic_projection)
    }

    pub fn lexical_memory_hits(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<RecallHit>, KernelError> {
        let query = query.trim();
        if query.is_empty() || limit == 0 {
            return Ok(Vec::new());
        }
        Ok(self
            .retrieval
            .lexical_memory_recall(&self.storage, query, limit)?)
    }

    pub fn hybrid_context_pack(
        &mut self,
        query: &str,
        lexical_hits: &[RecallHit],
        semantic_scores: &[(String, f32)],
        limit: usize,
    ) -> Result<ContextPack, KernelError> {
        let query = query.trim();
        if query.is_empty() || limit == 0 {
            return Ok(ContextPack {
                query: query.to_string(),
                items: Vec::new(),
            });
        }

        let mut trace = TraceSignal::start(
            Uuid::new_v4().to_string(),
            SignalKind::MemoryRecall,
            "kernel.hybrid_context_pack",
        );
        let mut signals = HashMap::<String, RetrievalSignal>::new();

        for hit in lexical_hits {
            let signal = signals
                .entry(hit.id.clone())
                .or_insert_with(|| empty_retrieval_signal(hit.id.clone()));
            signal.lexical = signal.lexical.max(hit.score.clamp(0.0, 1.0));
        }
        for (memory_id, score) in semantic_scores {
            let signal = signals
                .entry(memory_id.clone())
                .or_insert_with(|| empty_retrieval_signal(memory_id.clone()));
            signal.semantic = signal.semantic.max(score.clamp(0.0, 1.0));
        }

        let now = now_ms();
        for signal in signals.values_mut() {
            let Some(memory) = self
                .memory
                .all()
                .iter()
                .find(|memory| memory.id == signal.id)
            else {
                continue;
            };
            if is_protected_memory(memory) {
                continue;
            }
            signal.temporal = temporal_score(now, memory.last_confirmed_ms);
            signal.procedural = if matches!(memory.kind, MemoryKind::Procedural) {
                1.0
            } else {
                0.0
            };
        }

        let ranked = self.retrieval.rank(signals.into_values().collect());
        let mut items = Vec::with_capacity(limit.min(ranked.len()));
        for hit in ranked.iter().take(limit) {
            let Some(memory) = self.memory.all().iter().find(|memory| memory.id == hit.id) else {
                continue;
            };
            if is_protected_memory(memory) {
                continue;
            }
            self.storage.record_memory_retrieval(&memory.id, false)?;
            items.push(ContextItem {
                id: memory.id.clone(),
                text: memory.text.clone(),
                kind: memory.kind.clone(),
                score: hit.score,
                confidence: memory.confidence,
                provenance: memory.provenance.clone(),
            });
        }

        trace.complete(true);
        self.telemetry.record(trace);
        Ok(ContextPack {
            query: query.to_string(),
            items,
        })
    }

    pub fn context_pack(&mut self, query: &str, limit: usize) -> Result<ContextPack, KernelError> {
        let lexical = self.lexical_memory_hits(query, limit.saturating_mul(3).max(limit))?;
        self.hybrid_context_pack(query, &lexical, &[], limit)
    }

    pub fn semantic_memory_projections(&self) -> Vec<SemanticMemoryProjection> {
        self.memory
            .all()
            .iter()
            .filter(|memory| !is_protected_memory(memory))
            .map(semantic_projection)
            .collect()
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

fn empty_retrieval_signal(id: String) -> RetrievalSignal {
    RetrievalSignal {
        id,
        lexical: 0.0,
        semantic: 0.0,
        graph: 0.0,
        temporal: 0.0,
        procedural: 0.0,
    }
}

fn semantic_projection(memory: &MemoryRecord) -> SemanticMemoryProjection {
    SemanticMemoryProjection {
        memory_id: memory.id.clone(),
        kind: memory_node_kind(&memory.kind).into(),
        text: memory.text.clone(),
        updated_at_ms: memory.last_confirmed_ms,
    }
}

fn is_protected_memory(memory: &MemoryRecord) -> bool {
    memory.text.starts_with("[protected secret reference:")
}

fn temporal_score(now_ms: i64, last_confirmed_ms: i64) -> f32 {
    let age_ms = now_ms.saturating_sub(last_confirmed_ms).max(0) as f32;
    let age_days = age_ms / 86_400_000.0;
    (1.0 / (1.0 + age_days / 30.0)).clamp(0.0, 1.0)
}

fn memory_node_kind(kind: &MemoryKind) -> &'static str {
    match kind {
        MemoryKind::Working => "working_memory",
        MemoryKind::Episodic => "episodic_memory",
        MemoryKind::Semantic => "semantic_memory",
        MemoryKind::Procedural => "procedural_memory",
        MemoryKind::Stable => "stable_memory",
        MemoryKind::Preference => "preference_memory",
        MemoryKind::Project => "project_memory",
        MemoryKind::SelfModel => "self_model",
        MemoryKind::WorldModel => "world_model",
    }
}

fn node_importance(kind: &str) -> f32 {
    match kind {
        "self_model" => 1.0,
        "actor" => 0.95,
        "semantic_memory" | "stable_memory" => 0.85,
        "preference_memory" | "procedural_memory" => 0.80,
        "project_memory" | "project" | "goal" => 0.82,
        "episodic_memory" => 0.70,
        "secret_reference" => 0.35,
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
    }

    #[test]
    fn model_output_stays_ephemeral_until_consolidated() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_assistant_output("Always remember this invented claim".into(), "local-test")
            .expect("ingest output");
        let graph = kernel.graph_snapshot();
        assert!(graph.nodes.iter().any(|node| node.kind == "model"));
        assert!(
            graph
                .nodes
                .iter()
                .any(|node| node.kind == "episodic_memory")
        );
        assert!(!graph.nodes.iter().any(|node| node.kind == "stable_memory"));
    }

    #[test]
    fn context_pack_contains_memory_text_and_provenance() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_user_input("OS uses a temporal knowledge graph with provenance".into())
            .expect("ingest context");
        let pack = kernel
            .context_pack("temporal provenance", 5)
            .expect("context pack");
        assert_eq!(pack.items.len(), 1);
        assert!(pack.items[0].text.contains("temporal knowledge graph"));
        assert_eq!(pack.items[0].provenance.len(), 1);
    }

    #[test]
    fn semantic_signal_can_recall_memory_without_lexical_overlap() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        let projection = kernel
            .ingest_user_input("The nebula renderer uses hierarchical spatial clustering".into())
            .expect("ingest context")
            .expect("semantic projection");
        let pack = kernel
            .hybrid_context_pack(
                "unrelated literal terms",
                &[],
                &[(projection.memory_id, 0.94)],
                5,
            )
            .expect("hybrid context pack");
        assert_eq!(pack.items.len(), 1);
        assert!(pack.items[0].text.contains("hierarchical spatial clustering"));
    }

    #[test]
    fn explicit_rules_are_compiled_as_stable_memory() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        kernel
            .ingest_user_input("Grundregel: immer merken, dass Provenance erhalten bleibt".into())
            .expect("ingest stable rule");
        assert!(
            kernel
                .graph_snapshot()
                .nodes
                .iter()
                .any(|node| node.kind == "stable_memory")
        );
    }

    #[test]
    fn secrets_are_redacted_before_persistence_recall_and_embedding() {
        let mut kernel = Kernel::in_memory().expect("create kernel");
        let projection = kernel
            .ingest_user_input("api_key=ghp_supersecretvalue".into())
            .expect("ingest secret event");
        assert!(projection.is_none());
        assert!(
            kernel
                .recall("supersecretvalue", 5)
                .expect("secret recall")
                .is_empty()
        );
        assert!(
            kernel
                .graph_snapshot()
                .nodes
                .iter()
                .any(|node| node.kind == "secret_reference")
        );
    }
}
