use os_agents::{AgentRegistry, AgentSpec};
use os_automation::AutomationGraph;
use os_system::SystemDescriptor;
use os_tools::{ToolManifest, ToolRegistry, ToolRisk};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug)]
pub struct RuntimeCatalog {
    pub agents: AgentRegistry,
    pub tools: ToolRegistry,
    pub automations: BTreeMap<String, AutomationGraph>,
    pub system: SystemDescriptor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeSnapshot {
    pub agent_count: usize,
    pub tool_count: usize,
    pub automation_count: usize,
    pub platform: String,
    pub architecture: String,
    pub surfaces: Vec<String>,
}

impl RuntimeCatalog {
    pub fn with_defaults() -> Self {
        let mut agents = AgentRegistry::default();
        let mut core = AgentSpec::new(
            "OS Core",
            "Coordinate cognition, retrieval, models, tools and verification",
        );
        core.capabilities = vec![
            "Memory.Read".into(),
            "Knowledge.Read".into(),
            "Model.Invoke".into(),
        ];
        agents.register(core).expect("default agent id is unique");

        let mut tools = ToolRegistry::default();
        for manifest in default_tools() {
            tools
                .register(manifest)
                .expect("default tool ids are unique");
        }

        Self {
            agents,
            tools,
            automations: BTreeMap::new(),
            system: SystemDescriptor::detect(),
        }
    }

    pub fn snapshot(&self) -> RuntimeSnapshot {
        RuntimeSnapshot {
            agent_count: self.agents.list().count(),
            tool_count: self.tools.list().count(),
            automation_count: self.automations.len(),
            platform: self.system.platform.clone(),
            architecture: self.system.architecture.clone(),
            surfaces: vec![
                "main".into(),
                "knowledge".into(),
                "memory".into(),
                "agents".into(),
                "developer".into(),
                "system".into(),
                "settings".into(),
                "automation".into(),
            ],
        }
    }
}

fn default_tools() -> Vec<ToolManifest> {
    vec![
        ToolManifest {
            id: "filesystem.read".into(),
            name: "Filesystem Read".into(),
            description: "Read an explicitly scoped file or directory".into(),
            input_schema: json!({"type":"object","required":["path"],"properties":{"path":{"type":"string"}}}),
            capabilities: BTreeSet::from(["Filesystem.Read".into()]),
            risk: ToolRisk::ReadOnly,
            provider: "native".into(),
        },
        ToolManifest {
            id: "git.inspect".into(),
            name: "Git Inspect".into(),
            description: "Inspect repository state without mutation".into(),
            input_schema: json!({"type":"object","properties":{"repository":{"type":"string"}}}),
            capabilities: BTreeSet::from(["Filesystem.Read".into()]),
            risk: ToolRisk::ReadOnly,
            provider: "native".into(),
        },
        ToolManifest {
            id: "network.request".into(),
            name: "Network Request".into(),
            description: "Perform a policy-gated outbound request".into(),
            input_schema: json!({"type":"object","required":["url"],"properties":{"url":{"type":"string"}}}),
            capabilities: BTreeSet::from(["Network.Request".into()]),
            risk: ToolRisk::ExternalAction,
            provider: "native".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_exposes_all_product_surfaces() {
        let snapshot = RuntimeCatalog::with_defaults().snapshot();
        assert_eq!(snapshot.surfaces.len(), 8);
        assert!(snapshot.tool_count >= 3);
    }
}
