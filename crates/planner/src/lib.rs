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
 #[test]fn goal_planner_compiles_dependency_order(){let mut graph=os_orchestration::GoalGraph::default();graph.add_goal(os_orchestration::Goal{id:"a".into(),title:"A".into(),description:"".into(),kind:os_orchestration::GoalKind::Task,action:Some(os_orchestration::GoalAction::VerifyRuntime),owner_agent:Some("agent-01".into()),status:os_orchestration::GoalStatus::Proposed,parent_id:None,depends_on:std::collections::BTreeSet::new()}).unwrap();let mut deps=std::collections::BTreeSet::new();deps.insert("a".into());graph.add_goal(os_orchestration::Goal{id:"b".into(),title:"B".into(),description:"".into(),kind:os_orchestration::GoalKind::Task,action:Some(os_orchestration::GoalAction::Review),owner_agent:Some("agent-08".into()),status:os_orchestration::GoalStatus::Proposed,parent_id:None,depends_on:deps}).unwrap();let plan=GoalPlanner::default().compile(&graph);assert_eq!(plan[0].goal_id,"a");assert_eq!(plan[1].goal_id,"b");}
 #[test]fn plans_maintenance_when_idle(){
   let t=TreasurySnapshot{balance_cents:1000,reserved_cents:0,revenue_cents:0,expense_cents:0,burn_rate_cents_per_day:100,runway_days:Some(10),mode:EconomicMode::Optimize};
   let p=RulePlanner::default().plan(PlannerInput{treasury:t,opportunities:&[],queued_tasks:0});
   assert_eq!(p.len(),1);
 }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalPlanStep {
    pub index: usize,
    pub goal_id: String,
    pub agent: String,
    pub action: os_orchestration::GoalAction,
    pub depends_on: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct GoalPlanner;

impl GoalPlanner {
    pub fn compile(&self, graph: &os_orchestration::GoalGraph) -> Vec<GoalPlanStep> {
        fn visit(
            id: &str,
            graph: &os_orchestration::GoalGraph,
            seen: &mut std::collections::BTreeSet<String>,
            visiting: &mut std::collections::BTreeSet<String>,
            out: &mut Vec<String>,
        ) {
            if seen.contains(id) || visiting.contains(id) { return; }
            visiting.insert(id.to_string());
            if let Some(goal)=graph.goals.get(id) {
                for dep in &goal.depends_on { visit(dep,graph,seen,visiting,out); }
                if goal.kind==os_orchestration::GoalKind::Task && goal.action.is_some() {
                    out.push(id.to_string());
                }
            }
            visiting.remove(id);
            seen.insert(id.to_string());
        }
        let mut ids=Vec::new();
        let mut seen=std::collections::BTreeSet::new();
        let mut visiting=std::collections::BTreeSet::new();
        for id in graph.goals.keys() { visit(id,graph,&mut seen,&mut visiting,&mut ids); }
        ids.into_iter().enumerate().filter_map(|(index,id)| {
            let goal=graph.goals.get(&id)?;
            Some(GoalPlanStep {
                index,
                goal_id:id,
                agent:goal.owner_agent.clone().unwrap_or_else(||"agent-01".into()),
                action:goal.action?,
                depends_on:goal.depends_on.iter().cloned().collect(),
            })
        }).collect()
    }
}
