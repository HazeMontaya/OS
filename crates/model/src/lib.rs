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
            .bearer_auth(&self.api_key)
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
