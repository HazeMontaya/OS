use os_contracts::CognitiveEvent;

#[derive(Debug, Default)]
pub struct EventLedger {
    events: Vec<CognitiveEvent>,
}

impl EventLedger {
    pub fn append(&mut self, event: CognitiveEvent) {
        self.events.push(event);
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn recent(&self, limit: usize) -> &[CognitiveEvent] {
        let start = self.events.len().saturating_sub(limit);
        &self.events[start..]
    }
}
