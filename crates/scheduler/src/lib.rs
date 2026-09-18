use std::collections::BTreeMap;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Trigger {
    IntervalMs { every_ms: u64 },
    Event { prefix: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScheduledJob {
    pub id: String,
    pub trigger: Trigger,
    pub action: String,
    pub next_due_ms: u128,
    pub enabled: bool,
    pub runs: u64,
}

#[derive(Clone, Debug, Default)]
pub struct Scheduler {
    jobs: BTreeMap<String, ScheduledJob>,
}

impl Scheduler {
    pub fn schedule(&mut self, job: ScheduledJob) -> Result<(), String> {
        if job.id.trim().is_empty() || job.action.trim().is_empty() {
            return Err("scheduled job id and action are required".into());
        }
        if self.jobs.contains_key(&job.id) {
            return Err("duplicate scheduled job".into());
        }
        if let Trigger::IntervalMs { every_ms } = job.trigger {
            if every_ms == 0 { return Err("interval must be positive".into()); }
        }
        self.jobs.insert(job.id.clone(), job);
        Ok(())
    }

    pub fn due(&mut self, now_ms: u128) -> Vec<ScheduledJob> {
        let mut due=Vec::new();
        for job in self.jobs.values_mut() {
            if !job.enabled { continue; }
            let ready=match job.trigger {
                Trigger::IntervalMs { every_ms } => now_ms >= job.next_due_ms,
                Trigger::Event { .. } => false,
            };
            if ready {
                job.runs=job.runs.saturating_add(1);
                if let Trigger::IntervalMs { every_ms } = job.trigger {
                    job.next_due_ms=now_ms.saturating_add(every_ms as u128);
                }
                due.push(job.clone());
            }
        }
        due
    }

    pub fn trigger_event(&mut self, event_type:&str) -> Vec<ScheduledJob> {
        let mut triggered=Vec::new();
        for job in self.jobs.values_mut() {
            if !job.enabled { continue; }
            if let Trigger::Event { prefix } = &job.trigger {
                if event_type.starts_with(prefix) {
                    job.runs=job.runs.saturating_add(1);
                    triggered.push(job.clone());
                }
            }
        }
        triggered
    }

    pub fn get(&self, id:&str)->Option<&ScheduledJob>{self.jobs.get(id)}
    pub fn all(&self)->impl Iterator<Item=&ScheduledJob>{self.jobs.values()}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interval_job_is_deterministically_due() {
        let mut s=Scheduler::default();
        s.schedule(ScheduledJob{id:"heartbeat".into(),trigger:Trigger::IntervalMs{every_ms:1000},action:"health".into(),next_due_ms:10,enabled:true,runs:0}).unwrap();
        assert_eq!(s.due(9).len(),0);
        assert_eq!(s.due(10).len(),1);
        assert_eq!(s.due(10).len(),0);
        assert_eq!(s.due(1010).len(),1);
    }

    #[test]
    fn event_trigger_matches_prefix() {
        let mut s=Scheduler::default();
        s.schedule(ScheduledJob{id:"repair".into(),trigger:Trigger::Event{prefix:"application.".into()},action:"diagnose".into(),next_due_ms:0,enabled:true,runs:0}).unwrap();
        assert_eq!(s.trigger_event("application.crashed").len(),1);
        assert_eq!(s.trigger_event("calendar.updated").len(),0);
    }
}
