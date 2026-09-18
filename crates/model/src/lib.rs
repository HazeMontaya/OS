use std::collections::BTreeMap;

#[derive(Clone,Debug)]
pub struct ModelRequest{pub system:String,pub prompt:String,pub max_tokens:usize,pub temperature:f32}
#[derive(Clone,Debug)]
pub struct ModelResponse{pub text:String,pub model:String,pub usage_tokens:usize}
#[derive(Clone,Debug)]
pub enum ModelError{Unavailable(String),InvalidResponse(String)}

pub trait ModelProvider:Send+Sync{
 fn complete(&self,request:&ModelRequest)->Result<ModelResponse,ModelError>;
}

#[derive(Clone,Debug)]
pub struct EnvModelConfig{
 pub provider:String,
 pub model:String,
 pub endpoint:Option<String>,
 pub api_key_env:Option<String>,
 pub metadata:BTreeMap<String,String>,
}
impl EnvModelConfig{
 pub fn from_env()->Self{
  let provider=std::env::var("OS_MODEL_PROVIDER").unwrap_or_else(|_|"none".into());
  let model=std::env::var("OS_MODEL").unwrap_or_else(|_|"default".into());
  let endpoint=std::env::var("OS_MODEL_ENDPOINT").ok();
  let api_key_env=std::env::var("OS_MODEL_API_KEY_ENV").ok();
  Self{provider,model,endpoint,api_key_env,metadata:BTreeMap::new()}
 }
}
#[derive(Clone,Debug,Default)]
pub struct NullModelProvider;
impl ModelProvider for NullModelProvider{
 fn complete(&self,_:&ModelRequest)->Result<ModelResponse,ModelError>{Err(ModelError::Unavailable("no model provider configured".into()))}
}
#[cfg(test)]
mod tests{use super::*;#[test]fn env_config_has_safe_defaults(){let c=EnvModelConfig::from_env();assert!(!c.provider.is_empty());assert!(c.api_key_env.is_none()||c.api_key_env.as_ref().unwrap().len()>0)}}


#[derive(Clone, Debug)]
pub struct OpenAiResponsesProvider {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
}

impl OpenAiResponsesProvider {
    pub fn from_env(config: &EnvModelConfig) -> Result<Self, ModelError> {
        let endpoint = config.endpoint.clone().unwrap_or_else(|| "https://api.openai.com/v1/responses".into());
        let env_name = config.api_key_env.clone().unwrap_or_else(|| "OPENAI_API_KEY".into());
        let api_key = std::env::var(&env_name).map_err(|_| ModelError::Unavailable(format!("missing API key environment variable: {env_name}")))?;
        Ok(Self { endpoint, api_key, model: config.model.clone() })
    }
}

impl ModelProvider for OpenAiResponsesProvider {
    fn complete(&self, request: &ModelRequest) -> Result<ModelResponse, ModelError> {
        let body = serde_json::json!({
            "model": self.model,
            "instructions": request.system,
            "input": request.prompt,
            "max_output_tokens": request.max_tokens
        });
        let response = reqwest::blocking::Client::new()
            .post(&self.endpoint)
            .bearer_auth_if_present(&self.api_key)
            .json(&body)
            .send()
            .map_err(|e| ModelError::Unavailable(e.to_string()))?;
        let status = response.status();
        let value: serde_json::Value = response.json().map_err(|e| ModelError::InvalidResponse(e.to_string()))?;
        if !status.is_success() {
            return Err(ModelError::InvalidResponse(value.to_string()));
        }
        let text = value.get("output_text").and_then(|v| v.as_str())
            .or_else(|| value.pointer("/output/0/content/0/text").and_then(|v| v.as_str()))
            .ok_or_else(|| ModelError::InvalidResponse("response contained no output text".into()))?;
        let usage_tokens = value.pointer("/usage/output_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
        Ok(ModelResponse { text: text.into(), model: self.model.clone(), usage_tokens })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModelCandidate {
    pub provider: String,
    pub model: String,
    pub healthy: bool,
    pub remaining_quota_tokens: usize,
    pub estimated_cost_micros: u64,
    pub latency_ms: u32,
    pub capabilities: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutingDecision {
    pub provider: String,
    pub model: String,
    pub reason: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutingPlan {
    pub primary: RoutingDecision,
    pub fallbacks: Vec<RoutingDecision>,
}

#[derive(Clone, Debug, Default)]
pub struct ModelRouter {
    candidates: Vec<ModelCandidate>,
}

impl ModelRouter {
    pub fn register(&mut self, candidate: ModelCandidate) {
        self.candidates.retain(|c| !(c.provider == candidate.provider && c.model == candidate.model));
        self.candidates.push(candidate);
    }

    pub fn candidates(&self) -> &[ModelCandidate] {
        &self.candidates
    }
    pub fn mark_unhealthy(&mut self, provider: &str, model: &str) {
        if let Some(candidate)=self.candidates.iter_mut().find(|c| c.provider==provider && c.model==model) {
            candidate.healthy=false;
        }
    }

    pub fn mark_healthy(&mut self, provider: &str, model: &str) {
        if let Some(candidate)=self.candidates.iter_mut().find(|c| c.provider==provider && c.model==model) {
            candidate.healthy=true;
        }
    }

    pub fn health(&self, provider: &str, model: &str) -> Option<bool> {
        self.candidates.iter().find(|c| c.provider==provider && c.model==model).map(|c| c.healthy)
    }


    pub fn route(&self, min_quota_tokens: usize, max_latency_ms: Option<u32>) -> Result<RoutingDecision, ModelError> {
        let mut available: Vec<&ModelCandidate> = self.candidates.iter()
            .filter(|c| c.healthy && c.remaining_quota_tokens >= min_quota_tokens)
            .filter(|c| max_latency_ms.map(|limit| c.latency_ms <= limit).unwrap_or(true))
            .collect();
        available.sort_by_key(|c| (c.estimated_cost_micros, c.latency_ms, &c.provider, &c.model));
        let c = available.first().ok_or_else(|| ModelError::Unavailable("no healthy model satisfies routing constraints".into()))?;
        Ok(RoutingDecision {
            provider: c.provider.clone(),
            model: c.model.clone(),
            reason: format!("lowest estimated cost under quota/latency constraints"),
        })
    }
}

#[cfg(test)]
mod router_tests {
    use super::*;

    #[test]
    fn router_prefers_lower_cost() {
        let mut r = ModelRouter::default();
        r.register(ModelCandidate { provider: "a".into(), model: "slow".into(), healthy: true, remaining_quota_tokens: 1000, estimated_cost_micros: 20, latency_ms: 100, capabilities: vec![] });
        r.register(ModelCandidate { provider: "b".into(), model: "cheap".into(), healthy: true, remaining_quota_tokens: 1000, estimated_cost_micros: 10, latency_ms: 100, capabilities: vec![] });
        assert_eq!(r.route(10, None).unwrap().provider, "b");
    }

    #[test]
    fn router_filters_unhealthy() {
        let mut r = ModelRouter::default();
        r.register(ModelCandidate { provider: "a".into(), model: "x".into(), healthy: false, remaining_quota_tokens: 1000, estimated_cost_micros: 1, latency_ms: 1, capabilities: vec![] });
        assert!(r.route(1, None).is_err());
    }
}


#[derive(Clone, Debug)]
pub struct OpenAiCompatibleProvider {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
}

impl OpenAiCompatibleProvider {
    pub fn from_env(config: &EnvModelConfig) -> Result<Self, ModelError> {
        let endpoint = config.endpoint.clone().unwrap_or_else(|| {
            if config.provider.eq_ignore_ascii_case("omniroute") {
                "http://127.0.0.1:20128/v1/chat/completions".into()
            } else {
                "https://api.openai.com/v1/chat/completions".into()
            }
        });
        let env_name = config.api_key_env.clone().unwrap_or_else(|| {
            if config.provider.eq_ignore_ascii_case("omniroute") {
                "OMNIROUTE_API_KEY".into()
            } else {
                "OPENAI_API_KEY".into()
            }
        });
        let api_key = std::env::var(&env_name).unwrap_or_default();
        let local_endpoint = endpoint.starts_with("http://127.0.0.1")
            || endpoint.starts_with("http://localhost")
            || endpoint.starts_with("http://[::1]");
        if api_key.is_empty() && !local_endpoint {
            return Err(ModelError::Unavailable(format!("missing API key environment variable: {env_name}")));
        }
        Ok(Self { endpoint, api_key, model: config.model.clone() })
    }
}

trait BearerAuthExt {
    fn bearer_auth_if_present(self, api_key: &str) -> Self;
}

impl BearerAuthExt for reqwest::blocking::RequestBuilder {
    fn bearer_auth_if_present(self, api_key: &str) -> Self {
        if api_key.is_empty() { self } else { self.bearer_auth(api_key) }
    }
}

impl ModelProvider for OpenAiCompatibleProvider {
    fn complete(&self, request: &ModelRequest) -> Result<ModelResponse, ModelError> {
        let body = serde_json::json!({
            "model": self.model,
            "messages": [
                {"role":"system","content":request.system},
                {"role":"user","content":request.prompt}
            ],
            "max_tokens": request.max_tokens,
            "temperature": request.temperature
        });
        let response = reqwest::blocking::Client::new()
            .post(&self.endpoint)
            .bearer_auth_if_present(&self.api_key)
            .json(&body)
            .send()
            .map_err(|e| ModelError::Unavailable(e.to_string()))?;
        let status=response.status();
        let value:serde_json::Value=response.json()
            .map_err(|e|ModelError::InvalidResponse(e.to_string()))?;
        if !status.is_success() {
            return Err(ModelError::InvalidResponse(value.to_string()));
        }
        let text=value.pointer("/choices/0/message/content").and_then(|v|v.as_str())
            .ok_or_else(||ModelError::InvalidResponse("compatible response contained no choices[0].message.content".into()))?;
        let usage_tokens=value.pointer("/usage/total_tokens").and_then(|v|v.as_u64()).unwrap_or(0) as usize;
        Ok(ModelResponse{text:text.into(),model:self.model.clone(),usage_tokens})
    }
}

impl ModelRouter {
    pub fn route_for_task(&self, kind: &str, min_quota_tokens: usize, max_latency_ms: Option<u32>) -> Result<RoutingDecision, ModelError> {
        let mut available: Vec<&ModelCandidate> = self.candidates.iter()
            .filter(|c| c.healthy && c.remaining_quota_tokens >= min_quota_tokens)
            .filter(|c| max_latency_ms.map(|limit| c.latency_ms <= limit).unwrap_or(true))
            .collect();
        available.sort_by_key(|c| (
            if c.capabilities.iter().any(|cap| cap.eq_ignore_ascii_case(kind)) { 0u8 } else { 1u8 },
            c.estimated_cost_micros,
            c.latency_ms,
            &c.provider,
            &c.model,
        ));
        let c=available.first().ok_or_else(||ModelError::Unavailable("no healthy model satisfies routing constraints".into()))?;
        Ok(RoutingDecision { provider:c.provider.clone(), model:c.model.clone(), reason:format!("task={kind}; capability match first, then cost/latency") })
    }
    pub fn route_plan_for_task(&self, kind: &str, min_quota_tokens: usize, max_latency_ms: Option<u32>) -> Result<RoutingPlan, ModelError> {
        let mut available: Vec<&ModelCandidate> = self.candidates.iter()
            .filter(|c| c.healthy && c.remaining_quota_tokens >= min_quota_tokens)
            .filter(|c| max_latency_ms.map(|limit| c.latency_ms <= limit).unwrap_or(true))
            .collect();
        available.sort_by_key(|c| (
            if c.capabilities.iter().any(|cap| cap.eq_ignore_ascii_case(kind)) { 0u8 } else { 1u8 },
            c.estimated_cost_micros,
            c.latency_ms,
            &c.provider,
            &c.model,
        ));
        if available.is_empty() { return Err(ModelError::Unavailable("no healthy model satisfies routing constraints".into())); }
        let decisions:Vec<RoutingDecision>=available.into_iter().map(|c|RoutingDecision{
            provider:c.provider.clone(),model:c.model.clone(),reason:format!("task={kind}; capability/cost/latency ranking")
        }).collect();
        let mut it=decisions.into_iter();
        let primary=it.next().expect("available is non-empty");
        Ok(RoutingPlan { primary, fallbacks:it.collect() })
    }

}

#[cfg(test)]
mod compatible_tests {
    use super::*;

    #[test]
    fn omniroute_defaults_to_local_gateway() {
        std::env::remove_var("OMNIROUTE_API_KEY");
        let config=EnvModelConfig { provider:"omniroute".into(), model:"demo".into(), endpoint:None, api_key_env:None, metadata:BTreeMap::new() };
        let result=OpenAiCompatibleProvider::from_env(&config);
        assert!(result.is_ok());
    }
}


#[cfg(test)]
mod capability_tests {
    use super::*;

    #[test]
    fn task_capability_beats_lower_cost_generic_candidate() {
        let mut r=ModelRouter::default();
        r.register(ModelCandidate { provider:"generic".into(), model:"cheap".into(), healthy:true, remaining_quota_tokens:1000, estimated_cost_micros:1, latency_ms:10, capabilities:vec![] });
        r.register(ModelCandidate { provider:"coding".into(), model:"code".into(), healthy:true, remaining_quota_tokens:1000, estimated_cost_micros:5, latency_ms:20, capabilities:vec!["coding".into()] });
        assert_eq!(r.route_for_task("coding",10,None).unwrap().model,"code");
    }
}

#[cfg(test)]
mod local_endpoint_tests {
    use super::*;

    #[test]
    fn local_compatible_endpoint_does_not_require_api_key() {
        std::env::remove_var("OS_MODEL_API_KEY_ENV");
        std::env::remove_var("OMNIROUTE_API_KEY");
        let config = EnvModelConfig {
            provider: "ollama".into(),
            model: "qwen3".into(),
            endpoint: Some("http://127.0.0.1:11434/v1/chat/completions".into()),
            api_key_env: None,
            metadata: BTreeMap::new(),
        };
        assert!(OpenAiCompatibleProvider::from_env(&config).is_ok());
    }
}
