use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveEvent {
    pub event_id: String,
    pub timestamp_ms: i64,
    pub source: String,
    pub actor: String,
    pub event_type: String,
    pub payload: Value,
    pub context_id: Option<String>,
    pub session_id: Option<String>,
    pub project_id: Option<String>,
    pub sensitivity: Sensitivity,
    pub trace_id: String,
    pub parent_event: Option<String>,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Sensitivity {
    #[default]
    Normal,
    Personal,
    Confidential,
    SecretReference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRecord {
    pub id: String,
    pub kind: MemoryKind,
    pub text: String,
    pub relevance: f32,
    pub confidence: f32,
    pub first_seen_ms: i64,
    pub last_confirmed_ms: i64,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryKind {
    Working,
    Episodic,
    Semantic,
    Procedural,
    Stable,
    Preference,
    Project,
    SelfModel,
    WorldModel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRecord {
    pub entity_id: String,
    pub kind: String,
    pub canonical_label: String,
    pub aliases: Vec<String>,
    pub confidence: f32,
    pub first_seen_ms: i64,
    pub last_seen_ms: i64,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactRecord {
    pub fact_id: String,
    pub subject_id: String,
    pub predicate: String,
    pub object: Value,
    pub confidence: f32,
    pub valid_from_ms: i64,
    pub valid_until_ms: Option<i64>,
    pub observed_at_ms: i64,
    pub superseded_at_ms: Option<i64>,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipRecord {
    pub edge_id: String,
    pub from_entity_id: String,
    pub to_entity_id: String,
    pub relation: String,
    pub weight: f32,
    pub confidence: f32,
    pub valid_from_ms: i64,
    pub valid_until_ms: Option<i64>,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveNode {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub importance: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    pub relation: String,
    pub weight: f32,
    pub valid_from_ms: i64,
    pub valid_until_ms: Option<i64>,
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub kernel_online: bool,
    pub event_count: usize,
    pub memory_count: usize,
    pub node_count: usize,
    pub edge_count: usize,
}
