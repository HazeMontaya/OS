use os_contracts::MemoryRecord;

#[derive(Debug, Default)]
pub struct MemoryStore {
    records: Vec<MemoryRecord>,
}

impl MemoryStore {
    pub fn upsert(&mut self, record: MemoryRecord) {
        if let Some(existing) = self.records.iter_mut().find(|item| item.id == record.id) {
            *existing = record;
        } else {
            self.records.push(record);
        }
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }
}
