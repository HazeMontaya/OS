use os_economy::{EconomicMode,TreasurySnapshot};
use os_execution::ToolRequest;
use os_governance::DecisionClass;
use os_revenue::RevenueProject;

#[derive(Clone,Debug)]
pub struct PlanItem{pub agent:String,pub class:DecisionClass,pub estimated_cost_cents:i64,pub tool:ToolRequest,pub approval:bool,pub reason:String}

#[derive(Clone,Debug)]
pub struct PlannerInput<'a>{pub treasury:TreasurySnapshot,pub opportunities:&'a [RevenueProject],pub queued_tasks:usize}

pub trait Planner{fn plan(&self,input:PlannerInput<'_>)->Vec<PlanItem>;}

#[derive(Clone,Debug,Default)]
pub struct RulePlanner;

impl Planner for RulePlanner{
 fn plan(&self,input:PlannerInput<'_>)->Vec<PlanItem>{
   if input.queued_tasks>0{return Vec::new();}
   let mut out=Vec::new();
   if input.treasury.mode!=EconomicMode::Emergency {
     if input.opportunities.iter().any(|p| p.opportunity.actionable(input.treasury.mode)) {
       out.push(PlanItem{agent:"agent-03".into(),class:DecisionClass::ReadOnly,estimated_cost_cents:0,tool:ToolRequest::RunCommand{program:"rustc".into(),args:vec!["--version".into()]},approval:false,reason:"revenue opportunity exists; verify execution environment before next stage".into()});
     }
   }
   if out.is_empty(){
     out.push(PlanItem{agent:"agent-02".into(),class:DecisionClass::ReadOnly,estimated_cost_cents:0,tool:ToolRequest::RunCommand{program:"rustc".into(),args:vec!["--version".into()]},approval:false,reason:"maintenance heartbeat".into()});
   }
   out
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn plans_maintenance_when_idle(){
   let t=TreasurySnapshot{balance_cents:1000,reserved_cents:0,revenue_cents:0,expense_cents:0,burn_rate_cents_per_day:100,runway_days:Some(10),mode:EconomicMode::Optimize};
   let p=RulePlanner.plan(PlannerInput{treasury:t,opportunities:&[],queued_tasks:0});
   assert_eq!(p.len(),1);
 }
}
