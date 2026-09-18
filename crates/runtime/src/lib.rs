use os_economy::{SurvivalThresholds,Treasury,TreasurySnapshot};
use os_memory::Memory;
use os_events::{Event,EventLog};
use os_evolution::ChangeProposal;
use os_execution::{AgentTask,ExecutionContext,ExecutionEngine,ExecutionResult,TaskStatus,ToolRequest};
use os_governance::DecisionClass;
use os_revenue::{Opportunity,RevenueProject};
use os_survival::SurvivalDecision;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool,Ordering};
use std::time::Duration;

#[derive(Clone,Debug)] pub struct Agent{pub id:String,pub role:String}
#[derive(Clone,Debug)] pub struct CycleResult{pub kind:String,pub agent:String,pub summary:String,pub success:bool}
#[derive(Clone,Debug)] pub struct RuntimeSnapshot{pub agents:Vec<Agent>,pub treasury:TreasurySnapshot,pub survival:SurvivalDecision,pub opportunities:usize,pub changes:usize,pub events:usize}
pub struct Runtime{
 pub agents:Vec<Agent>,pub treasury:Treasury,pub opportunities:Vec<RevenueProject>,pub changes:Vec<ChangeProposal>,
 pub execution:ExecutionEngine,pub events:EventLog,pub memory:Memory,pub context:ExecutionContext,thresholds:SurvivalThresholds,next_task:u64
}
impl Runtime{
 pub fn new(initial_balance_cents:i64)->Self{
  let roles=["Governor","Research","Business","Engineering","Content","Finance","Operations","QA","Security"];
  let agents=roles.iter().enumerate().map(|(i,r)|Agent{id:format!("agent-{:02}",i+1),role:(*r).into()}).collect();
  let mut treasury=Treasury::new(initial_balance_cents);treasury.set_burn_rate(100);
  Self{agents,treasury,opportunities:vec![],changes:vec![],execution:ExecutionEngine::default(),events:EventLog::default(),memory:Memory::default(),
   context:ExecutionContext{workspace_root:PathBuf::from("."),allowed_commands:vec!["cargo".into(),"rustc".into(),"git".into()]},
   thresholds:SurvivalThresholds{explore_days:30,operate_days:14,optimize_days:7,emergency_days:2},next_task:1}
 }
 pub fn snapshot(&self)->RuntimeSnapshot{let t=self.treasury.snapshot(self.thresholds);RuntimeSnapshot{agents:self.agents.clone(),survival:os_survival::replan(t.mode),treasury:t,opportunities:self.opportunities.len(),changes:self.changes.len(),events:self.events.len()}}
 pub fn submit_task(&mut self,agent:&str,class:DecisionClass,cost:i64,tool:ToolRequest,approval:bool)->ExecutionResult{
  let snap=self.snapshot();let task=AgentTask{id:format!("task-{:06}",self.next_task),agent:agent.into(),class,estimated_cost_cents:cost.max(0),status:TaskStatus::Queued,tool};
  self.next_task+=1;let planned=self.execution.plan(&task,&self.treasury,snap.treasury.mode,snap.survival,approval);
  if planned.status==TaskStatus::Queued{
   self.events.push(Event::TaskQueued{task_id:task.id.clone(),agent:task.agent.clone()});
   self.events.push(Event::TaskStarted{task_id:task.id.clone()});self.events.push(Event::ToolCalled{task_id:task.id.clone(),tool:task.tool.name().into()});
   let result=self.execution.execute(&task,&self.context,planned);
   self.events.push(Event::ToolCompleted{task_id:task.id.clone(),tool:task.tool.name().into(),success:result.status==TaskStatus::Completed});
   if result.status==TaskStatus::Completed{self.events.push(Event::TaskCompleted{task_id:task.id.clone()});} result
  }else{self.events.push(Event::TaskBlocked{task_id:task.id.clone(),reason:planned.message.clone()});planned}
 }
 pub fn heartbeat(&mut self, agent:&str, class:DecisionClass, cost:i64, tool:ToolRequest, approval:bool) -> ExecutionResult {
  self.events.push(Event::HeartbeatStarted { agent: agent.into() });
  self.memory.remember(agent, "thought", "select task and execute through governance");
  let result = self.submit_task(agent, class, cost, tool, approval);
  self.memory.remember(agent, "observation", format!("{:?}: {}", result.status, result.message));
  self.events.push(Event::HeartbeatFinished { agent: agent.into(), status: format!("{:?}", result.status) });
  result
 }
 pub fn persist_memory(&self, path: impl AsRef<std::path::Path>) -> std::io::Result<()> { self.memory.append_jsonl(path) }
 pub fn register_opportunity(&mut self,o:Opportunity){self.opportunities.push(RevenueProject::new(o))}
 pub fn next_revenue_project(&self) -> Option<usize> {
    let mode = self.snapshot().treasury.mode;
    self.opportunities.iter().enumerate()
        .filter(|(_, p)| p.stage != os_revenue::RevenueStage::Stopped && p.opportunity.actionable(mode))
        .max_by_key(|(_, p)| p.opportunity.expected_value_cents())
        .map(|(i, _)| i)
 }
 pub fn advance_best_revenue_project(&mut self) -> Option<os_revenue::RevenueStage> {
    let index = self.next_revenue_project()?;
    let project = &mut self.opportunities[index];
    let stage = project.advance().ok()?;
    self.memory.remember("agent-03", "revenue", format!("{} advanced to {:?}", project.opportunity.name, stage));
    self.events.push(Event::RevenueStageAdvanced { opportunity_id: project.opportunity.id.clone(), stage: format!("{:?}", stage) });
    Some(stage)
 }
 pub fn run_cycle(&mut self) -> CycleResult {
  let mode = self.snapshot().treasury.mode;
  self.memory.remember("agent-01", "cycle", format!("autonomous cycle started in {:?}", mode));
  if let Some(index) = self.next_revenue_project() {
      let name = self.opportunities[index].opportunity.name.clone();
      if let Some(stage) = self.advance_best_revenue_project() {
          self.memory.remember("agent-03", "revenue", format!("{} -> {:?}", name, stage));
          return CycleResult { kind: "revenue".into(), agent: "agent-03".into(), summary: format!("advanced {} to {:?}", name, stage), success: true };
      }
  }
  let result = self.heartbeat(
      "agent-02",
      DecisionClass::ReadOnly,
      0,
      ToolRequest::RunCommand { program: "rustc".into(), args: vec!["--version".into()] },
      false,
  );
  CycleResult {
      kind: "maintenance".into(),
      agent: "agent-02".into(),
      summary: result.output.as_ref().map(|o| o.stdout.trim().to_string()).unwrap_or(result.message.clone()),
      success: result.status == TaskStatus::Completed,
  }
 }
 pub fn run_cycles(&mut self, count: usize) -> Vec<CycleResult> {(0..count).map(|_| self.run_cycle()).collect()}
 pub fn run_until_stopped(&mut self, stop: &AtomicBool, interval: Duration) -> usize {
     let mut cycles = 0;
     while !stop.load(Ordering::Relaxed) {
         let _ = self.run_cycle();
         cycles += 1;
         let mut waited = Duration::ZERO;
         while waited < interval && !stop.load(Ordering::Relaxed) {
             let slice = (interval - waited).min(Duration::from_millis(250));
             std::thread::sleep(slice);
             waited += slice;
         }
     }
     cycles
 }
 pub fn register_change(&mut self,p:ChangeProposal){self.changes.push(p)}
 pub fn record_revenue(&mut self,cents:i64,memo:impl Into<String>){let memo=memo.into();self.treasury.record_revenue(cents,memo.clone());self.events.push(Event::RevenueRecorded{cents,memo});}
 pub fn record_expense(&mut self,cents:i64,memo:impl Into<String>)->Result<(),&'static str>{let memo=memo.into();let r=self.treasury.record_expense(cents,memo.clone());if r.is_ok(){self.events.push(Event::ExpenseRecorded{cents,memo});}r}
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn boots(){assert_eq!(Runtime::new(100_000).agents.len(),9)}
 #[test]fn autonomous_cycle_runs(){let mut r=Runtime::new(100_000);let result=r.run_cycle();assert_eq!(result.agent,"agent-02");assert!(r.snapshot().events>0)}
 #[test]fn revenue_cycles_through_stages(){let mut r=Runtime::new(100_000);r.register_opportunity(Opportunity{id:"x".into(),name:"x".into(),hypothesis:"h".into(),expected_revenue_cents:100,expected_cost_cents:1,confidence_bps:9000});for _ in 0..6{let result=r.run_cycle();assert_eq!(result.kind,"revenue");}assert_eq!(r.opportunities[0].stage,os_revenue::RevenueStage::Measuring)}
 #[test]fn readonly_executes_real_tool(){let mut r=Runtime::new(100_000);r.context.workspace_root=std::env::temp_dir();let result=r.submit_task("agent-02",DecisionClass::ReadOnly,0,ToolRequest::ReadFile{path:PathBuf::from("haze-os-runtime-test.txt")},false);assert_eq!(result.status,TaskStatus::Failed);assert!(r.snapshot().events>=4);}
}
