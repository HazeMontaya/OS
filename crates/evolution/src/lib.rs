use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvolutionStage {
    Proposed,
    Sandboxed,
    Tested,
    Canary,
    Promoted,
    Rejected,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeProposal {
    pub id: Uuid,
    pub subject: String,
    pub rationale: String,
    pub stage: EvolutionStage,
    pub parent_revision: String,
    pub candidate_revision: String,
}

impl ChangeProposal {
    pub fn new(subject: impl Into<String>, rationale: impl Into<String>, parent_revision: impl Into<String>, candidate_revision: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            subject: subject.into(),
            rationale: rationale.into(),
            stage: EvolutionStage::Proposed,
            parent_revision: parent_revision.into(),
            candidate_revision: candidate_revision.into(),
        }
    }

    pub fn advance(&mut self, next: EvolutionStage) -> bool {
        use EvolutionStage::*;
        let valid = matches!(
            (self.stage, next),
            (Proposed, Sandboxed)
                | (Sandboxed, Tested)
                | (Tested, Canary)
                | (Canary, Promoted)
                | (Proposed, Rejected)
                | (Sandboxed, Rejected)
                | (Tested, Rejected)
                | (Canary, Rejected)
                | (Canary, RolledBack)
                | (Promoted, RolledBack)
        );
        if valid {
            self.stage = next;
        }
        valid
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evolution_requires_a_canary_before_promotion() {
        let mut change = ChangeProposal::new("skill", "improve tool selection", "a", "b");
        assert!(change.advance(EvolutionStage::Sandboxed));
        assert!(change.advance(EvolutionStage::Tested));
        assert!(!change.advance(EvolutionStage::Promoted));
        assert!(change.advance(EvolutionStage::Canary));
        assert!(change.advance(EvolutionStage::Promoted));
    }
}
