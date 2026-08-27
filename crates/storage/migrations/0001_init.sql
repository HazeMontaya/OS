PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    timestamp_ms INTEGER NOT NULL,
    source TEXT NOT NULL,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    context_id TEXT,
    session_id TEXT,
    project_id TEXT,
    sensitivity TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    parent_event TEXT,
    provenance_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_events_trace ON events(trace_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);

CREATE VIRTUAL TABLE IF NOT EXISTS event_fts USING fts5(
    event_id UNINDEXED,
    text,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS entities (
    entity_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    canonical_label TEXT NOT NULL,
    aliases_json TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 1.0,
    first_seen_ms INTEGER NOT NULL,
    last_seen_ms INTEGER NOT NULL,
    provenance_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS facts (
    fact_id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object_json TEXT NOT NULL,
    confidence REAL NOT NULL,
    valid_from_ms INTEGER NOT NULL,
    valid_until_ms INTEGER,
    observed_at_ms INTEGER NOT NULL,
    superseded_at_ms INTEGER,
    provenance_json TEXT NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject_id);
CREATE INDEX IF NOT EXISTS idx_facts_validity ON facts(valid_from_ms, valid_until_ms);

CREATE TABLE IF NOT EXISTS relationships (
    edge_id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    weight REAL NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    valid_from_ms INTEGER NOT NULL,
    valid_until_ms INTEGER,
    provenance_json TEXT NOT NULL,
    FOREIGN KEY(from_entity_id) REFERENCES entities(entity_id),
    FOREIGN KEY(to_entity_id) REFERENCES entities(entity_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_relation ON relationships(relation);

CREATE TABLE IF NOT EXISTS memories (
    memory_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    relevance REAL NOT NULL,
    confidence REAL NOT NULL,
    first_seen_ms INTEGER NOT NULL,
    last_confirmed_ms INTEGER NOT NULL,
    retrieval_count INTEGER NOT NULL DEFAULT 0,
    successful_use_count INTEGER NOT NULL DEFAULT 0,
    correction_count INTEGER NOT NULL DEFAULT 0,
    contradiction_count INTEGER NOT NULL DEFAULT 0,
    provenance_json TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    memory_id UNINDEXED,
    text,
    tokenize = 'unicode61 remove_diacritics 2'
);

PRAGMA user_version = 1;
