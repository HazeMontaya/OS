use os_economy::{SurvivalThresholds,Treasury,TreasurySnapshot};
use os_memory::Memory;
use os_events::{Event,EventLog};
use os_evolution::ChangeProposal;
use os_execution::{AgentTask,ExecutionContext,ExecutionEngine,ExecutionResult,TaskStatus,ToolRequest};
use os_governance::{Decision, DecisionClass};
use os_revenue::{Opportunity,RevenueProject};
use os_survival::SurvivalDecision;
use os_planner::{Planner,PlannerInput,RulePlanner};
use os_model::{EnvModelConfig, ModelProvider, ModelRequest, ModelResponse};
use os_commerce::Commerce;
use os_research::ResearchPolicy;
use os_orchestration::{AgentHandoff, DecisionRecord, NodeKind, WorkGraph, WorkItem, WorkspaceRegistry};
use os_model::{ModelCandidate, ModelRouter, RoutingDecision, ModelError};
use os_system_model::{EntityKind, Evidence, SystemModel, VerificationStatus};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool,Ordering};
use std::time::Duration;

#[derive(Clone,Debug)] pub struct Agent{pub id:String,pub role:String}
#[derive(Clone,Debug)] pub struct CycleResult{pub kind:String,pub agent:String,pub summary:String,pub success:bool}
#[derive(Clone,Debug)] pub struct RuntimeSnapshot{pub agents:Vec<Agent>,pub treasury:TreasurySnapshot,pub survival:SurvivalDecision,pub opportunities:usize,pub changes:usize,pub events:usize,pub queued_tasks:usize,pub customers:usize,pub outstanding_invoices_cents:i64,pub work_items:usize,pub workspaces:usize,pub decisions:usize,pub model_candidates:usize,pub system_entities:usize,pub system_relations:usize,pub system_evidence:usize}
#[derive(Clone,Debug)] pub struct QueuedTask{pub agent:String,pub class:DecisionClass,pub cost:i64,pub tool:ToolRequest,pub approval:bool}

#[derive(serde::Serialize, serde::Deserialize)]
struct PersistedOrchestrationState {
    work_items: Vec<WorkItem>,
    workspaces: Vec<os_orchestration::AgentWorkspace>,
    decisions: Vec<DecisionRecord>,
}

pub struct Runtime{
 pub agents:Vec<Agent>,pub treasury:Treasury,pub opportunities:Vec<RevenueProject>,pub changes:Vec<ChangeProposal>,
 pub execution:ExecutionEngine,pub model:EnvModelConfig,pub model_router:ModelRouter,pub planner:RulePlanner,pub commerce:Commerce,pub research_policy:ResearchPolicy,pub pending_tasks:Vec<QueuedTask>,pub events:EventLog,pub memory:Memory,pub context:ExecutionContext,pub work_graph:WorkGraph,pub work_items:Vec<WorkItem>,pub workspaces:WorkspaceRegistry,pub decisions:Vec<DecisionRecord>,pub system_model:SystemModel,thresholds:SurvivalThresholds,next_task:u64
}
impl Runtime{
 pub fn new(initial_balance_cents:i64)->Self{
  let roles=["Governor","Research","Business","Engineering","Content","Finance","Operations","QA","Security"];
  let agents:Vec<Agent>=roles.iter().enumerate().map(|(i,r)|Agent{id:format!("agent-{:02}",i+1),role:(*r).into()}).collect();
  let mut treasury=Treasury::new(initial_balance_cents);treasury.set_burn_rate(100);
  let model=EnvModelConfig::from_env();
  let mut model_router=ModelRouter::default();
  if model.provider != "none" { model_router.register(ModelCandidate { provider:model.provider.clone(), model:model.model.clone(), healthy:true, remaining_quota_tokens:usize::MAX, estimated_cost_micros:0, latency_ms:env_latency_ms(), capabilities:env_model_capabilities() }); }
  let work_graph=default_work_graph(&agents);
  let mut workspaces=WorkspaceRegistry::default();
  for agent in &agents { workspaces.ensure(&agent.id, format!("workspaces/{}", agent.id)); }
  let system_model=bootstrap_system_model(&agents);
  Self{agents,treasury,opportunities:vec![],changes:vec![],execution:ExecutionEngine::default(),model,model_router,planner:RulePlanner::default(),commerce:Commerce::default(),research_policy:ResearchPolicy::default(),pending_tasks:vec![],events:EventLog::default(),memory:Memory::default(),
   context:ExecutionContext{workspace_root:PathBuf::from("."),allowed_commands:vec!["cargo".into(),"rustc".into(),"git".into()],command_timeout:Duration::from_secs(30),max_output_bytes:64*1024},
   work_graph,work_items:vec![],workspaces,decisions:vec![],system_model,thresholds:SurvivalThresholds{explore_days:30,operate_days:14,optimize_days:7,emergency_days:2},next_task:1}
 }
 pub fn snapshot(&self)->RuntimeSnapshot{let t=self.treasury.snapshot(self.thresholds);RuntimeSnapshot{agents:self.agents.clone(),survival:os_survival::replan(t.mode),treasury:t,opportunities:self.opportunities.len(),changes:self.changes.len(),events:self.events.len(),queued_tasks:self.pending_tasks.len(),customers:self.commerce.customers.len(),outstanding_invoices_cents:self.commerce.outstanding_cents(),work_items:self.work_items.len(),workspaces:self.workspaces.all().count(),decisions:self.decisions.len(),model_candidates:self.model_router.candidates().len(),system_entities:self.system_model.entities.len(),system_relations:self.system_model.relations.len(),system_evidence:self.system_model.evidence.len()}}
 pub fn route_model(&self, task_kind:&str, min_quota_tokens:usize, max_latency_ms:Option<u32>) -> Result<RoutingDecision,ModelError> { self.model_router.route_for_task(task_kind,min_quota_tokens,max_latency_ms) }
 pub fn complete_model(&self, task_kind:&str, request:&ModelRequest) -> Result<ModelResponse,ModelError> {
  let route=self.route_model(task_kind,request.max_tokens,None)?;
  match route.provider.to_ascii_lowercase().as_str(){
   "omniroute"|"openai"|"openai-compatible" => { let mut config=self.model.clone(); config.provider=route.provider; config.model=route.model; let provider=os_model::OpenAiCompatibleProvider::from_env(&config)?; provider.complete(request) }
   other => Err(ModelError::Unavailable(format!("no runtime adapter for selected provider: {other}"))),
  }
 }
 pub fn queue_task(&mut self,agent:impl Into<String>,class:DecisionClass,cost:i64,tool:ToolRequest,approval:bool){self.pending_tasks.push(QueuedTask{agent:agent.into(),class,cost:cost.max(0),tool,approval});}
 pub fn execute_next_queued_task(&mut self)->Option<ExecutionResult>{
     let task=self.pending_tasks.first()?.clone();
     self.pending_tasks.remove(0);
     Some(self.submit_task(&task.agent,task.class,task.cost,task.tool,task.approval))
 }
 pub fn submit_task(&mut self,agent:&str,class:DecisionClass,cost:i64,tool:ToolRequest,approval:bool)->ExecutionResult{
  let snap=self.snapshot();let task=AgentTask{id:format!("task-{:06}",self.next_task),agent:agent.into(),class,estimated_cost_cents:cost.max(0),status:TaskStatus::Queued,tool};
  self.next_task+=1;
  let mut decision=DecisionRecord::new(task.id.clone(),task.agent.clone(),format!("Execute {} under {:?}",task.tool.name(),class),task.tool.name());
  decision.expected_outcome="task admitted and verified by the execution result".into();
  decision.evidence.push(format!("economic_mode={:?}",snap.treasury.mode));
  let planned=self.execution.plan(&task,&self.treasury,snap.treasury.mode,snap.survival,approval);
  if planned.status==TaskStatus::Queued{
   if let Ok(item)=self.work_graph.start_item(task.id.clone(),task.agent.clone(),format!("tool:{}",task.tool.name()),&task.agent){self.work_items.push(item);}
   if let Err(reason)=self.workspaces.begin_run(&task.agent) {
       decision.close("blocked",reason.clone(),"repair or reprovision the agent workspace before retry");
       self.decisions.push(decision);
       self.events.push(Event::TaskBlocked{task_id:task.id.clone(),reason});
       return ExecutionResult{task_id:task.id.clone(),decision:Decision::Deny,status:TaskStatus::Blocked,message:"agent workspace is not executable".into(),output:None};
   }
   self.events.push(Event::TaskQueued{task_id:task.id.clone(),agent:task.agent.clone()});
   self.events.push(Event::TaskStarted{task_id:task.id.clone()});self.events.push(Event::ToolCalled{task_id:task.id.clone(),tool:task.tool.name().into()});
   let result=self.execution.execute(&task,&self.context,planned);
   let _=self.workspaces.finish_run(&task.agent);
   if let Some(item)=self.work_items.last_mut(){ self.work_graph.terminal(item,result.status==TaskStatus::Completed); }
   decision.close(if result.status==TaskStatus::Completed {"completed"} else {"failed"},result.message.clone(),if result.status==TaskStatus::Completed {"reuse successful procedure"} else {"inspect failure before retry"});
   self.decisions.push(decision);
   self.events.push(Event::ToolCompleted{task_id:task.id.clone(),tool:task.tool.name().into(),success:result.status==TaskStatus::Completed});
   if result.status==TaskStatus::Completed{self.events.push(Event::TaskCompleted{task_id:task.id.clone()});} result
  }else{
   decision.close("blocked",planned.message.clone(),"policy blocked execution");
   self.decisions.push(decision);
   self.events.push(Event::TaskBlocked{task_id:task.id.clone(),reason:planned.message.clone()});planned
  }
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
  if let Some(result) = self.execute_next_queued_task() { return CycleResult { kind: "task".into(), agent: "scheduler".into(), summary: result.message.clone(), success: result.status == TaskStatus::Completed }; }
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
  if self.pending_tasks.is_empty() {
      let plans=self.planner.plan(PlannerInput{treasury:self.snapshot().treasury.clone(),opportunities:&self.opportunities,queued_tasks:self.pending_tasks.len()});
      for p in plans { self.queue_task(p.agent,p.class,p.estimated_cost_cents,p.tool,p.approval); self.memory.remember("agent-01","plan",p.reason); }
  }
  if let Some(result) = self.execute_next_queued_task() { return CycleResult { kind: "task".into(), agent: "scheduler".into(), summary: result.message.clone(), success: result.status == TaskStatus::Completed }; }
  CycleResult {
      kind: "maintenance".into(),
      agent: "agent-02".into(),
      summary: result.output.as_ref().map(|o| o.stdout.trim().to_string()).unwrap_or(result.message.clone()),
      success: result.status == TaskStatus::Completed,
  }
 }
 pub fn run_cycles(&mut self, count: usize) -> Vec<CycleResult> {(0..count).map(|_| self.run_cycle()).collect()}
 pub fn save_state(&self, path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
     use std::io::Write;
     let path=path.as_ref();
     if let Some(parent)=path.parent(){std::fs::create_dir_all(parent)?;}
     let tmp=path.with_extension("tmp");
     let s=self.treasury.snapshot(self.thresholds);
     let mut f=std::fs::File::create(&tmp)?;
     writeln!(f,"version\t2")?;
     writeln!(f,"treasury\t{}\t{}\t{}\t{}\t{}",s.balance_cents,s.reserved_cents,s.revenue_cents,s.expense_cents,s.burn_rate_cents_per_day)?;
     writeln!(f,"next_task\t{}",self.next_task)?;
     for task in &self.pending_tasks {
         write!(f,"task\t{}\t{:?}\t{}\t{}\t{}",esc(&task.agent),task.class,task.cost,task.approval,tool_kind(&task.tool))?;
         match &task.tool {
             ToolRequest::ReadFile{path} => writeln!(f,"\t{}",esc(&path.to_string_lossy()))?,
             ToolRequest::WriteFile{path,content} => writeln!(f,"\t{}\t{}",esc(&path.to_string_lossy()),esc(content))?,
             ToolRequest::RunCommand{program,args} => {
                 write!(f,"\t{}",esc(program))?;
                 for arg in args { write!(f,"\t{}",esc(arg))?; }
                 writeln!(f)?;
             }
         }
     }
     for p in &self.opportunities { writeln!(f,"opportunity\t{}\t{}\t{}\t{}\t{}\t{}\t{:?}",esc(&p.opportunity.id),esc(&p.opportunity.name),esc(&p.opportunity.hypothesis),p.opportunity.expected_revenue_cents,p.opportunity.expected_cost_cents,p.opportunity.confidence_bps,p.stage)?; }
     f.sync_all()?; std::fs::rename(tmp,path)?; self.system_model.save_json(path.with_extension("system.json"))?; let orchestration=PersistedOrchestrationState{work_items:self.work_items.clone(),workspaces:self.workspaces.all().cloned().collect(),decisions:self.decisions.clone()}; let data=serde_json::to_vec_pretty(&orchestration).map_err(|e|std::io::Error::new(std::io::ErrorKind::InvalidData,e.to_string()))?; std::fs::write(path.with_extension("orchestration.json"),data)?; Ok(())
 }
 pub fn load_state(&mut self, path: impl AsRef<std::path::Path>) -> std::io::Result<()> {
     use std::io::{BufRead,BufReader};
     let state_path=path.as_ref().to_path_buf();
     let file=match std::fs::File::open(&state_path){Ok(f)=>f,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(()),Err(e)=>return Err(e)};
     for line in BufReader::new(file).lines() {
         let line=line?; let mut p=line.split('\t');
         match p.next().unwrap_or("") {
             "treasury" => { let v:Vec<_>=p.collect(); if v.len()==5 { if let (Ok(b),Ok(r),Ok(rv),Ok(ex),Ok(br))=(v[0].parse(),v[1].parse(),v[2].parse(),v[3].parse(),v[4].parse()){self.treasury.restore_state(b,r,rv,ex,br);} } }
             "next_task" => if let Some(v)=p.next(){if let Ok(n)=v.parse::<u64>(){self.next_task=n.max(1);}}
             "task" => {
                 let v:Vec<_>=p.collect();
                 if v.len()>=6 {
                     if let (Some(class),Ok(cost),Ok(approval))=(parse_decision_class(v[1]),v[2].parse::<i64>(),v[3].parse::<bool>()) {
                         if let Some(tool)=parse_tool(v[4],&v[5..]) {
                             self.pending_tasks.push(QueuedTask{agent:unesc(v[0]),class,cost:cost.max(0),tool,approval});
                         }
                     }
                 }
             }
             "opportunity" => { let v:Vec<_>=p.collect(); if v.len()==7 { if let (Ok(rev),Ok(cost),Ok(conf))=(v[3].parse(),v[4].parse(),v[5].parse()){if let Some(stage)=parse_stage(v[6]){self.opportunities.push(RevenueProject{opportunity:Opportunity{id:unesc(v[0]),name:unesc(v[1]),hypothesis:unesc(v[2]),expected_revenue_cents:rev,expected_cost_cents:cost,confidence_bps:conf},stage});}}}}
             _ => {}
         }
     }
     self.system_model=SystemModel::load_json(state_path.with_extension("system.json"))?;
     let orchestration_path=path.as_ref().with_extension("orchestration.json");
     if let Ok(data)=std::fs::read(&orchestration_path) { if let Ok(orchestration)=serde_json::from_slice::<PersistedOrchestrationState>(&data) { self.work_items=orchestration.work_items; self.workspaces.replace_all(orchestration.workspaces); self.decisions=orchestration.decisions; } }
     Ok(())
 }
 pub fn load_journals(&mut self, events: impl AsRef<std::path::Path>, memory: impl AsRef<std::path::Path>) -> std::io::Result<()> {
     self.events=EventLog::load_journal(events)?;
     self.memory=Memory::load_journal(memory)?;
     Ok(())
 }
 pub fn checkpoint(&self, state: impl AsRef<std::path::Path>, events: impl AsRef<std::path::Path>, memory: impl AsRef<std::path::Path>) -> std::io::Result<()> {
     self.save_state(state)?; self.events.append_journal(events)?; self.memory.append_journal(memory)
 }

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
 pub fn handoff(&mut self, work_item_id:&str, next_agent:&str)->Result<AgentHandoff,String>{
  let index=self.work_items.iter().position(|w|w.id==work_item_id).ok_or_else(||"unknown work item".to_string())?;
  let handoff_id=format!("handoff-{:06}",self.events.len()+1);
  let handoff={let item=&mut self.work_items[index];self.work_graph.handoff(item,next_agent,handoff_id.clone())?};
  self.events.push(Event::AgentHandoff{work_item_id:handoff.work_item_id.clone(),from_agent:handoff.from_agent.clone(),to_agent:handoff.to_agent.clone()});
  Ok(handoff)
 }
 pub fn register_change(&mut self,p:ChangeProposal){self.changes.push(p)}
 pub fn record_revenue(&mut self,cents:i64,memo:impl Into<String>){let memo=memo.into();self.treasury.record_revenue(cents,memo.clone());self.events.push(Event::RevenueRecorded{cents,memo});}
 pub fn record_expense(&mut self,cents:i64,memo:impl Into<String>)->Result<(),&'static str>{let memo=memo.into();let r=self.treasury.record_expense(cents,memo.clone());if r.is_ok(){self.events.push(Event::ExpenseRecorded{cents,memo});}r}
}

fn esc(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}
fn unesc(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('t') => out.push('\t'),
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('\\') => out.push('\\'),
                Some(other) => { out.push('\\'); out.push(other); }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out
}
fn tool_kind(tool:&ToolRequest)->&'static str{match tool{ToolRequest::ReadFile{..}=>"ReadFile",ToolRequest::WriteFile{..}=>"WriteFile",ToolRequest::RunCommand{..}=>"RunCommand"}}
fn parse_decision_class(s:&str)->Option<DecisionClass>{match s{"ReadOnly"=>Some(DecisionClass::ReadOnly),"Reversible"=>Some(DecisionClass::Reversible),"External"=>Some(DecisionClass::External),"Financial"=>Some(DecisionClass::Financial),"Destructive"=>Some(DecisionClass::Destructive),"SelfModification"=>Some(DecisionClass::SelfModification),"Replication"=>Some(DecisionClass::Replication),_=>None}}
fn parse_tool(kind:&str,fields:&[&str])->Option<ToolRequest>{match kind{
 "ReadFile"=>Some(ToolRequest::ReadFile{path:PathBuf::from(unesc(*fields.first()?))}),
 "WriteFile"=>Some(ToolRequest::WriteFile{path:PathBuf::from(unesc(*fields.first()?)),content:unesc(*fields.get(1)?)}),
 "RunCommand"=>Some(ToolRequest::RunCommand{program:unesc(*fields.first()?),args:fields.iter().skip(1).map(|v|unesc(v)).collect()}),
 _=>None}}
fn parse_stage(s:&str)->Option<os_revenue::RevenueStage>{match s{"Discovered"=>Some(os_revenue::RevenueStage::Discovered),"Validating"=>Some(os_revenue::RevenueStage::Validating),"Building"=>Some(os_revenue::RevenueStage::Building),"Selling"=>Some(os_revenue::RevenueStage::Selling),"Delivering"=>Some(os_revenue::RevenueStage::Delivering),"Measuring"=>Some(os_revenue::RevenueStage::Measuring),"Stopped"=>Some(os_revenue::RevenueStage::Stopped),_=>None}}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn boots(){assert_eq!(Runtime::new(100_000).agents.len(),9)}
 #[test]fn autonomous_cycle_runs(){let mut r=Runtime::new(100_000);let result=r.run_cycle();assert_eq!(result.agent,"scheduler");assert!(r.snapshot().events>0)}
 #[test]fn revenue_cycles_through_stages(){let mut r=Runtime::new(100_000);r.register_opportunity(Opportunity{id:"x".into(),name:"x".into(),hypothesis:"h".into(),expected_revenue_cents:100,expected_cost_cents:1,confidence_bps:9000});for _ in 0..5{let result=r.run_cycle();assert_eq!(result.kind,"revenue");}assert_eq!(r.opportunities[0].stage,os_revenue::RevenueStage::Measuring)}
 #[test]fn queue_dispatches_task(){let mut r=Runtime::new(100_000);r.queue_task("agent-04",DecisionClass::ReadOnly,0,ToolRequest::RunCommand{program:"rustc".into(),args:vec!["--version".into()]},false);assert_eq!(r.snapshot().queued_tasks,1);let x=r.run_cycle();assert_eq!(x.kind,"task");assert_eq!(r.snapshot().queued_tasks,0)}
 #[test]fn state_recovers_treasury(){let path=std::env::temp_dir().join(format!("haze-state-{}.tsv",std::process::id()));let mut r=Runtime::new(100_000);r.record_revenue(500,"test");r.save_state(&path).unwrap();let mut n=Runtime::new(1);n.load_state(&path).unwrap();assert_eq!(n.snapshot().treasury.balance_cents,100_500);let _=std::fs::remove_file(path);let _=std::fs::remove_file(path.with_extension("system.json"));}
 #[test]fn journals_recover(){let events=std::env::temp_dir().join(format!("haze-events-recover-{}.log",std::process::id()));let memory=std::env::temp_dir().join(format!("haze-memory-recover-{}.log",std::process::id()));let mut r=Runtime::new(100_000);r.events.push(Event::TaskStarted{task_id:"task-1".into()});r.memory.remember("agent-01","note","persisted");r.events.append_journal(&events).unwrap();r.memory.append_journal(&memory).unwrap();let mut n=Runtime::new(1);n.load_journals(&events,&memory).unwrap();assert_eq!(n.events.len(),1);assert_eq!(n.memory.all().len(),1);let _=std::fs::remove_file(events);let _=std::fs::remove_file(memory);}
 #[test]fn queued_task_recovers(){let path=std::env::temp_dir().join(format!("haze-queue-{}.tsv",std::process::id()));let mut r=Runtime::new(100_000);r.queue_task("agent-04",DecisionClass::ReadOnly,0,ToolRequest::RunCommand{program:"rustc".into(),args:vec!["--version".into(),"--verbose".into()]},false);r.save_state(&path).unwrap();let mut n=Runtime::new(1);n.load_state(&path).unwrap();assert_eq!(n.pending_tasks.len(),1);assert_eq!(n.pending_tasks[0].agent,"agent-04");assert_eq!(n.pending_tasks[0].tool.name(),"run_command");let _=std::fs::remove_file(path);}
 #[test]fn readonly_executes_real_tool(){let mut r=Runtime::new(100_000);r.context.workspace_root=std::env::temp_dir();let result=r.submit_task("agent-02",DecisionClass::ReadOnly,0,ToolRequest::ReadFile{path:PathBuf::from("haze-os-runtime-test.txt")},false);assert_eq!(result.status,TaskStatus::Failed);assert!(r.snapshot().events>=4);
}
}

fn default_work_graph(agents:&[Agent])->WorkGraph {
    let mut g=WorkGraph::default();
    for agent in agents { let _=g.add_node(os_orchestration::WorkNode{id:agent.id.clone(),label:agent.role.clone(),agent_id:Some(agent.id.clone()),kind:NodeKind::Agent,class:DecisionClass::ReadOnly}); }
    let edges=[("agent-01","agent-02"),("agent-01","agent-09"),("agent-02","agent-03"),("agent-02","agent-04"),("agent-09","agent-08"),("agent-04","agent-08"),("agent-03","agent-05"),("agent-05","agent-06"),("agent-06","agent-07")];
    for (from,to) in edges { let _=g.connect(from,to,8); }
    g
}



fn bootstrap_system_model(agents:&[Agent]) -> SystemModel {
    let mut model=SystemModel::default();
    let _=model.upsert_entity("james-core",EntityKind::Service,"JAMES Runtime");
    let _=model.upsert_entity("workspace-root",EntityKind::Workspace,"Agent Workspace Root");
    for agent in agents {
        let _=model.upsert_entity(&agent.id,EntityKind::Agent,&agent.role);
        let _=model.link("james-core","controls",&agent.id);
    }
    let evidence=Evidence{
        id:"runtime-bootstrap".into(),
        source:"runtime".into(),
        producer:"os-runtime".into(),
        observed_at_ms:now_ms(),
        verification:VerificationStatus::Verified,
        excerpt:"agent registry and runtime ownership initialized at boot".into(),
    };
    let _=model.add_evidence(evidence);
    for agent in agents {
        let _=model.attach_entity_evidence(&agent.id,"runtime-bootstrap");
    }
    let _=model.add_evidence(Evidence{
        id:"workspace-bootstrap".into(),
        source:"workspace-registry".into(),
        producer:"os-runtime".into(),
        observed_at_ms:now_ms(),
        verification:VerificationStatus::Observed,
        excerpt:"per-agent workspace records created".into(),
    });
    for agent in agents {
        let _=model.link(&agent.id,"owns_workspace","workspace-root");
        let _=model.attach_relation_evidence(&agent.id,"owns_workspace","workspace-root","workspace-bootstrap");
    }
    model
}

fn now_ms() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d|d.as_millis()).unwrap_or(0)
}


fn env_latency_ms() -> u32 { std::env::var("OS_MODEL_LATENCY_MS").ok().and_then(|v|v.parse::<u32>().ok()).unwrap_or(10_000) }
fn env_model_capabilities() -> Vec<String> { std::env::var("OS_MODEL_CAPABILITIES").ok().map(|v|v.split(',').map(|x|x.trim().to_string()).filter(|x|!x.is_empty()).collect()).unwrap_or_default() }
