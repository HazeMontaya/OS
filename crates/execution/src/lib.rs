use os_economy::{EconomicMode, Treasury};
use os_governance::{Decision, DecisionClass, GovernancePolicy};
use os_survival::SurvivalDecision;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TaskStatus { Queued, Running, Completed, Blocked, Failed }

#[derive(Clone, Debug)]
pub struct AgentTask {
    pub id: String,
    pub agent: String,
    pub class: DecisionClass,
    pub estimated_cost_cents: i64,
    pub status: TaskStatus,
}

#[derive(Clone, Debug)]
pub struct ExecutionResult {
    pub task_id: String,
    pub decision: Decision,
    pub status: TaskStatus,
    pub message: String,
}

pub struct ExecutionEngine {
    pub governance: GovernancePolicy,
}

impl Default for ExecutionEngine {
    fn default() -> Self { Self { governance: GovernancePolicy::default() } }
}

impl ExecutionEngine {
    pub fn plan(&self, task: &AgentTask, treasury: &Treasury, mode: EconomicMode, survival: SurvivalDecision) -> ExecutionResult {
        if task.class != DecisionClass::ReadOnly && mode == EconomicMode::Emergency {
            return ExecutionResult { task_id: task.id.clone(), decision: Decision::Deny, status: TaskStatus::Blocked, message: "emergency mode blocks non-read-only work".into() };
        }
        if task.class == DecisionClass::Reversible && task.estimated_cost_cents > survival.max_experiment_cents {
            return ExecutionResult { task_id: task.id.clone(), decision: Decision::Deny, status: TaskStatus::Blocked, message: "survival budget exceeded".into() };
        }
        let decision = self.governance.evaluate(task.class, Some(task.estimated_cost_cents), mode == EconomicMode::Emergency);
        let spendable = treasury.snapshot(os_economy::SurvivalThresholds { explore_days: 30, operate_days: 14, optimize_days: 7, emergency_days: 2 }).balance_cents;
        if task.estimated_cost_cents > spendable {
            return ExecutionResult { task_id: task.id.clone(), decision: Decision::Deny, status: TaskStatus::Blocked, message: "treasury balance is insufficient".into() };
        }
        let status = match decision { Decision::Allow | Decision::Sandbox => TaskStatus::Queued, _ => TaskStatus::Blocked };
        ExecutionResult { task_id: task.id.clone(), decision, status, message: "task admitted to execution policy".into() }
    }
}
