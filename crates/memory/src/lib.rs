use os_contracts::{MemoryKind, MemoryRecord, Sensitivity};

#[derive(Debug, Default)]
pub struct MemoryStore {
    records: Vec<MemoryRecord>,
}

impl MemoryStore {
    pub fn upsert(&mut self, record: MemoryRecord) {
        if let Some(existing) = self.records.iter_mut().find(|item| item.id == record.id) {
            *existing = record;
        } else {
            self.records.push(record);
        }
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    pub fn all(&self) -> &[MemoryRecord] {
        &self.records
    }
}

#[derive(Debug, Clone)]
pub struct MemoryCompileInput {
    pub id: String,
    pub text: String,
    pub sensitivity: Sensitivity,
    pub observed_at_ms: i64,
    pub provenance: Vec<String>,
}

#[derive(Debug, Default)]
pub struct MemoryCompiler;

impl MemoryCompiler {
    pub fn compile(&self, input: MemoryCompileInput) -> MemoryRecord {
        let kind = classify_kind(&input.text, input.sensitivity);
        let relevance = initial_relevance(&input.text, &kind, input.sensitivity);
        MemoryRecord {
            id: input.id,
            kind,
            text: input.text,
            relevance,
            confidence: 1.0,
            first_seen_ms: input.observed_at_ms,
            last_confirmed_ms: input.observed_at_ms,
            provenance: input.provenance,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct MemorySignals {
    pub relevance: f32,
    pub confidence: f32,
    pub retrieval_count: u32,
    pub successful_use_count: u32,
    pub correction_count: u32,
    pub relationship_strength: f32,
    pub age_days: f32,
}

pub fn adaptive_memory_score(signals: MemorySignals) -> f32 {
    let usage = (signals.retrieval_count as f32 / 20.0).clamp(0.0, 1.0);
    let success = if signals.retrieval_count == 0 {
        0.5
    } else {
        (signals.successful_use_count as f32 / signals.retrieval_count as f32).clamp(0.0, 1.0)
    };
    let correction_penalty = (signals.correction_count as f32 / 8.0).clamp(0.0, 0.6);
    let recency = 1.0 / (1.0 + (signals.age_days.max(0.0) / 30.0));

    (signals.relevance.clamp(0.0, 1.0) * 0.25
        + signals.confidence.clamp(0.0, 1.0) * 0.20
        + usage * 0.15
        + success * 0.15
        + recency * 0.15
        + signals.relationship_strength.clamp(0.0, 1.0) * 0.10
        - correction_penalty)
        .clamp(0.0, 1.0)
}

fn classify_kind(text: &str, sensitivity: Sensitivity) -> MemoryKind {
    if sensitivity == Sensitivity::SecretReference {
        return MemoryKind::Episodic;
    }

    let lower = text.to_ascii_lowercase();
    if contains_any(
        &lower,
        &[
            "always remember",
            "remember permanently",
            "dauerhaft merken",
            "immer merken",
            "grundregel",
            "stable memory",
        ],
    ) {
        MemoryKind::Stable
    } else if contains_any(
        &lower,
        &[
            "i prefer",
            "my preference",
            "ich bevorzuge",
            "ich möchte immer",
            "darstellung soll",
        ],
    ) {
        MemoryKind::Preference
    } else if contains_any(
        &lower,
        &[
            "workflow",
            "procedure",
            "steps:",
            "schritte:",
            "ablauf",
            "immer wenn",
        ],
    ) {
        MemoryKind::Procedural
    } else {
        MemoryKind::Episodic
    }
}

fn initial_relevance(text: &str, kind: &MemoryKind, sensitivity: Sensitivity) -> f32 {
    if sensitivity == Sensitivity::SecretReference {
        return 0.35;
    }

    let length_signal = (text.chars().count() as f32 / 320.0).clamp(0.0, 0.18);
    let type_bonus = match kind {
        MemoryKind::Stable => 0.20,
        MemoryKind::Preference => 0.15,
        MemoryKind::Procedural => 0.16,
        MemoryKind::Project => 0.14,
        _ => 0.0,
    };
    (0.58 + length_signal + type_bonus).clamp(0.0, 0.95)
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

#[cfg(test)]
mod tests {
    use os_contracts::{MemoryKind, Sensitivity};

    use super::{MemoryCompileInput, MemoryCompiler, MemorySignals, adaptive_memory_score};

    #[test]
    fn compiler_promotes_explicit_long_term_rules() {
        let compiler = MemoryCompiler;
        let memory = compiler.compile(MemoryCompileInput {
            id: "m1".into(),
            text: "Grundregel: immer merken, dass Provenance erhalten bleiben muss".into(),
            sensitivity: Sensitivity::Normal,
            observed_at_ms: 1,
            provenance: vec!["event-1".into()],
        });
        assert!(matches!(memory.kind, MemoryKind::Stable));
        assert!(memory.relevance > 0.7);
    }

    #[test]
    fn repeated_success_strengthens_adaptive_score() {
        let unused = adaptive_memory_score(MemorySignals {
            relevance: 0.7,
            confidence: 0.9,
            retrieval_count: 0,
            successful_use_count: 0,
            correction_count: 0,
            relationship_strength: 0.3,
            age_days: 5.0,
        });
        let useful = adaptive_memory_score(MemorySignals {
            relevance: 0.7,
            confidence: 0.9,
            retrieval_count: 18,
            successful_use_count: 17,
            correction_count: 0,
            relationship_strength: 0.8,
            age_days: 5.0,
        });
        assert!(useful > unused);
    }
}
