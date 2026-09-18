use std::{fs::OpenOptions, io::{self, Write}, path::Path};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemoryEntry {
    pub timestamp: u64,
    pub agent: String,
    pub kind: String,
    pub content: String,
}

#[derive(Clone, Debug, Default)]
pub struct Memory {
    entries: Vec<MemoryEntry>,
}

impl Memory {
    pub fn remember(&mut self, agent: impl Into<String>, kind: impl Into<String>, content: impl Into<String>) {
        self.entries.push(MemoryEntry {
            timestamp: unix_seconds(),
            agent: agent.into(),
            kind: kind.into(),
            content: content.into(),
        });
    }

    pub fn all(&self) -> &[MemoryEntry] { &self.entries }

    pub fn recent(&self, limit: usize) -> &[MemoryEntry] {
        let start = self.entries.len().saturating_sub(limit);
        &self.entries[start..]
    }

    pub fn append_jsonl(&self, path: impl AsRef<Path>) -> io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(path)?;
        for e in self.entries.iter().rev().take(1) {
            writeln!(file, r#"{{"timestamp":{},"agent":"{}","kind":"{}","content":"{}"}}"#,
                e.timestamp, escape(&e.agent), escape(&e.kind), escape(&e.content))?;
        }
        Ok(())
    }
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r")
}
fn unix_seconds() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stores_and_reads_recent_memory() {
        let mut m = Memory::default();
        m.remember("agent-1", "observation", "hello");
        m.remember("agent-2", "observation", "world");
        assert_eq!(m.recent(1)[0].content, "world");
    }
}
