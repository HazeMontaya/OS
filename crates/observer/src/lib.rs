use std::{
    collections::BTreeMap,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ObservationKind {
    System,
    Service,
    File,
    Screen,
    Audio,
    Network,
    Calendar,
    Message,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Observation {
    pub id: String,
    pub kind: ObservationKind,
    pub source: String,
    pub observed_at_ms: u128,
    pub facts: BTreeMap<String, String>,
}

pub trait ObserverSource {
    fn name(&self) -> &str;
    fn observe(&mut self) -> Result<Vec<Observation>, String>;
}

#[derive(Clone, Debug, Default)]
pub struct ObserverHub {
    sources: Vec<Box<dyn ObserverSource + Send>>,
}

impl ObserverHub {
    pub fn register(&mut self, source: Box<dyn ObserverSource + Send>) {
        self.sources.push(source);
    }

    pub fn observe_all(&mut self) -> Vec<Result<Observation, String>> {
        let mut out = Vec::new();
        for source in &mut self.sources {
            match source.observe() {
                Ok(items) => out.extend(items.into_iter().map(Ok)),
                Err(error) => out.push(Err(format!("{}: {error}", source.name()))),
            }
        }
        out
    }
}

#[derive(Clone, Debug, Default)]
pub struct SystemObserver;

impl SystemObserver {
    pub fn observe_once(&self) -> Observation {
        let mut facts = BTreeMap::new();
        facts.insert("os".into(), std::env::consts::OS.into());
        facts.insert("arch".into(), std::env::consts::ARCH.into());
        facts.insert("family".into(), std::env::consts::FAMILY.into());
        facts.insert(
            "current_dir".into(),
            std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default(),
        );
        facts.insert("rustc".into(), command_version("rustc"));
        facts.insert("cargo".into(), command_version("cargo"));
        facts.insert(
            "model_provider".into(),
            std::env::var("OS_MODEL_PROVIDER").unwrap_or_else(|_| "none".into()),
        );
        Observation {
            id: format!("observation-system-{}", now_ms()),
            kind: ObservationKind::System,
            source: "system".into(),
            observed_at_ms: now_ms(),
            facts,
        }
    }
}

impl ObserverSource for SystemObserver {
    fn name(&self) -> &str {
        "system"
    }

    fn observe(&mut self) -> Result<Vec<Observation>, String> {
        Ok(vec![self.observe_once()])
    }
}

fn command_version(command: &str) -> String {
    match Command::new(command).arg("--version").output() {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout).trim().into(),
        Ok(output) => format!("exit={:?}", output.status.code()),
        Err(error) => format!("unavailable: {error}"),
    }
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_observer_produces_facts() {
        let observation = SystemObserver.observe_once();
        assert_eq!(observation.kind, ObservationKind::System);
        assert!(observation.facts.contains_key("os"));
        assert!(observation.facts.contains_key("arch"));
    }

    #[test]
    fn hub_collects_source_output() {
        let mut hub=ObserverHub::default();
        hub.register(Box::new(SystemObserver));
        let results=hub.observe_all();
        assert_eq!(results.len(),1);
        assert!(results[0].is_ok());
    }
}
