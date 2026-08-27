use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ToolRisk {
    ReadOnly,
    ReversibleWrite,
    SystemChange,
    ExternalAction,
    Destructive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub capabilities: BTreeSet<String>,
    pub risk: ToolRisk,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInvocation {
    pub invocation_id: Uuid,
    pub tool_id: String,
    pub actor: String,
    pub trace_id: Uuid,
    pub arguments: Value,
}

impl ToolInvocation {
    pub fn new(
        tool_id: impl Into<String>,
        actor: impl Into<String>,
        trace_id: Uuid,
        arguments: Value,
    ) -> Self {
        Self {
            invocation_id: Uuid::new_v4(),
            tool_id: tool_id.into(),
            actor: actor.into(),
            trace_id,
            arguments,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ToolResultStatus {
    Success,
    Failed,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub invocation_id: Uuid,
    pub status: ToolResultStatus,
    pub output: Value,
    pub duration_ms: u64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ToolRegistryError {
    #[error("tool already registered: {0}")]
    Duplicate(String),
    #[error("tool not found: {0}")]
    NotFound(String),
    #[error("missing capabilities for tool {tool_id}: {missing:?}")]
    MissingCapabilities { tool_id: String, missing: Vec<String> },
}

#[derive(Debug, Default)]
pub struct ToolRegistry {
    tools: BTreeMap<String, ToolManifest>,
}

impl ToolRegistry {
    pub fn register(&mut self, manifest: ToolManifest) -> Result<(), ToolRegistryError> {
        if self.tools.contains_key(&manifest.id) {
            return Err(ToolRegistryError::Duplicate(manifest.id));
        }
        self.tools.insert(manifest.id.clone(), manifest);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<&ToolManifest> {
        self.tools.get(id)
    }

    pub fn list(&self) -> impl Iterator<Item = &ToolManifest> {
        self.tools.values()
    }

    pub fn authorize(
        &self,
        tool_id: &str,
        granted: &BTreeSet<String>,
    ) -> Result<&ToolManifest, ToolRegistryError> {
        let manifest = self
            .tools
            .get(tool_id)
            .ok_or_else(|| ToolRegistryError::NotFound(tool_id.to_owned()))?;
        let missing = manifest
            .capabilities
            .difference(granted)
            .cloned()
            .collect::<Vec<_>>();
        if missing.is_empty() {
            Ok(manifest)
        } else {
            Err(ToolRegistryError::MissingCapabilities {
                tool_id: tool_id.to_owned(),
                missing,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capability_gate_rejects_missing_permission() {
        let mut registry = ToolRegistry::default();
        registry
            .register(ToolManifest {
                id: "filesystem.read".into(),
                name: "Read file".into(),
                description: "Reads an explicitly scoped file".into(),
                input_schema: serde_json::json!({"type": "object"}),
                capabilities: BTreeSet::from(["Filesystem.Read".into()]),
                risk: ToolRisk::ReadOnly,
                provider: "native".into(),
            })
            .expect("tool registers");
        let error = registry
            .authorize("filesystem.read", &BTreeSet::new())
            .expect_err("capability must be required");
        assert!(matches!(
            error,
            ToolRegistryError::MissingCapabilities { .. }
        ));
    }
}
