#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelKind {
    LocalLlm,
    CloudLlm,
    Embedding,
    Reranker,
    Vision,
    Speech,
}

#[derive(Debug, Clone)]
pub struct ModelDescriptor {
    pub id: String,
    pub kind: ModelKind,
    pub capabilities: Vec<String>,
    pub local: bool,
    pub cost_score: f32,
    pub latency_score: f32,
    pub quality_score: f32,
    pub privacy_score: f32,
    pub context_tokens: u32,
}

#[derive(Debug, Default)]
pub struct ModelRegistry {
    models: Vec<ModelDescriptor>,
}

impl ModelRegistry {
    pub fn register(&mut self, model: ModelDescriptor) {
        if let Some(existing) = self.models.iter_mut().find(|item| item.id == model.id) {
            *existing = model;
        } else {
            self.models.push(model);
        }
    }

    pub fn all(&self) -> &[ModelDescriptor] {
        &self.models
    }

    pub fn select(&self, capability: &str, local_only: bool) -> Option<&ModelDescriptor> {
        self.models
            .iter()
            .filter(|model| !local_only || model.local)
            .filter(|model| model.capabilities.iter().any(|item| item == capability))
            .max_by(|a, b| utility(a).total_cmp(&utility(b)))
    }
}

fn utility(model: &ModelDescriptor) -> f32 {
    model.quality_score.clamp(0.0, 1.0) * 0.45
        + model.privacy_score.clamp(0.0, 1.0) * 0.25
        + (1.0 - model.latency_score.clamp(0.0, 1.0)) * 0.20
        + (1.0 - model.cost_score.clamp(0.0, 1.0)) * 0.10
}

#[cfg(test)]
mod tests {
    use super::{ModelDescriptor, ModelKind, ModelRegistry};

    #[test]
    fn local_only_selection_never_returns_cloud_model() {
        let mut registry = ModelRegistry::default();
        registry.register(ModelDescriptor {
            id: "cloud".into(),
            kind: ModelKind::CloudLlm,
            capabilities: vec!["reasoning".into()],
            local: false,
            cost_score: 0.1,
            latency_score: 0.1,
            quality_score: 1.0,
            privacy_score: 0.3,
            context_tokens: 128_000,
        });
        registry.register(ModelDescriptor {
            id: "local".into(),
            kind: ModelKind::LocalLlm,
            capabilities: vec!["reasoning".into()],
            local: true,
            cost_score: 0.0,
            latency_score: 0.4,
            quality_score: 0.7,
            privacy_score: 1.0,
            context_tokens: 32_000,
        });

        assert_eq!(registry.select("reasoning", true).unwrap().id, "local");
    }
}
