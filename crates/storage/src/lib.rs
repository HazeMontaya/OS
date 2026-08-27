use std::{fs, path::Path};

use os_contracts::{CognitiveEvent, Sensitivity};
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
        storage.migrate()?;
        Ok(storage)
    }

    pub fn in_memory() -> Result<Self> {
        let connection = Connection::open_in_memory()?;
        Self::configure(&connection)?;
        let storage = Self { connection };
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

    pub fn event_count(&self) -> Result<usize> {
        let count: i64 = self
            .connection
            .query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))?;
        Ok(count.max(0) as usize)
    }

    pub fn search_event_ids(&self, query: &str, limit: usize) -> Result<Vec<String>> {
        let mut statement = self.connection.prepare(
            "SELECT event_id FROM event_fts WHERE event_fts MATCH ?1 LIMIT ?2",
        )?;
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

#[cfg(test)]
mod tests {
    use os_contracts::{CognitiveEvent, Sensitivity};
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
}
