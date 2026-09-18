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
