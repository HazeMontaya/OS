use std::{
    fs::{File, OpenOptions},
    io::{self, BufRead, BufReader, Write},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

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
    AgentHandoff { work_item_id: String, from_agent: String, to_agent: String },
    ModelRouted { task_kind: String, provider: String, model: String },
    ModelFailed { task_kind: String, provider: String, model: String, reason: String },
    RevenueStageAdvanced { opportunity_id: String, stage: String },
    RevenueRecorded { cents: i64, memo: String },
    ExpenseRecorded { cents: i64, memo: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRecord {
    pub id: u64,
    pub timestamp_ms: u128,
    pub event: Event,
}

#[derive(Clone, Debug, Default)]
pub struct EventLog {
    events: Vec<Event>,
    records: Vec<EventRecord>,
}

impl EventLog {
    pub fn push(&mut self, event: Event) -> u64 {
        let id = self.records.len() as u64 + 1;
        let record = EventRecord {
            id,
            timestamp_ms: now_ms(),
            event: event.clone(),
        };
        self.events.push(event);
        self.records.push(record);
        id
    }

    pub fn all(&self) -> &[Event] {
        &self.events
    }

    pub fn records(&self) -> &[EventRecord] {
        &self.records
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn append_journal(&self, path: impl AsRef<Path>) -> io::Result<()> {
        let path = path.as_ref();
        let existing = match File::open(path) {
            Ok(file) => BufReader::new(file).lines().count(),
            Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
            Err(error) => return Err(error),
        };
        if existing >= self.events.len() {
            return Ok(());
        }
        let mut file = OpenOptions::new().create(true).append(true).open(path)?;
        for record in self.records.iter().skip(existing) {
            writeln!(
                file,
                "v2\t{}\t{}\t{}",
                record.id,
                record.timestamp_ms,
                encode(&record.event)
            )?;
        }
        file.sync_all()?;
        Ok(())
    }

    pub fn load_journal(path: impl AsRef<Path>) -> io::Result<Self> {
        let file = match File::open(path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Self::default()),
            Err(error) => return Err(error),
        };
        let mut log = Self::default();
        for line in BufReader::new(file).lines() {
            let line = line?;
            if let Some(record) = decode_record(&line, log.records.len() as u64 + 1) {
                log.events.push(record.event.clone());
                log.records.push(record);
            }
        }
        Ok(log)
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn esc(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn unesc(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('t') => output.push('\t'),
                Some('n') => output.push('\n'),
                Some('r') => output.push('\r'),
                Some('\\') => output.push('\\'),
                Some(other) => {
                    output.push('\\');
                    output.push(other);
                }
                None => output.push('\\'),
            }
        } else {
            output.push(ch);
        }
    }
    output
}

fn encode(event: &Event) -> String {
    match event {
        Event::TaskQueued { task_id, agent } => format!("TaskQueued\t{}\t{}", esc(task_id), esc(agent)),
        Event::TaskStarted { task_id } => format!("TaskStarted\t{}", esc(task_id)),
        Event::ToolCalled { task_id, tool } => format!("ToolCalled\t{}\t{}", esc(task_id), esc(tool)),
        Event::ToolCompleted { task_id, tool, success } => {
            format!("ToolCompleted\t{}\t{}\t{}", esc(task_id), esc(tool), success)
        }
        Event::TaskCompleted { task_id } => format!("TaskCompleted\t{}", esc(task_id)),
        Event::TaskBlocked { task_id, reason } => {
            format!("TaskBlocked\t{}\t{}", esc(task_id), esc(reason))
        }
        Event::HeartbeatStarted { agent } => format!("HeartbeatStarted\t{}", esc(agent)),
        Event::HeartbeatFinished { agent, status } => {
            format!("HeartbeatFinished\t{}\t{}", esc(agent), esc(status))
        }
        Event::AgentHandoff {
            work_item_id,
            from_agent,
            to_agent,
        } => format!(
            "AgentHandoff\t{}\t{}\t{}",
            esc(work_item_id),
            esc(from_agent),
            esc(to_agent)
        ),
        Event::RevenueStageAdvanced { opportunity_id, stage } => {
            format!("RevenueStageAdvanced\t{}\t{}", esc(opportunity_id), esc(stage))
        }
        Event::RevenueRecorded { cents, memo } => {
            format!("RevenueRecorded\t{}\t{}", cents, esc(memo))
        }
        Event::ExpenseRecorded { cents, memo } => {
            format!("ExpenseRecorded\t{}\t{}", cents, esc(memo))
        }
    }
}

fn decode_record(line: &str, fallback_id: u64) -> Option<EventRecord> {
    let mut parts = line.splitn(4, '\t');
    let first = parts.next()?;
    let (id, timestamp_ms, encoded) = if first == "v2" {
        (
            parts.next()?.parse().ok()?,
            parts.next()?.parse().ok()?,
            parts.next()?,
        )
    } else {
        (fallback_id, 0, line)
    };
    decode(encoded).map(|event| EventRecord {
        id,
        timestamp_ms,
        event,
    })
}

fn decode(line: &str) -> Option<Event> {
    let mut parts = line.split('\t');
    let kind = parts.next()?;
    let value = |part: Option<&str>| part.map(unesc);
    Some(match kind {
        "TaskQueued" => Event::TaskQueued {
            task_id: value(parts.next())?,
            agent: value(parts.next())?,
        },
        "TaskStarted" => Event::TaskStarted {
            task_id: value(parts.next())?,
        },
        "ToolCalled" => Event::ToolCalled {
            task_id: value(parts.next())?,
            tool: value(parts.next())?,
        },
        "ToolCompleted" => Event::ToolCompleted {
            task_id: value(parts.next())?,
            tool: value(parts.next())?,
            success: parts.next()?.parse().ok()?,
        },
        "TaskCompleted" => Event::TaskCompleted {
            task_id: value(parts.next())?,
        },
        "TaskBlocked" => Event::TaskBlocked {
            task_id: value(parts.next())?,
            reason: value(parts.next())?,
        },
        "HeartbeatStarted" => Event::HeartbeatStarted {
            agent: value(parts.next())?,
        },
        "HeartbeatFinished" => Event::HeartbeatFinished {
            agent: value(parts.next())?,
            status: value(parts.next())?,
        },
        "AgentHandoff" => Event::AgentHandoff { work_item_id: value(parts.next())?, from_agent: value(parts.next())?, to_agent: value(parts.next())? },
        "ModelRouted" => Event::ModelRouted { task_kind: value(parts.next())?, provider: value(parts.next())?, model: value(parts.next())? },
        "ModelFailed" => Event::ModelFailed { task_kind: value(parts.next())?, provider: value(parts.next())?, model: value(parts.next())?, reason: value(parts.next())? },
        "ModelRouted" => Event::ModelRouted { task_kind: value(parts.next())?, provider: value(parts.next())?, model: value(parts.next())? },
        "ModelFailed" => Event::ModelFailed { task_kind: value(parts.next())?, provider: value(parts.next())?, model: value(parts.next())?, reason: value(parts.next())? },
        "RevenueStageAdvanced" => Event::RevenueStageAdvanced {
            opportunity_id: value(parts.next())?,
            stage: value(parts.next())?,
        },
        "RevenueRecorded" => Event::RevenueRecorded {
            cents: parts.next()?.parse().ok()?,
            memo: value(parts.next())?,
        },
        "ExpenseRecorded" => Event::ExpenseRecorded {
            cents: parts.next()?.parse().ok()?,
            memo: value(parts.next())?,
        },
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_assigns_stable_ids() {
        let mut log = EventLog::default();
        assert_eq!(log.push(Event::TaskStarted { task_id: "a".into() }), 1);
        assert_eq!(log.push(Event::TaskCompleted { task_id: "a".into() }), 2);
        assert_eq!(log.records()[0].id, 1);
        assert!(log.records()[0].timestamp_ms > 0);
    }

    #[test]
    fn journal_is_idempotent() {
        let path = std::env::temp_dir().join(format!("haze-events-idem-{}.log", std::process::id()));
        let mut log = EventLog::default();
        log.push(Event::AgentHandoff {
            work_item_id: "w1".into(),
            from_agent: "a".into(),
            to_agent: "b".into(),
        });
        log.append_journal(&path).unwrap();
        log.append_journal(&path).unwrap();
        let loaded = EventLog::load_journal(&path).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded.records()[0].id, 1);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn journal_roundtrip_and_legacy_decode() {
        let path = std::env::temp_dir().join(format!("haze-events-{}.log", std::process::id()));
        let mut log = EventLog::default();
        log.push(Event::RevenueRecorded {
            cents: 42,
            memo: "a\tb".into(),
        });
        log.append_journal(&path).unwrap();
        let loaded = EventLog::load_journal(&path).unwrap();
        assert_eq!(loaded.all(), log.all());
        assert_eq!(loaded.records()[0].id, 1);

        let legacy_path = std::env::temp_dir().join(format!("haze-events-legacy-{}.log", std::process::id()));
        std::fs::write(
            &legacy_path,
            "RevenueRecorded\t42\tlegacy\\tvalue\n",
        ).unwrap();
        let legacy = EventLog::load_journal(&legacy_path).unwrap();
        assert_eq!(legacy.len(), 1);
        assert_eq!(legacy.records()[0].id, 1);
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(legacy_path);
    }
}
