use os_storage::{Result as StorageResult, Storage};

#[derive(Debug, Clone, Copy)]
pub struct FusionWeights {
    pub lexical: f32,
    pub semantic: f32,
    pub graph: f32,
    pub temporal: f32,
    pub procedural: f32,
}

impl Default for FusionWeights {
    fn default() -> Self {
        Self {
            lexical: 0.30,
            semantic: 0.30,
            graph: 0.20,
            temporal: 0.15,
            procedural: 0.05,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RetrievalSignal {
    pub id: String,
    pub lexical: f32,
    pub semantic: f32,
    pub graph: f32,
    pub temporal: f32,
    pub procedural: f32,
}

impl RetrievalSignal {
    pub fn fused_score(&self, weights: FusionWeights) -> f32 {
        self.lexical.clamp(0.0, 1.0) * weights.lexical
            + self.semantic.clamp(0.0, 1.0) * weights.semantic
            + self.graph.clamp(0.0, 1.0) * weights.graph
            + self.temporal.clamp(0.0, 1.0) * weights.temporal
            + self.procedural.clamp(0.0, 1.0) * weights.procedural
    }
}

#[derive(Debug, Clone)]
pub struct RecallHit {
    pub id: String,
    pub score: f32,
    pub source: &'static str,
}

#[derive(Debug, Default)]
pub struct RetrievalEngine {
    weights: FusionWeights,
}

impl RetrievalEngine {
    pub fn new(weights: FusionWeights) -> Self {
        Self { weights }
    }

    pub fn lexical_event_recall(
        &self,
        storage: &Storage,
        query: &str,
        limit: usize,
    ) -> StorageResult<Vec<RecallHit>> {
        let ids = storage.search_event_ids(query, limit)?;
        let total = ids.len().max(1) as f32;
        Ok(ids
            .into_iter()
            .enumerate()
            .map(|(index, id)| RecallHit {
                id,
                score: 1.0 - (index as f32 / total) * 0.25,
                source: "fts5:event",
            })
            .collect())
    }

    pub fn rank(&self, mut signals: Vec<RetrievalSignal>) -> Vec<RecallHit> {
        signals.sort_by(|a, b| {
            b.fused_score(self.weights)
                .total_cmp(&a.fused_score(self.weights))
        });
        signals
            .into_iter()
            .map(|signal| RecallHit {
                score: signal.fused_score(self.weights),
                id: signal.id,
                source: "hybrid:fusion",
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::{FusionWeights, RetrievalEngine, RetrievalSignal};

    #[test]
    fn fusion_prefers_stronger_combined_evidence() {
        let engine = RetrievalEngine::new(FusionWeights::default());
        let ranked = engine.rank(vec![
            RetrievalSignal { id: "weak".into(), lexical: 0.2, semantic: 0.2, graph: 0.2, temporal: 0.2, procedural: 0.0 },
            RetrievalSignal { id: "strong".into(), lexical: 0.9, semantic: 0.8, graph: 0.7, temporal: 0.8, procedural: 0.2 },
        ]);
        assert_eq!(ranked[0].id, "strong");
    }
}
