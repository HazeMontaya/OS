use std::time::Duration;

use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: content.into(),
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: content.into(),
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: content.into(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LlamaCppConfig {
    pub server_root: String,
    pub model: String,
    pub api_key: Option<String>,
    pub timeout: Duration,
}

impl LlamaCppConfig {
    pub fn local(model: impl Into<String>) -> Self {
        Self {
            server_root: "http://127.0.0.1:8080".into(),
            model: model.into(),
            api_key: None,
            timeout: Duration::from_secs(120),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ModelCompletion {
    pub text: String,
    pub model: String,
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
}

#[derive(Debug, Error)]
pub enum ModelGatewayError {
    #[error("failed to build HTTP client: {0}")]
    Client(#[source] reqwest::Error),
    #[error("model transport failed: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("model server returned no models")]
    NoModels,
    #[error("model server returned no assistant text")]
    EmptyResponse,
}

#[derive(Clone)]
pub struct LlamaCppClient {
    client: Client,
    config: LlamaCppConfig,
}

impl LlamaCppClient {
    pub fn new(config: LlamaCppConfig) -> Result<Self, ModelGatewayError> {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .map_err(ModelGatewayError::Client)?;
        Ok(Self { client, config })
    }

    pub fn local(model: impl Into<String>) -> Result<Self, ModelGatewayError> {
        Self::new(LlamaCppConfig::local(model))
    }

    pub fn configured_model(&self) -> &str {
        &self.config.model
    }

    pub async fn models(&self) -> Result<Vec<String>, ModelGatewayError> {
        let response = self
            .authorize(self.client.get(self.endpoint("/v1/models")))
            .send()
            .await?
            .error_for_status()?
            .json::<ModelsResponse>()
            .await?;
        Ok(response.data.into_iter().map(|model| model.id).collect())
    }

    pub async fn chat(
        &self,
        messages: &[ChatMessage],
        max_tokens: u32,
        temperature: f32,
    ) -> Result<ModelCompletion, ModelGatewayError> {
        let model = if self.config.model.trim().is_empty() {
            self.models()
                .await?
                .into_iter()
                .next()
                .ok_or(ModelGatewayError::NoModels)?
        } else {
            self.config.model.clone()
        };

        self.chat_with_model(&model, messages, max_tokens, temperature)
            .await
    }

    pub async fn chat_with_model(
        &self,
        model: &str,
        messages: &[ChatMessage],
        max_tokens: u32,
        temperature: f32,
    ) -> Result<ModelCompletion, ModelGatewayError> {
        let body = ChatCompletionRequest {
            model,
            messages,
            max_tokens,
            temperature: temperature.clamp(0.0, 2.0),
            stream: false,
        };
        let response = self
            .authorize(self.client.post(self.endpoint("/v1/chat/completions")))
            .json(&body)
            .send()
            .await?
            .error_for_status()?
            .json::<ChatCompletionResponse>()
            .await?;

        let text = response
            .choices
            .first()
            .and_then(|choice| extract_text(&choice.message.content))
            .filter(|text| !text.trim().is_empty())
            .ok_or(ModelGatewayError::EmptyResponse)?;

        Ok(ModelCompletion {
            text,
            model: response.model.unwrap_or_else(|| model.to_string()),
            prompt_tokens: response.usage.as_ref().and_then(|usage| usage.prompt_tokens),
            completion_tokens: response
                .usage
                .as_ref()
                .and_then(|usage| usage.completion_tokens),
        })
    }

    fn authorize(&self, request: RequestBuilder) -> RequestBuilder {
        match self.config.api_key.as_deref() {
            Some(api_key) if !api_key.is_empty() => request.bearer_auth(api_key),
            _ => request,
        }
    }

    fn endpoint(&self, path: &str) -> String {
        format!(
            "{}{}",
            self.config.server_root.trim_end_matches('/'),
            path
        )
    }
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    max_tokens: u32,
    temperature: f32,
    stream: bool,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    model: Option<String>,
    choices: Vec<ChatChoice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: Value,
}

#[derive(Deserialize)]
struct Usage {
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
}

#[derive(Deserialize)]
struct ModelsResponse {
    data: Vec<ModelObject>,
}

#[derive(Deserialize)]
struct ModelObject {
    id: String,
}

fn extract_text(content: &Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    let parts = content.as_array()?;
    let text = parts
        .iter()
        .filter_map(|part| {
            part.get("text")
                .and_then(Value::as_str)
                .or_else(|| part.get("content").and_then(Value::as_str))
        })
        .collect::<Vec<_>>()
        .join("");
    (!text.is_empty()).then_some(text)
}

#[cfg(test)]
mod tests {
    use super::{extract_text, LlamaCppClient, ModelDescriptor, ModelKind, ModelRegistry};
    use serde_json::json;

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

    #[test]
    fn local_client_targets_llama_server_v1() {
        let client = LlamaCppClient::local("").expect("create local client");
        assert_eq!(client.endpoint("/v1/models"), "http://127.0.0.1:8080/v1/models");
        assert_eq!(client.configured_model(), "");
    }

    #[test]
    fn extracts_text_from_multimodal_style_content() {
        let content = json!([
            {"type": "text", "text": "hello "},
            {"type": "text", "text": "world"}
        ]);
        assert_eq!(extract_text(&content).as_deref(), Some("hello world"));
    }
}
