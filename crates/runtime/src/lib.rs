use os_agents::{AgentRegistry, AgentSpec};
use os_automation::AutomationGraph;
use os_economy::Treasury;
use os_governance::GovernancePolicy;
use os_survival::SurvivalDecision;
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
    pub treasury: Treasury,
    pub governance: GovernancePolicy,
    pub opportunities: Vec<os_revenue::Opportunity>,
    pub changes: Vec<os_evolution::ChangeProposal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeSnapshot {
    pub agent_count: usize,
    pub tool_count: usize,
    pub automation_count: usize,
    pub platform: String,
    pub architecture: String,
    pub surfaces: Vec<String>,
    pub treasury_balance_cents: i64,
    pub runway_days: Option<u64>,
    pub economic_mode: os_economy::EconomicMode,
}

impl RuntimeCatalog {
    pub fn with_defaults() -> Self {
        let mut agents = AgentRegistry::default();
        let definitions = [
            ("Governor", "Maintain strategic objectives, economic solvency and policy compliance"),
            ("Research", "Discover and validate high-value opportunities"),
            ("Business", "Turn validated opportunities into customers and revenue"),
            ("Engineering", "Build, test and maintain software"),
            ("Content", "Produce and optimize useful content"),
            ("Finance", "Measure treasury, costs, revenue and runway"),
            ("Operations", "Execute approved workflows and maintain services"),
            ("QA", "Verify outputs, releases and economic claims"),
            ("Security", "Enforce capabilities, sandboxing and audit requirements"),
        ];
        for (name, objective) in definitions {
            let mut spec = AgentSpec::new(name, objective);
            spec.capabilities = vec!["Memory.Read".into(), "Knowledge.Read".into(), "Model.Invoke".into()];
            agents.register(spec).expect("default agent id is unique");
        }

        let mut tools = ToolRegistry::default();
        for manifest in default_tools() {
            tools.register(manifest).expect("default tool ids are unique");
        }

        Self {
            agents,
            tools,
            automations: BTreeMap::new(),
            system: SystemDescriptor::detect(),
            treasury: Treasury::new(0),
            governance: GovernancePolicy::default(),
            opportunities: Vec::new(),
            changes: Vec::new(),
        }
    }

    pub fn register_opportunity(&mut self, opportunity: os_revenue::Opportunity) -> bool {
        let decision = self.survival_decision();
        if opportunity.is_actionable(decision.mode, decision.max_experiment_cents) {
            self.opportunities.push(opportunity);
            true
        } else {
            false
        }
    }

    pub fn register_change(&mut self, change: os_evolution::ChangeProposal) {
        self.changes.push(change);
    }

    pub fn survival_decision(&self) -> SurvivalDecision {
        os_survival::decide(self.treasury.snapshot(), os_economy::SurvivalThresholds::default())
    }

    pub fn snapshot(&self) -> RuntimeSnapshot {
        let treasury = self.treasury.snapshot();
        RuntimeSnapshot {
            agent_count: self.agents.list().count(),
            tool_count: self.tools.list().count(),
            automation_count: self.automations.len(),
            platform: self.system.platform.clone(),
            architecture: self.system.architecture.clone(),
            surfaces: vec![
                "main".into(), "knowledge".into(), "memory".into(), "agents".into(),
                "developer".into(), "system".into(), "settings".into(), "automation".into(),
                "economy".into(), "treasury".into(), "governance".into(),
            ],
            treasury_balance_cents: treasury.balance_cents,
            runway_days: treasury.runway_days,
            economic_mode: treasury.mode,
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
    fn bootstrap_exposes_economic_agent_organization() {
        let runtime = RuntimeCatalog::with_defaults();
        let snapshot = runtime.snapshot();
        assert_eq!(snapshot.agent_count, 9);
        assert_eq!(snapshot.surfaces.len(), 11);
        assert_eq!(snapshot.economic_mode, os_economy::EconomicMode::Explore);
    }
}
