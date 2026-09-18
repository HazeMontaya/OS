#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Event {
    TaskQueued { task_id: String, agent: String },
    TaskStarted { task_id: String },
    ToolCalled { task_id: String, tool: String },
    ToolCompleted { task_id: String, tool: String, success: bool },
    TaskCompleted { task_id: String },
    TaskBlocked { task_id: String, reason: String },
    HeartbeatStarted { agent: String },
    HeartbeatFinished { agent: String, status: String },
    RevenueStageAdvanced { opportunity_id: String, stage: String },
    RevenueRecorded { cents: i64, memo: String },
    ExpenseRecorded { cents: i64, memo: String },
}

#[derive(Clone, Debug, Default)]
pub struct EventLog { events: Vec<Event> }

impl EventLog {
    pub fn push(&mut self, event: Event) { self.events.push(event); }
    pub fn all(&self) -> &[Event] { &self.events }
    pub fn len(&self) -> usize { self.events.len() }
}
