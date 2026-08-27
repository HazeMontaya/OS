use std::{fs, path::Path};

use os_contracts::{
    CognitiveEvent, EntityRecord, FactRecord, MemoryKind, MemoryRecord, RelationshipRecord,
    Sensitivity,
};
use rusqlite::{params, Connection};
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
    #[error("invalid persisted data: {0}")]
    InvalidData(String),
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
        let searchable_text = event
            .payload
            .get("content")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());

        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO events (
                event_id, timestamp_ms, source, actor, event_type, payload_json,
                context_id, session_id, project_id, sensitivity, trace_id, parent_event,
                provenance_json, created_at_ms
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
                sensitivity_name(event.sensitivity),
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
        self.connection.execute(
            "INSERT INTO entities (
                entity_id, kind, canonical_label, aliases_json, confidence,
                first_seen_ms, last_seen_ms, provenance_json
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(entity_id) DO UPDATE SET
                kind = excluded.kind,
                canonical_label = excluded.canonical_label,
                aliases_json = excluded.aliases_json,
                confidence = excluded.confidence,
                last_seen_ms = MAX(entities.last_seen_ms, excluded.last_seen_ms),
                provenance_json = excluded.provenance_json",
            params![
                &entity.entity_id,
                &entity.kind,
                &entity.canonical_label,
                serde_json::to_string(&entity.aliases)?,
                entity.confidence,
                entity.first_seen_ms,
                entity.last_seen_ms,
                serde_json::to_string(&entity.provenance)?,
            ],
        )?;
        Ok(())
    }

    pub fn insert_fact(&self, fact: &FactRecord) -> Result<()> {
        self.connection.execute(
            "INSERT INTO facts (
                fact_id, subject_id, predicate, object_json, confidence, valid_from_ms,
                valid_until_ms, observed_at_ms, superseded_at_ms, provenance_json
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
                serde_json::to_string(&fact.provenance)?,
            ],
        )?;
        Ok(())
    }

    pub fn supersede_fact(&self, fact_id: &str, at_ms: i64) -> Result<bool> {
        let changed = self.connection.execute(
            "UPDATE facts
             SET valid_until_ms = COALESCE(valid_until_ms, ?2),
                 superseded_at_ms = COALESCE(superseded_at_ms, ?2)
             WHERE fact_id = ?1 AND superseded_at_ms IS NULL",
            params![fact_id, at_ms],
        )?;
        Ok(changed > 0)
    }

    pub fn insert_relationship(&self, relationship: &RelationshipRecord) -> Result<()> {
        self.connection.execute(
            "INSERT INTO relationships (
                edge_id, from_entity_id, to_entity_id, relation, weight, confidence,
                valid_from_ms, valid_until_ms, provenance_json
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(edge_id) DO UPDATE SET
                from_entity_id = excluded.from_entity_id,
                to_entity_id = excluded.to_entity_id,
                relation = excluded.relation,
                weight = excluded.weight,
                confidence = excluded.confidence,
                valid_until_ms = excluded.valid_until_ms,
                provenance_json = excluded.provenance_json",
            params![
                &relationship.edge_id,
                &relationship.from_entity_id,
                &relationship.to_entity_id,
                &relationship.relation,
                relationship.weight,
                relationship.confidence,
                relationship.valid_from_ms,
                relationship.valid_until_ms,
                serde_json::to_string(&relationship.provenance)?,
            ],
        )?;
        Ok(())
    }

    pub fn invalidate_relationship(&self, edge_id: &str, at_ms: i64) -> Result<bool> {
        let changed = self.connection.execute(
            "UPDATE relationships
             SET valid_until_ms = COALESCE(valid_until_ms, ?2)
             WHERE edge_id = ?1 AND valid_until_ms IS NULL",
            params![edge_id, at_ms],
        )?;
        Ok(changed > 0)
    }

    pub fn upsert_memory(&mut self, memory: &MemoryRecord) -> Result<()> {
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO memories (
                memory_id, kind, text, relevance, confidence, first_seen_ms,
                last_confirmed_ms, provenance_json
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(memory_id) DO UPDATE SET
                kind = excluded.kind,
                text = excluded.text,
                relevance = excluded.relevance,
                confidence = excluded.confidence,
                last_confirmed_ms = MAX(memories.last_confirmed_ms, excluded.last_confirmed_ms),
                provenance_json = excluded.provenance_json",
            params![
                &memory.id,
                memory_kind_name(&memory.kind),
                &memory.text,
                memory.relevance,
                memory.confidence,
                memory.first_seen_ms,
                memory.last_confirmed_ms,
                serde_json::to_string(&memory.provenance)?,
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
        let changed = self.connection.execute(
            "UPDATE memories
             SET retrieval_count = retrieval_count + 1,
                 successful_use_count = successful_use_count + ?2
             WHERE memory_id = ?1",
            params![memory_id, i64::from(successful)],
        )?;
        Ok(changed > 0)
    }

    pub fn load_entities(&self) -> Result<Vec<EntityRecord>> {
        let mut statement = self.connection.prepare(
            "SELECT entity_id, kind, canonical_label, aliases_json, confidence,
                    first_seen_ms, last_seen_ms, provenance_json
             FROM entities ORDER BY entity_id",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, String>(7)?,
            ))
        })?;

        let mut entities = Vec::new();
        for row in rows {
            let (entity_id, kind, canonical_label, aliases, confidence, first_seen_ms, last_seen_ms, provenance) = row?;
            entities.push(EntityRecord {
                entity_id,
                kind,
                canonical_label,
                aliases: serde_json::from_str(&aliases)?,
                confidence,
                first_seen_ms,
                last_seen_ms,
                provenance: serde_json::from_str(&provenance)?,
            });
        }
        Ok(entities)
    }

    pub fn load_relationships(&self) -> Result<Vec<RelationshipRecord>> {
        let mut statement = self.connection.prepare(
            "SELECT edge_id, from_entity_id, to_entity_id, relation, weight, confidence,
                    valid_from_ms, valid_until_ms, provenance_json
             FROM relationships ORDER BY edge_id",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, f32>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, String>(8)?,
            ))
        })?;

        let mut relationships = Vec::new();
        for row in rows {
            let (edge_id, from_entity_id, to_entity_id, relation, weight, confidence, valid_from_ms, valid_until_ms, provenance) = row?;
            relationships.push(RelationshipRecord {
                edge_id,
                from_entity_id,
                to_entity_id,
                relation,
                weight,
                confidence,
                valid_from_ms,
                valid_until_ms,
                provenance: serde_json::from_str(&provenance)?,
            });
        }
        Ok(relationships)
    }

    pub fn load_memories(&self) -> Result<Vec<MemoryRecord>> {
        let mut statement = self.connection.prepare(
            "SELECT memory_id, kind, text, relevance, confidence, first_seen_ms,
                    last_confirmed_ms, provenance_json
             FROM memories ORDER BY memory_id",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f32>(3)?,
                row.get::<_, f32>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, String>(7)?,
            ))
        })?;

        let mut memories = Vec::new();
        for row in rows {
            let (id, kind, text, relevance, confidence, first_seen_ms, last_confirmed_ms, provenance) = row?;
            memories.push(MemoryRecord {
                id,
                kind: parse_memory_kind(&kind)?,
                text,
                relevance,
                confidence,
                first_seen_ms,
                last_confirmed_ms,
                provenance: serde_json::from_str(&provenance)?,
            });
        }
        Ok(memories)
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

fn parse_memory_kind(value: &str) -> Result<MemoryKind> {
    match value {
        "working" => Ok(MemoryKind::Working),
        "episodic" => Ok(MemoryKind::Episodic),
        "semantic" => Ok(MemoryKind::Semantic),
        "procedural" => Ok(MemoryKind::Procedural),
        "stable" => Ok(MemoryKind::Stable),
        "preference" => Ok(MemoryKind::Preference),
        "project" => Ok(MemoryKind::Project),
        "self_model" => Ok(MemoryKind::SelfModel),
        "world_model" => Ok(MemoryKind::WorldModel),
        other => Err(StorageError::InvalidData(format!("unknown memory kind '{other}'"))),
    }
}

#[cfg(test)]
mod tests {
    use os_contracts::{
        CognitiveEvent, EntityRecord, MemoryKind, MemoryRecord, RelationshipRecord, Sensitivity,
    };
    use serde_json::json;

    use super::Storage;

    #[test]
    fn persists_indexes_and_hydrates_cognitive_state() {
        let mut storage = Storage::in_memory().expect("open storage");
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

        let user = EntityRecord {
            entity_id: "actor:user".into(),
            kind: "actor".into(),
            canonical_label: "User".into(),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: 1,
            last_seen_ms: 1,
            provenance: vec!["event-1".into()],
        };
        let memory_entity = EntityRecord {
            entity_id: "memory:1".into(),
            kind: "episodic_memory".into(),
            canonical_label: "persistent cognitive memory".into(),
            aliases: vec![],
            confidence: 1.0,
            first_seen_ms: 1,
            last_seen_ms: 1,
            provenance: vec!["event-1".into()],
        };
        storage.upsert_entity(&user).expect("user entity");
        storage.upsert_entity(&memory_entity).expect("memory entity");
        storage
            .insert_relationship(&RelationshipRecord {
                edge_id: "edge-1".into(),
                from_entity_id: "actor:user".into(),
                to_entity_id: "memory:1".into(),
                relation: "generated".into(),
                weight: 1.0,
                confidence: 1.0,
                valid_from_ms: 1,
                valid_until_ms: None,
                provenance: vec!["event-1".into()],
            })
            .expect("relationship");
        storage
            .upsert_memory(&MemoryRecord {
                id: "memory:1".into(),
                kind: MemoryKind::Episodic,
                text: "persistent cognitive memory".into(),
                relevance: 0.8,
                confidence: 1.0,
                first_seen_ms: 1,
                last_confirmed_ms: 1,
                provenance: vec!["event-1".into()],
            })
            .expect("memory");

        assert_eq!(storage.load_entities().expect("entities").len(), 2);
        assert_eq!(storage.load_relationships().expect("relationships").len(), 1);
        assert_eq!(storage.load_memories().expect("memories").len(), 1);
        assert_eq!(
            storage.search_memory_ids("cognitive", 5).expect("memory search"),
            vec!["memory:1".to_string()]
        );
    }
}
