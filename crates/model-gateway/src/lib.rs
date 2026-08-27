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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCompletion {
    pub text: String,
    pub model: String,
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EmbeddingVector {
    pub index: usize,
    pub values: Vec<f32>,
}

#[derive(Debug, Clone)]
pub struct EmbeddingResult {
    pub model: String,
    pub vectors: Vec<EmbeddingVector>,
    pub prompt_tokens: Option<u64>,
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
    #[error("embedding server returned no vector")]
    EmptyEmbedding,
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
        let model = self.resolve_model().await?;
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
            prompt_tokens: response
                .usage
                .as_ref()
                .and_then(|usage| usage.prompt_tokens),
            completion_tokens: response
                .usage
                .as_ref()
                .and_then(|usage| usage.completion_tokens),
        })
    }

    pub async fn embed(&self, input: &str) -> Result<EmbeddingVector, ModelGatewayError> {
        let result = self.embed_many(&[input]).await?;
        result
            .vectors
            .into_iter()
            .next()
            .ok_or(ModelGatewayError::EmptyEmbedding)
    }

    pub async fn embed_many(&self, inputs: &[&str]) -> Result<EmbeddingResult, ModelGatewayError> {
        if inputs.is_empty() {
            return Err(ModelGatewayError::EmptyEmbedding);
        }
        let model = self.resolve_model().await?;
        let body = EmbeddingRequest {
            input: inputs,
            model: &model,
            encoding_format: "float",
        };
        let mut response = self
            .authorize(self.client.post(self.endpoint("/v1/embeddings")))
            .json(&body)
            .send()
            .await?
            .error_for_status()?
            .json::<EmbeddingResponse>()
            .await?;
        response.data.sort_by_key(|item| item.index);
        let vectors = response
            .data
            .into_iter()
            .map(|item| EmbeddingVector {
                index: item.index,
                values: item.embedding,
            })
            .collect::<Vec<_>>();
        if vectors.is_empty() || vectors.iter().any(|vector| vector.values.is_empty()) {
            return Err(ModelGatewayError::EmptyEmbedding);
        }

        Ok(EmbeddingResult {
            model: response.model.unwrap_or(model),
            vectors,
            prompt_tokens: response.usage.and_then(|usage| usage.prompt_tokens),
        })
    }

    async fn resolve_model(&self) -> Result<String, ModelGatewayError> {
        if self.config.model.trim().is_empty() {
            self.models()
                .await?
                .into_iter()
                .next()
                .ok_or(ModelGatewayError::NoModels)
        } else {
            Ok(self.config.model.clone())
        }
    }

    fn authorize(&self, request: RequestBuilder) -> RequestBuilder {
        match self.config.api_key.as_deref() {
            Some(api_key) if !api_key.is_empty() => request.bearer_auth(api_key),
            _ => request,
        }
    }

    fn endpoint(&self, path: &str) -> String {
        format!("{}{}", self.config.server_root.trim_end_matches('/'), path)
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

#[derive(Serialize)]
struct EmbeddingRequest<'a> {
    input: &'a [&'a str],
    model: &'a str,
    encoding_format: &'static str,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    model: Option<String>,
    choices: Vec<ChatChoice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    model: Option<String>,
    data: Vec<EmbeddingData>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct EmbeddingData {
    index: usize,
    embedding: Vec<f32>,
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CloudProvider {
    OpenAI,
    Anthropic,
    OpenRouter,
    Ollama,
    Custom(String),
}

impl std::fmt::Display for CloudProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OpenAI => write!(f, "OpenAI"),
            Self::Anthropic => write!(f, "Anthropic"),
            Self::OpenRouter => write!(f, "OpenRouter"),
            Self::Ollama => write!(f, "Ollama"),
            Self::Custom(name) => write!(f, "{}", name),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeys {
    pub openai: String,
    pub anthropic: String,
    pub openrouter: String,
    pub ollama: String,
}

impl Default for ApiKeys {
    fn default() -> Self {
        Self::from_env()
    }
}

impl ApiKeys {
    pub fn from_env() -> Self {
        Self {
            openai: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            anthropic: std::env::var("ANTHROPIC_API_KEY").unwrap_or_default(),
            openrouter: std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            ollama: std::env::var("OLLAMA_API_KEY").unwrap_or_default(),
        }
    }

    pub fn load_from_file(path: &str) -> Self {
        let mut keys = Self::from_env();
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    match key {
                        "OPENAI_API_KEY" if !value.is_empty() => keys.openai = value.to_string(),
                        "ANTHROPIC_API_KEY" if !value.is_empty() => {
                            keys.anthropic = value.to_string()
                        }
                        "OPENROUTER_API_KEY" if !value.is_empty() => {
                            keys.openrouter = value.to_string()
                        }
                        "OLLAMA_API_KEY" if !value.is_empty() => keys.ollama = value.to_string(),
                        _ => {}
                    }
                }
            }
        }
        keys
    }

    pub fn key_for(&self, provider: &CloudProvider) -> &str {
        match provider {
            CloudProvider::OpenAI => &self.openai,
            CloudProvider::Anthropic => &self.anthropic,
            CloudProvider::OpenRouter => &self.openrouter,
            CloudProvider::Ollama => &self.ollama,
            CloudProvider::Custom(_) => "",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub provider: String,
    pub available: bool,
    pub api_key_set: bool,
    pub endpoint: String,
}

#[derive(Debug, Clone)]
pub struct CloudConfig {
    pub provider: CloudProvider,
    pub model: String,
    pub api_key: String,
    pub base_url: String,
}

impl CloudConfig {
    pub fn openai(model: &str, api_key: &str) -> Self {
        Self {
            provider: CloudProvider::OpenAI,
            model: model.to_string(),
            api_key: api_key.to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
        }
    }

    pub fn anthropic(model: &str, api_key: &str) -> Self {
        Self {
            provider: CloudProvider::Anthropic,
            model: model.to_string(),
            api_key: api_key.to_string(),
            base_url: "https://api.anthropic.com/v1".to_string(),
        }
    }

    pub fn openrouter(model: &str, api_key: &str) -> Self {
        Self {
            provider: CloudProvider::OpenRouter,
            model: model.to_string(),
            api_key: api_key.to_string(),
            base_url: "https://openrouter.ai/api/v1".to_string(),
        }
    }

    pub fn ollama(model: &str) -> Self {
        Self {
            provider: CloudProvider::Ollama,
            model: model.to_string(),
            api_key: String::new(),
            base_url: "http://127.0.0.1:11434/v1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicUsage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicResponse {
    pub content: Vec<AnthropicContent>,
    pub model: Option<String>,
    pub usage: Option<AnthropicUsage>,
}

#[derive(Clone)]
pub struct CloudClient {
    client: Client,
    config: CloudConfig,
}

impl CloudClient {
    pub fn new(config: CloudConfig) -> Result<Self, ModelGatewayError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(ModelGatewayError::Client)?;
        Ok(Self { client, config })
    }

    pub fn provider(&self) -> &CloudProvider {
        &self.config.provider
    }

    pub async fn chat(
        &self,
        messages: &[ChatMessage],
        max_tokens: u32,
        temperature: f32,
    ) -> Result<ModelCompletion, ModelGatewayError> {
        match self.config.provider {
            CloudProvider::Anthropic => {
                self.chat_anthropic(messages, max_tokens, temperature).await
            }
            _ => {
                self.chat_openai_compatible(messages, max_tokens, temperature)
                    .await
            }
        }
    }

    async fn chat_openai_compatible(
        &self,
        messages: &[ChatMessage],
        max_tokens: u32,
        temperature: f32,
    ) -> Result<ModelCompletion, ModelGatewayError> {
        let body = ChatCompletionRequest {
            model: &self.config.model,
            messages,
            max_tokens,
            temperature: temperature.clamp(0.0, 2.0),
            stream: false,
        };
        let mut request = self
            .client
            .post(format!("{}/chat/completions", self.config.base_url))
            .json(&body);
        if !self.config.api_key.is_empty() {
            request = request.bearer_auth(&self.config.api_key);
        }
        let response = request
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
            model: response.model.unwrap_or_else(|| self.config.model.clone()),
            prompt_tokens: response.usage.as_ref().and_then(|u| u.prompt_tokens),
            completion_tokens: response.usage.as_ref().and_then(|u| u.completion_tokens),
        })
    }

    async fn chat_anthropic(
        &self,
        messages: &[ChatMessage],
        max_tokens: u32,
        temperature: f32,
    ) -> Result<ModelCompletion, ModelGatewayError> {
        let (system, user_messages): (Vec<_>, Vec<_>) =
            messages.iter().partition(|m| m.role == "system");
        let system_text = system
            .iter()
            .map(|m| m.content.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        let anthropic_messages: Vec<serde_json::Value> = user_messages
            .iter()
            .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
            .collect();
        let mut body = serde_json::json!({
            "model": self.config.model,
            "max_tokens": max_tokens,
            "temperature": temperature.clamp(0.0, 2.0),
            "messages": anthropic_messages,
        });
        if !system_text.is_empty() {
            body["system"] = serde_json::json!(system_text);
        }
        let mut request = self
            .client
            .post(format!("{}/messages", self.config.base_url))
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body);
        if !self.config.api_key.is_empty() {
            request = request.header("x-api-key", &self.config.api_key);
        }
        let response = request
            .send()
            .await?
            .error_for_status()?
            .json::<AnthropicResponse>()
            .await?;
        let text = response
            .content
            .iter()
            .filter_map(|c| c.text.as_deref())
            .collect::<Vec<_>>()
            .join("");
        if text.trim().is_empty() {
            return Err(ModelGatewayError::EmptyResponse);
        }
        Ok(ModelCompletion {
            text,
            model: response.model.unwrap_or_else(|| self.config.model.clone()),
            prompt_tokens: response.usage.as_ref().and_then(|u| u.input_tokens),
            completion_tokens: response.usage.as_ref().and_then(|u| u.output_tokens),
        })
    }

    pub async fn check_health(&self) -> ProviderStatus {
        let available = match self.config.provider {
            CloudProvider::Ollama => self
                .client
                .get("http://127.0.0.1:11434/api/tags")
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false),
            CloudProvider::Anthropic => {
                let mut request = self.client.get("https://api.anthropic.com/v1/messages");
                if !self.config.api_key.is_empty() {
                    request = request.header("x-api-key", &self.config.api_key);
                }
                request
                    .header("anthropic-version", "2023-06-01")
                    .send()
                    .await
                    .map(|r| r.status().is_success() || r.status().as_u16() == 400)
                    .unwrap_or(false)
            }
            _ => {
                let url = format!("{}/models", self.config.base_url);
                let mut request = self.client.get(&url);
                if !self.config.api_key.is_empty() {
                    request = request.bearer_auth(&self.config.api_key);
                }
                request
                    .send()
                    .await
                    .map(|r| r.status().is_success() || r.status().as_u16() == 401)
                    .unwrap_or(false)
            }
        };
        ProviderStatus {
            provider: self.config.provider.to_string(),
            available,
            api_key_set: !self.config.api_key.is_empty(),
            endpoint: self.config.base_url.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ApiKeys, CloudProvider, EmbeddingData, EmbeddingResponse, LlamaCppClient, ModelDescriptor,
        ModelKind, ModelRegistry, extract_text,
    };
    use serde_json::json;

    #[test]
    fn api_keys_from_env() {
        std::env::set_var("OPENAI_API_KEY", "test-key");
        let keys = ApiKeys::from_env();
        assert_eq!(keys.key_for(&CloudProvider::OpenAI), "test-key");
        assert_eq!(keys.key_for(&CloudProvider::Anthropic), "");
        std::env::remove_var("OPENAI_API_KEY");
    }

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
        assert_eq!(
            client.endpoint("/v1/models"),
            "http://127.0.0.1:8080/v1/models"
        );
        assert_eq!(
            client.endpoint("/v1/embeddings"),
            "http://127.0.0.1:8080/v1/embeddings"
        );
        assert_eq!(client.configured_model(), "");
    }

    #[test]
    fn embedding_payload_supports_dense_float_vectors() {
        let response = EmbeddingResponse {
            model: Some("embed-test".into()),
            data: vec![EmbeddingData {
                index: 0,
                embedding: vec![0.1, 0.2, 0.3],
            }],
            usage: None,
        };
        assert_eq!(response.data[0].embedding.len(), 3);
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
