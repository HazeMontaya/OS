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
    pub fn start(
        trace_id: impl Into<String>,
        kind: SignalKind,
        component: impl Into<String>,
    ) -> Self {
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

    pub fn completed(
        trace_id: impl Into<String>,
        kind: SignalKind,
        component: impl Into<String>,
        started_at_ms: i64,
        completed_at_ms: i64,
        success: bool,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            trace_id: trace_id.into(),
            parent_id: None,
            kind,
            component: component.into(),
            started_at_ms,
            completed_at_ms: Some(completed_at_ms.max(started_at_ms)),
            success: Some(success),
        }
    }

    pub fn complete(&mut self, success: bool) {
        self.completed_at_ms = Some(now_ms());
        self.success = Some(success);
    }

    pub fn duration_ms(&self) -> Option<i64> {
        self.completed_at_ms
            .map(|completed| completed.saturating_sub(self.started_at_ms))
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

    pub fn is_empty(&self) -> bool {
        self.signals.is_empty()
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
    use super::{SignalKind, TraceSignal};

    #[test]
    fn completed_signal_preserves_external_timing() {
        let signal = TraceSignal::completed(
            "trace-1",
            SignalKind::ModelInference,
            "model:test",
            100,
            145,
            true,
        );
        assert_eq!(signal.duration_ms(), Some(45));
        assert_eq!(signal.success, Some(true));
    }
}
