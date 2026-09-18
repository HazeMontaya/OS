use os_economy::{EconomicMode, Treasury};
use os_governance::{Decision, DecisionClass, GovernancePolicy};
use os_survival::SurvivalDecision;
#[derive(Clone, Copy, Debug, Eq, PartialEq)] pub enum TaskStatus { Queued, Running, Completed, Blocked, Failed }
#[derive(Clone, Debug)] pub struct AgentTask { pub id:String,pub agent:String,pub class:DecisionClass,pub estimated_cost_cents:i64,pub status:TaskStatus }
#[derive(Clone, Debug)] pub struct ExecutionResult { pub task_id:String,pub decision:Decision,pub status:TaskStatus,pub message:String }
pub struct ExecutionEngine{pub governance:GovernancePolicy}
impl Default for ExecutionEngine{fn default()->Self{Self{governance:GovernancePolicy::default()}}}
impl ExecutionEngine{
 pub fn plan(&self,task:&AgentTask,treasury:&Treasury,mode:EconomicMode,survival:SurvivalDecision)->ExecutionResult{
  if task.class!=DecisionClass::ReadOnly&&mode==EconomicMode::Emergency{return Self::blocked(task,Decision::Deny,"emergency mode blocks non-read-only work");}
  if task.class==DecisionClass::Reversible&&task.estimated_cost_cents>survival.max_experiment_cents{return Self::blocked(task,Decision::Deny,"survival experiment budget exceeded");}
  let decision=self.governance.evaluate(task.class,Some(task.estimated_cost_cents),mode==EconomicMode::Emergency);
  if task.estimated_cost_cents>treasury.spendable_cents(){return Self::blocked(task,Decision::Deny,"treasury balance is insufficient");}
  let status=match decision{Decision::Allow|Decision::Sandbox=>TaskStatus::Queued,_=>TaskStatus::Blocked};
  ExecutionResult{task_id:task.id.clone(),decision,status,message:"task admitted to execution policy".into()}
 }
 fn blocked(t:&AgentTask,d:Decision,m:&str)->ExecutionResult{ExecutionResult{task_id:t.id.clone(),decision:d,status:TaskStatus::Blocked,message:m.into()}}
}