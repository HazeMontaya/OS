use std::{fs, path::{Path, PathBuf}, process::Command, time::{Duration,Instant}, thread};
use os_economy::{EconomicMode, Treasury};
use os_capabilities::CapabilityRegistry;
use os_governance::{Decision, DecisionClass, GovernancePolicy};
use os_survival::SurvivalDecision;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TaskStatus { Queued, Running, Completed, Blocked, Failed }

#[derive(Clone, Debug)]
pub struct AgentTask {
    pub id: String, pub agent: String, pub class: DecisionClass,
    pub estimated_cost_cents: i64, pub status: TaskStatus, pub tool: ToolRequest,
}

#[derive(Clone, Debug)]
pub enum ToolRequest {
    ReadFile { path: PathBuf },
    WriteFile { path: PathBuf, content: String },
    RunCommand { program: String, args: Vec<String> },
}
impl ToolRequest {
    pub fn name(&self) -> &'static str { match self {
        Self::ReadFile { .. } => "read_file", Self::WriteFile { .. } => "write_file",
        Self::RunCommand { .. } => "run_command",
    }}
}

#[derive(Clone, Debug)]
pub struct ExecutionContext { pub workspace_root: PathBuf, pub allowed_commands: Vec<String>, pub command_timeout: Duration, pub max_output_bytes: usize }
#[derive(Clone, Debug)]
pub struct ToolOutput { pub success: bool, pub stdout: String, pub stderr: String }
#[derive(Clone, Debug)]
pub struct ExecutionResult {
    pub task_id: String, pub decision: Decision, pub status: TaskStatus,
    pub message: String, pub output: Option<ToolOutput>,
}
pub struct ExecutionEngine { pub governance: GovernancePolicy, pub capabilities: CapabilityRegistry }
impl Default for ExecutionEngine { fn default() -> Self { Self { governance: GovernancePolicy::default(), capabilities: CapabilityRegistry::standard() } } }

impl ExecutionEngine {
    pub fn plan(&self, task:&AgentTask, treasury:&Treasury, mode:EconomicMode, survival:SurvivalDecision, approval:bool)->ExecutionResult {
        if !self.capabilities.allows(task.tool.name(), task.class) { return Self::blocked(task,Decision::Deny,"capability is not registered for this decision class"); }
        if task.class != DecisionClass::ReadOnly && mode == EconomicMode::Emergency { return Self::blocked(task,Decision::Deny,"emergency mode blocks non-read-only work"); }
        if task.class == DecisionClass::Reversible && task.estimated_cost_cents > survival.max_experiment_cents { return Self::blocked(task,Decision::Deny,"survival experiment budget exceeded"); }
        let decision=self.governance.evaluate(task.class,Some(task.estimated_cost_cents),mode==EconomicMode::Emergency);
        if task.estimated_cost_cents > treasury.spendable_cents() { return Self::blocked(task,Decision::Deny,"treasury balance is insufficient"); }
        if matches!(decision,Decision::Ask) && !approval { return Self::blocked(task,decision,"owner approval required"); }
        let status=match decision { Decision::Allow|Decision::Sandbox=>TaskStatus::Queued,_=>TaskStatus::Blocked };
        ExecutionResult{task_id:task.id.clone(),decision,status,message:"task admitted to execution policy".into(),output:None}
    }
    pub fn execute(&self, task:&AgentTask, context:&ExecutionContext, mut planned:ExecutionResult)->ExecutionResult {
        if planned.status != TaskStatus::Queued { return planned; }
        planned.status=TaskStatus::Running;
        let result=match &task.tool {
            ToolRequest::ReadFile{path} => match safe_path(&context.workspace_root,path) {
                Ok(p)=>match fs::read_to_string(p){Ok(s)=>ToolOutput{success:true,stdout:s,stderr:String::new()},Err(e)=>ToolOutput{success:false,stdout:String::new(),stderr:e.to_string()}},
                Err(e)=>return Self::failed(planned,e),
            },
            ToolRequest::WriteFile{path,content} => match safe_path(&context.workspace_root,path) {
                Ok(p)=>{if let Some(parent)=p.parent(){if let Err(e)=fs::create_dir_all(parent){return Self::failed(planned,e.to_string());}}
                    match fs::write(p,content){Ok(())=>ToolOutput{success:true,stdout:"file written".into(),stderr:String::new()},Err(e)=>ToolOutput{success:false,stdout:String::new(),stderr:e.to_string()}}},
                Err(e)=>return Self::failed(planned,e),
            },
            ToolRequest::RunCommand{program,args} => {
                if !context.allowed_commands.iter().any(|x|x==program) { return Self::failed(planned,format!("command not allowlisted: {program}")); }
                let mut child=match Command::new(program).args(args).current_dir(&context.workspace_root).spawn(){ Ok(c)=>c, Err(e)=>return Self::failed(planned,e.to_string()) };
                let started=Instant::now();
let output=loop {
match child.try_wait(){
Ok(Some(_))=>break child.wait_with_output(),
Ok(None) if started.elapsed()>=context.command_timeout=>{let _=child.kill();let _=child.wait();return Self::failed(planned,"command timed out".into());}
Ok(None)=>thread::sleep(Duration::from_millis(10)),
Err(e)=>return Self::failed(planned,e.to_string()),
}
};
match output{
                    Ok(o)=>ToolOutput{success:o.status.success(),stdout:String::from_utf8_lossy(&o.stdout[..o.stdout.len().min(context.max_output_bytes)]).into_owned(),stderr:String::from_utf8_lossy(&o.stderr[..o.stderr.len().min(context.max_output_bytes)]).into_owned()},
                    Err(e)=>ToolOutput{success:false,stdout:String::new(),stderr:e.to_string()},
                }
            }
        };
        planned.status=if result.success{TaskStatus::Completed}else{TaskStatus::Failed};
        planned.message=if result.success{"tool execution completed".into()}else{"tool execution failed".into()};
        planned.output=Some(result); planned
    }
    fn blocked(t:&AgentTask,d:Decision,m:&str)->ExecutionResult{ExecutionResult{task_id:t.id.clone(),decision:d,status:TaskStatus::Blocked,message:m.into(),output:None}}
    fn failed(mut r:ExecutionResult,message:String)->ExecutionResult{r.status=TaskStatus::Failed;r.message=message;r}
}
fn safe_path(root:&Path,requested:&Path)->Result<PathBuf,String>{
    let candidate=if requested.is_absolute(){requested.to_path_buf()}else{root.join(requested)};
    let root=root.canonicalize().map_err(|e|e.to_string())?;
    let parent=candidate.parent().ok_or_else(||"invalid path".to_string())?;
    let parent=parent.canonicalize().unwrap_or_else(|_|parent.to_path_buf());
    if !parent.starts_with(&root){return Err("path escapes workspace".into());} Ok(candidate)
}
