use os_governance::DecisionClass;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NodeKind {
    Trigger,
    Agent,
    Tool,
    Review,
    Governor,
    Output,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkNode {
    pub id: String,
    pub label: String,
    pub agent_id: Option<String>,
    pub kind: NodeKind,
    pub class: DecisionClass,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkEdge {
    pub from: String,
    pub to: String,
    pub max_hops: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkItem {
    pub id: String,
    pub origin: String,
    pub current_node: String,
    pub payload_ref: String,
    pub visited: BTreeSet<String>,
    pub hops: u32,
    pub status: WorkItemStatus,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WorkItemStatus {
    Queued,
    Running,
    Completed,
    Blocked,
    Failed,
}

#[derive(Clone, Debug, Default)]
pub struct WorkGraph {
    pub nodes: BTreeMap<String, WorkNode>,
    pub edges: Vec<WorkEdge>,
}

impl WorkGraph {
    pub fn add_node(&mut self, node: WorkNode) -> Result<(), String> {
        if node.id.trim().is_empty() || node.label.trim().is_empty() {
            return Err("work node id and label are required".into());
        }
        if self.nodes.contains_key(&node.id) {
            return Err("duplicate work node".into());
        }
        self.nodes.insert(node.id.clone(), node);
        Ok(())
    }

    pub fn connect(&mut self, from: &str, to: &str, max_hops: u32) -> Result<(), String> {
        if !self.nodes.contains_key(from) || !self.nodes.contains_key(to) {
            return Err("work edge references unknown node".into());
        }
        if from == to {
            return Err("self-loop is not allowed".into());
        }
        if self.path_exists(to, from) {
            return Err("work graph cycle is blocked".into());
        }
        self.edges.push(WorkEdge { from: from.into(), to: to.into(), max_hops: max_hops.max(1) });
        Ok(())
    }

    pub fn next_nodes(&self, from: &str) -> Vec<&WorkNode> {
        self.edges.iter()
            .filter(|e| e.from == from)
            .filter_map(|e| self.nodes.get(&e.to))
            .collect()
    }

    pub fn path_exists(&self, from: &str, target: &str) -> bool {
        let mut stack = vec![from.to_string()];
        let mut seen = BTreeSet::new();
        while let Some(cur) = stack.pop() {
            if cur == target { return true; }
            if !seen.insert(cur.clone()) { continue; }
            for e in self.edges.iter().filter(|e| e.from == cur) {
                stack.push(e.to.clone());
            }
        }
        false
    }

    pub fn start_item(&self, id: impl Into<String>, origin: impl Into<String>, payload_ref: impl Into<String>, node: &str) -> Result<WorkItem, String> {
        if !self.nodes.contains_key(node) { return Err("unknown work start node".into()); }
        let id=id.into();
        let origin=origin.into();
        let payload_ref=payload_ref.into();
        if id.trim().is_empty() || origin.trim().is_empty() || payload_ref.trim().is_empty() {
            return Err("work item fields are required".into());
        }
        let mut visited=BTreeSet::new();
        visited.insert(node.into());
        Ok(WorkItem { id, origin, current_node: node.into(), payload_ref, visited, hops: 0, status: WorkItemStatus::Queued })
    }

    pub fn advance(&self, item: &mut WorkItem, next: &str) -> Result<(), String> {
        if item.status != WorkItemStatus::Queued && item.status != WorkItemStatus::Running {
            return Err("work item is terminal".into());
        }
        let edge=self.edges.iter().find(|e| e.from==item.current_node && e.to==next)
            .ok_or_else(|| "handoff is not authorized by work graph".to_string())?;
        if item.visited.contains(next) { item.status=WorkItemStatus::Blocked; return Err("work item revisit is blocked".into()); }
        if item.hops >= edge.max_hops { item.status=WorkItemStatus::Blocked; return Err("work item hop limit exceeded".into()); }
        item.current_node=next.into();
        item.hops+=1;
        item.visited.insert(next.into());
        item.status=WorkItemStatus::Running;
        Ok(())
    }

    pub fn terminal(&self, item: &mut WorkItem, success: bool) {
        item.status=if success { WorkItemStatus::Completed } else { WorkItemStatus::Failed };
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WorkspaceStatus { Pending, Provisioning, Ready, Running, Sleeping, Recovery, Stopped }

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentWorkspace {
    pub id: String,
    pub agent_id: String,
    pub root: String,
    pub status: WorkspaceStatus,
    pub budget_cents: i64,
    pub memory_scope: String,
    pub active_runs: u32,
    pub deletion_reserved: bool,
}

#[derive(Clone, Debug, Default)]
pub struct WorkspaceRegistry { items: BTreeMap<String, AgentWorkspace> }

impl WorkspaceRegistry {
    pub fn ensure(&mut self, agent_id: &str, root: impl Into<String>) -> &AgentWorkspace {
        let id=format!("workspace-{agent_id}");
        self.items.entry(id.clone()).or_insert_with(|| AgentWorkspace {
            id, agent_id: agent_id.into(), root: root.into(), status: WorkspaceStatus::Ready, budget_cents: 0, memory_scope: format!("agent:{agent_id}"), active_runs: 0, deletion_reserved: false,
        })
    }
    pub fn set_status(&mut self, agent_id: &str, status: WorkspaceStatus) -> Result<(), String> {
        let id=format!("workspace-{agent_id}");
        let w=self.items.get_mut(&id).ok_or_else(|| "unknown workspace".to_string())?;
        if w.deletion_reserved { return Err("workspace deletion is reserved".into()); }
        if w.active_runs>0 && matches!(status,WorkspaceStatus::Stopped|WorkspaceStatus::Pending|WorkspaceStatus::Provisioning) { return Err("workspace has active runs".into()); }
        let allowed=matches!((w.status,status),
            (WorkspaceStatus::Pending,WorkspaceStatus::Provisioning) |
            (WorkspaceStatus::Provisioning,WorkspaceStatus::Ready) |
            (WorkspaceStatus::Ready,WorkspaceStatus::Running|WorkspaceStatus::Stopped) |
            (WorkspaceStatus::Running,WorkspaceStatus::Sleeping|WorkspaceStatus::Recovery) |
            (WorkspaceStatus::Sleeping,WorkspaceStatus::Running|WorkspaceStatus::Recovery|WorkspaceStatus::Stopped) |
            (WorkspaceStatus::Recovery,WorkspaceStatus::Ready|WorkspaceStatus::Running|WorkspaceStatus::Stopped) |
            (WorkspaceStatus::Stopped,WorkspaceStatus::Pending|WorkspaceStatus::Provisioning));
        if !allowed && w.status!=status { return Err(format!("invalid workspace transition {:?} -> {:?}",w.status,status)); }
        w.status=status;
        Ok(())
    }
    pub fn begin_run(&mut self, agent_id:&str)->Result<(),String>{
        let id=format!("workspace-{agent_id}");
        let w=self.items.get_mut(&id).ok_or_else(|| "unknown workspace".to_string())?;
        if w.deletion_reserved { return Err("workspace deletion is reserved".into()); }
        if matches!(w.status,WorkspaceStatus::Pending|WorkspaceStatus::Provisioning|WorkspaceStatus::Stopped) { return Err("workspace is not executable".into()); }
        w.status=WorkspaceStatus::Running;
        w.active_runs=w.active_runs.saturating_add(1);
        Ok(())
    }
    pub fn finish_run(&mut self, agent_id:&str)->Result<(),String>{
        let id=format!("workspace-{agent_id}");
        let w=self.items.get_mut(&id).ok_or_else(|| "unknown workspace".to_string())?;
        if w.active_runs==0 { return Err("workspace has no active run".into()); }
        w.active_runs-=1;
        if w.active_runs==0 && !w.deletion_reserved { w.status=WorkspaceStatus::Ready; }
        Ok(())
    }
    pub fn reserve_deletion(&mut self, agent_id:&str)->Result<(),String>{
        let id=format!("workspace-{agent_id}");
        let w=self.items.get_mut(&id).ok_or_else(|| "unknown workspace".to_string())?;
        if w.active_runs>0 { return Err("cannot reserve deletion while runs are active".into()); }
        w.deletion_reserved=true; w.status=WorkspaceStatus::Stopped; Ok(())
    }
    pub fn all(&self)->impl Iterator<Item=&AgentWorkspace>{ self.items.values() }
    pub fn get(&self, agent_id:&str)->Option<&AgentWorkspace>{ self.items.get(&format!("workspace-{agent_id}")) }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DecisionRecord {
    pub id: String,
    pub agent_id: String,
    pub hypothesis: String,
    pub evidence: Vec<String>,
    pub action: String,
    pub expected_outcome: String,
    pub actual_outcome: Option<String>,
    pub delta: Option<String>,
    pub lesson: Option<String>,
    pub confidence_bps: u16,
}

impl DecisionRecord {
    pub fn new(id: impl Into<String>, agent_id: impl Into<String>, hypothesis: impl Into<String>, action: impl Into<String>) -> Self {
        Self { id:id.into(), agent_id:agent_id.into(), hypothesis:hypothesis.into(), evidence:Vec::new(), action:action.into(), expected_outcome:String::new(), actual_outcome:None, delta:None, lesson:None, confidence_bps:0 }
    }
    pub fn close(&mut self, actual: impl Into<String>, delta: impl Into<String>, lesson: impl Into<String>) {
        self.actual_outcome=Some(actual.into());
        self.delta=Some(delta.into());
        self.lesson=Some(lesson.into());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(id:&str)->WorkNode{WorkNode{id:id.into(),label:id.into(),agent_id:None,kind:NodeKind::Agent,class:DecisionClass::ReadOnly}}
    #[test] fn graph_blocks_cycles(){let mut g=WorkGraph::default();g.add_node(node("a")).unwrap();g.add_node(node("b")).unwrap();g.connect("a","b",4).unwrap();assert!(g.connect("b","a",4).is_err());}
    #[test] fn work_item_handoff(){let mut g=WorkGraph::default();g.add_node(node("a")).unwrap();g.add_node(node("b")).unwrap();g.connect("a","b",4).unwrap();let mut w=g.start_item("w1","telegram","payload:1","a").unwrap();g.advance(&mut w,"b").unwrap();assert_eq!(w.hops,1);}
    #[test] fn workspace_lifecycle(){let mut r=WorkspaceRegistry::default();r.ensure("agent-01",".");r.begin_run("agent-01").unwrap();assert_eq!(r.get("agent-01").unwrap().status,WorkspaceStatus::Running);assert_eq!(r.get("agent-01").unwrap().active_runs,1);r.finish_run("agent-01").unwrap();assert_eq!(r.get("agent-01").unwrap().status,WorkspaceStatus::Ready);}
    #[test] fn decision_closes(){let mut d=DecisionRecord::new("d1","agent-03","hyp","act");d.close("actual","better","keep evidence");assert!(d.actual_outcome.is_some());}
}
