use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignalKind {
    Input,
    MemoryRecall,
    GraphTraversal,
    ModelInference,
    ToolInvocation,
    Output,
    Learning,
}

#[derive(Debug, Clone)]
pub struct TraceSignal {
    pub id: String,
    pub trace_id: String,
    pub parent_id: Option<String>,
    pub kind: SignalKind,
    pub component: String,
    pub started_at_ms: i64,
    pub completed_at_ms: Option<i64>,
    pub success: Option<bool>,
}

impl TraceSignal {
    pub fn start(trace_id: impl Into<String>, kind: SignalKind, component: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            trace_id: trace_id.into(),
            parent_id: None,
            kind,
            component: component.into(),
            started_at_ms: now_ms(),
            completed_at_ms: None,
            success: None,
        }
    }

    pub fn complete(&mut self, success: bool) {
        self.completed_at_ms = Some(now_ms());
        self.success = Some(success);
    }
}

#[derive(Debug, Default)]
pub struct TelemetryBuffer {
    signals: Vec<TraceSignal>,
}

impl TelemetryBuffer {
    pub fn record(&mut self, signal: TraceSignal) {
        self.signals.push(signal);
    }

    pub fn recent(&self, limit: usize) -> &[TraceSignal] {
        let start = self.signals.len().saturating_sub(limit);
        &self.signals[start..]
    }

    pub fn len(&self) -> usize {
        self.signals.len()
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
