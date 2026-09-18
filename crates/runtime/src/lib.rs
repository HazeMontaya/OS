use os_economy::{SurvivalThresholds, Treasury, TreasurySnapshot};
use os_evolution::ChangeProposal;
use os_execution::{AgentTask, ExecutionEngine, ExecutionResult};
use os_governance::DecisionClass;
use os_revenue::{Opportunity, RevenueProject};
use os_survival::SurvivalDecision;

#[derive(Clone, Debug)]
pub struct Agent {
    pub id: String,
    pub role: String,
}

#[derive(Clone, Debug)]
pub struct RuntimeSnapshot {
    pub agents: Vec<Agent>,
    pub treasury: TreasurySnapshot,
    pub survival: SurvivalDecision,
    pub opportunities: usize,
    pub changes: usize,
}

pub struct Runtime {
    pub agents: Vec<Agent>,
    pub treasury: Treasury,
    pub opportunities: Vec<RevenueProject>,
    pub changes: Vec<ChangeProposal>,
    pub execution: ExecutionEngine,
    thresholds: SurvivalThresholds,
}

impl Runtime {
    pub fn new(initial_balance_cents: i64) -> Self {
        let roles = ["Governor","Research","Business","Engineering","Content","Finance","Operations","QA","Security"];
        let agents = roles.iter().enumerate().map(|(i, role)| Agent { id: format!("agent-{:02}", i+1), role: (*role).into() }).collect();
        let mut treasury = Treasury::new(initial_balance_cents);
        treasury.set_burn_rate(100);
        Self { agents, treasury, opportunities: Vec::new(), changes: Vec::new(), execution: ExecutionEngine::default(), thresholds: SurvivalThresholds { explore_days: 30, operate_days: 14, optimize_days: 7, emergency_days: 2 } }
    }

    pub fn snapshot(&self) -> RuntimeSnapshot {
        let treasury = self.treasury.snapshot(self.thresholds);
        RuntimeSnapshot { agents: self.agents.clone(), survival: os_survival::replan(treasury.mode), treasury, opportunities: self.opportunities.len(), changes: self.changes.len() }
    }

    pub fn submit_task(&self, agent: &str, class: DecisionClass, cost_cents: i64) -> ExecutionResult {
        let s = self.snapshot();
        let task = AgentTask { id: format!("task-{}", self.opportunities.len() + self.changes.len() + 1), agent: agent.into(), class, estimated_cost_cents: cost_cents.max(0), status: os_execution::TaskStatus::Queued };
        self.execution.plan(&task, &self.treasury, s.treasury.mode, s.survival)
    }

    pub fn register_opportunity(&mut self, opportunity: Opportunity) { self.opportunities.push(RevenueProject::new(opportunity)); }
    pub fn register_change(&mut self, proposal: ChangeProposal) { self.changes.push(proposal); }
}
