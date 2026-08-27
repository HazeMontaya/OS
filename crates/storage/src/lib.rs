use std::{fs, path::Path};

use os_contracts::{
    CognitiveEvent, EntityRecord, FactRecord, MemoryKind, MemoryRecord, RelationshipRecord,
    Sensitivity,
};
use rusqlite::{Connection, params};
use thiserror::Error;

const MIGRATION_0001: &str = include_str!("../migrations/0001_init.sql");

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database integrity check failed: {0}")]
    Integrity(String),
}

pub type Result<T> = std::result::Result<T, StorageError>;

pub struct Storage {
    connection: Connection,
}

impl Storage {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(path)?;
        Self::configure(&connection)?;
        let storage = Self { connection };
        storage.ensure_integrity()?;
        storage.migrate()?;
        Ok(storage)
    }

    pub fn in_memory() -> Result<Self> {
        let connection = Connection::open_in_memory()?;
        Self::configure(&connection)?;
        let storage = Self { connection };
        storage.ensure_integrity()?;
        storage.migrate()?;
        Ok(storage)
    }

    fn configure(connection: &Connection) -> Result<()> {
        connection.execute_batch(
            "PRAGMA foreign_keys = ON;\n\
             PRAGMA journal_mode = WAL;\n\
             PRAGMA synchronous = NORMAL;\n\
             PRAGMA busy_timeout = 5000;",
        )?;
        Ok(())
    }

    fn ensure_integrity(&self) -> Result<()> {
        let result: String = self
            .connection
            .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;

        if result == "ok" {
            Ok(())
        } else {
            Err(StorageError::Integrity(result))
        }
    }

    fn migrate(&self) -> Result<()> {
        let version: i64 = self
            .connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;

        if version < 1 {
            self.connection.execute_batch(MIGRATION_0001)?;
        }

        Ok(())
    }

    pub fn append_event(&mut self, event: &CognitiveEvent) -> Result<()> {
        let provenance_json = serde_json::to_string(&event.provenance)?;
        let sensitivity = sensitivity_name(event.sensitivity);
        let searchable_text = event
            .payload
            .get("content")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());

        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO events (\n\
                event_id, timestamp_ms, source, actor, event_type, payload_json,\n\
                context_id, session_id, project_id, sensitivity, trace_id, parent_event,\n\
                provenance_json, created_at_ms\n\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                &event.event_id,
                event.timestamp_ms,
                &event.source,
                &event.actor,
                &event.event_type,
                event.payload.to_string(),
                &event.context_id,
                &event.session_id,
                &event.project_id,
                sensitivity,
                &event.trace_id,
                &event.parent_event,
                provenance_json,
                event.timestamp_ms,
            ],
        )?;

        if let Some(text) = searchable_text {
            transaction.execute(
                "INSERT INTO event_fts (event_id, text) VALUES (?1, ?2)",
                params![&event.event_id, text],
            )?;
        }

        transaction.commit()?;
        Ok(())
    }

    pub fn upsert_entity(&self, entity: &EntityRecord) -> Result<()> {
        let aliases_json = serde_json::to_string(&entity.aliases)?;
        let provenance_json = serde_json::to_string(&entity.provenance)?;

        self.connection.execute(
            "INSERT INTO entities (\n\
                entity_id, kind, canonical_label, aliases_json, confidence,\n\
                first_seen_ms, last_seen_ms, provenance_json\n\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)\n\
             ON CONFLICT(entity_id) DO UPDATE SET\n\
                kind = excluded.kind,\n\
                canonical_label = excluded.canonical_label,\n\
                aliases_json = excluded.aliases_json,\n\
                confidence = excluded.confidence,\n\
                last_seen_ms = MAX(entities.last_seen_ms, excluded.last_seen_ms),\n\
                provenance_json = excluded.provenance_json",
            params![
                &entity.entity_id,
                &entity.kind,
                &entity.canonical_label,
                aliases_json,
                entity.confidence,
                entity.first_seen_ms,
                entity.last_seen_ms,
                provenance_json,
            ],
        )?;
        Ok(())
    }

    pub fn insert_fact(&self, fact: &FactRecord) -> Result<()> {
        let provenance_json = serde_json::to_string(&fact.provenance)?;

        self.connection.execute(
            "INSERT INTO facts (\n\
                fact_id, subject_id, predicate, object_json, confidence, valid_from_ms,\n\
                valid_until_ms, observed_at_ms, superseded_at_ms, provenance_json\n\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &fact.fact_id,
                &fact.subject_id,
                &fact.predicate,
                fact.object.to_string(),
                fact.confidence,
                fact.valid_from_ms,
                fact.valid_until_ms,
                fact.observed_at_ms,
                fact.superseded_at_ms,
                provenance_json,
            ],
        )?;
        Ok(())
    }

    pub fn supersede_fact(&self, fact_id: &str, at_ms: i64) -> Result<bool> {
        let changed = self.connection.execute(
            "UPDATE facts\n\
             SET valid_until_ms = COALESCE(valid_until_ms, ?2),\n\
                 superseded_at_ms = COALESCE(superseded_at_ms, ?2)\n\
             WHERE fact_id = ?1 AND superseded_at_ms IS NULL",
            params![fact_id, at_ms],
        )?;
        Ok(changed > 0)
    }

    pub fn insert_relationship(&self, relationship: &RelationshipRecord) -> Result<()> {
        let provenance_json = serde_json::to_string(&relationship.provenance)?;

        self.connection.execute(
            "INSERT INTO relationships (\n\
                edge_id, from_entity_id, to_entity_id, relation, weight, confidence,\n\
                valid_from_ms, valid_until_ms, provenance_json\n\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &relationship.edge_id,
                &relationship.from_entity_id,
                &relationship.to_entity_id,
                &relationship.relation,
                relationship.weight,
                relationship.confidence,
                relationship.valid_from_ms,
                relationship.valid_until_ms,
                provenance_json,
            ],
        )?;
        Ok(())
    }

    pub fn invalidate_relationship(&self, edge_id: &str, at_ms: i64) -> Result<bool> {
        let changed = self.connection.execute(
            "UPDATE relationships\n\
             SET valid_until_ms = COALESCE(valid_until_ms, ?2)\n\
             WHERE edge_id = ?1 AND valid_until_ms IS NULL",
            params![edge_id, at_ms],
        )?;
        Ok(changed > 0)
    }

    pub fn upsert_memory(&mut self, memory: &MemoryRecord) -> Result<()> {
        let provenance_json = serde_json::to_string(&memory.provenance)?;
        let transaction = self.connection.transaction()?;

        transaction.execute(
            "INSERT INTO memories (\n\
                memory_id, kind, text, relevance, confidence, first_seen_ms,\n\
                last_confirmed_ms, provenance_json\n\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)\n\
             ON CONFLICT(memory_id) DO UPDATE SET\n\
                kind = excluded.kind,\n\
                text = excluded.text,\n\
                relevance = excluded.relevance,\n\
                confidence = excluded.confidence,\n\
                last_confirmed_ms = MAX(memories.last_confirmed_ms, excluded.last_confirmed_ms),\n\
                provenance_json = excluded.provenance_json",
            params![
                &memory.id,
                memory_kind_name(&memory.kind),
                &memory.text,
                memory.relevance,
                memory.confidence,
                memory.first_seen_ms,
                memory.last_confirmed_ms,
                provenance_json,
            ],
        )?;

        transaction.execute(
            "DELETE FROM memory_fts WHERE memory_id = ?1",
            params![&memory.id],
        )?;
        transaction.execute(
            "INSERT INTO memory_fts (memory_id, text) VALUES (?1, ?2)",
            params![&memory.id, &memory.text],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn record_memory_retrieval(&self, memory_id: &str, successful: bool) -> Result<bool> {
        let successful_increment = i64::from(successful);
        let changed = self.connection.execute(
            "UPDATE memories\n\
             SET retrieval_count = retrieval_count + 1,\n\
                 successful_use_count = successful_use_count + ?2\n\
             WHERE memory_id = ?1",
            params![memory_id, successful_increment],
        )?;
        Ok(changed > 0)
    }

    pub fn event_count(&self) -> Result<usize> {
        self.count_table("events")
    }

    pub fn memory_count(&self) -> Result<usize> {
        self.count_table("memories")
    }

    pub fn entity_count(&self) -> Result<usize> {
        self.count_table("entities")
    }

    pub fn relationship_count(&self) -> Result<usize> {
        self.count_table("relationships")
    }

    fn count_table(&self, table: &str) -> Result<usize> {
        let sql = format!("SELECT COUNT(*) FROM {table}");
        let count: i64 = self.connection.query_row(&sql, [], |row| row.get(0))?;
        Ok(count.max(0) as usize)
    }

    pub fn search_event_ids(&self, query: &str, limit: usize) -> Result<Vec<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT event_id FROM event_fts WHERE event_fts MATCH ?1 LIMIT ?2")?;
        let rows = statement.query_map(params![query, limit as i64], |row| row.get(0))?;
        Ok(rows.collect::<std::result::Result<Vec<String>, rusqlite::Error>>()?)
    }

    pub fn search_memory_ids(&self, query: &str, limit: usize) -> Result<Vec<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT memory_id FROM memory_fts WHERE memory_fts MATCH ?1 LIMIT ?2")?;
        let rows = statement.query_map(params![query, limit as i64], |row| row.get(0))?;
        Ok(rows.collect::<std::result::Result<Vec<String>, rusqlite::Error>>()?)
    }
}

fn sensitivity_name(sensitivity: Sensitivity) -> &'static str {
    match sensitivity {
        Sensitivity::Normal => "normal",
        Sensitivity::Personal => "personal",
        Sensitivity::Confidential => "confidential",
        Sensitivity::SecretReference => "secret_reference",
    }
}

fn memory_kind_name(kind: &MemoryKind) -> &'static str {
    match kind {
        MemoryKind::Working => "working",
        MemoryKind::Episodic => "episodic",
        MemoryKind::Semantic => "semantic",
        MemoryKind::Procedural => "procedural",
        MemoryKind::Stable => "stable",
        MemoryKind::Preference => "preference",
        MemoryKind::Project => "project",
        MemoryKind::SelfModel => "self_model",
        MemoryKind::WorldModel => "world_model",
    }
}

#[cfg(test)]
mod tests {
    use os_contracts::{
        CognitiveEvent, EntityRecord, FactRecord, MemoryKind, MemoryRecord, RelationshipRecord,
        Sensitivity,
    };
    use serde_json::json;

    use super::Storage;

    #[test]
    fn persists_and_indexes_events() {
        let mut storage = Storage::in_memory().expect("open in-memory storage");
        let event = CognitiveEvent {
            event_id: "event-1".into(),
            timestamp_ms: 1,
            source: "test".into(),
            actor: "user".into(),
            event_type: "user.input".into(),
            payload: json!({ "content": "persistent cognitive memory" }),
            context_id: None,
            session_id: None,
            project_id: None,
            sensitivity: Sensitivity::Normal,
            trace_id: "trace-1".into(),
            parent_event: None,
            provenance: vec!["test".into()],
        };

        storage.append_event(&event).expect("append event");

        assert_eq!(storage.event_count().expect("event count"), 1);
        assert_eq!(
            storage
                .search_event_ids("cognitive", 10)
                .expect("fts search"),
            vec!["event-1".to_string()]
        );
    }

    #[test]
    fn manages_temporal_graph_and_memory_records() {
        let mut storage = Storage::in_memory().expect("open in-memory storage");

        for entity in [
            EntityRecord {
                entity_id: "os".into(),
                kind: "product".into(),
                canonical_label: "OS".into(),
                aliases: vec![],
                confidence: 1.0,
                first_seen_ms: 10,
                last_seen_ms: 10,
                provenance: vec!["test".into()],
            },
            EntityRecord {
                entity_id: "memory".into(),
                kind: "concept".into(),
                canonical_label: "Memory".into(),
                aliases: vec![],
                confidence: 1.0,
                first_seen_ms: 10,
                last_seen_ms: 10,
                provenance: vec!["test".into()],
            },
        ] {
            storage.upsert_entity(&entity).expect("upsert entity");
        }

        storage
            .insert_fact(&FactRecord {
                fact_id: "fact-1".into(),
                subject_id: "os".into(),
                predicate: "has_capability".into(),
                object: json!({ "entity_id": "memory" }),
                confidence: 0.95,
                valid_from_ms: 10,
                valid_until_ms: None,
                observed_at_ms: 10,
                superseded_at_ms: None,
                provenance: vec!["test".into()],
            })
            .expect("insert fact");
        assert!(
            storage
                .supersede_fact("fact-1", 20)
                .expect("supersede fact")
        );

        storage
            .insert_relationship(&RelationshipRecord {
                edge_id: "edge-1".into(),
                from_entity_id: "os".into(),
                to_entity_id: "memory".into(),
                relation: "uses".into(),
                weight: 0.8,
                confidence: 0.9,
                valid_from_ms: 10,
                valid_until_ms: None,
                provenance: vec!["test".into()],
            })
            .expect("insert relationship");
        assert!(
            storage
                .invalidate_relationship("edge-1", 20)
                .expect("invalidate relationship")
        );

        storage
            .upsert_memory(&MemoryRecord {
                id: "memory-1".into(),
                kind: MemoryKind::Semantic,
                text: "OS uses durable temporal memory".into(),
                relevance: 0.9,
                confidence: 0.95,
                first_seen_ms: 10,
                last_confirmed_ms: 10,
                provenance: vec!["test".into()],
            })
            .expect("upsert memory");

        assert_eq!(storage.entity_count().expect("entity count"), 2);
        assert_eq!(storage.relationship_count().expect("edge count"), 1);
        assert_eq!(storage.memory_count().expect("memory count"), 1);
        assert_eq!(
            storage
                .search_memory_ids("temporal", 10)
                .expect("memory search"),
            vec!["memory-1".to_string()]
        );
        assert!(
            storage
                .record_memory_retrieval("memory-1", true)
                .expect("record retrieval")
        );
    }
}
