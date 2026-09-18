#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EvolutionStage { Proposed, Sandboxed, Tested, Canary, Promoted, Rejected, RolledBack }

#[derive(Clone, Debug)]
pub struct ChangeProposal {
    pub id: String,
    pub description: String,
    pub stage: EvolutionStage,
}

impl ChangeProposal {
    pub fn new(id: impl Into<String>, description: impl Into<String>) -> Self {
        Self { id: id.into(), description: description.into(), stage: EvolutionStage::Proposed }
    }

    pub fn advance(&mut self, next: EvolutionStage) -> Result<(), &'static str> {
        use EvolutionStage::*;
        let valid = matches!((self.stage, next),
            (Proposed, Sandboxed) |
            (Sandboxed, Tested) |
            (Tested, Canary) |
            (Canary, Promoted) |
            (_, Rejected) |
            (Promoted, RolledBack));
        if !valid { return Err("invalid evolution transition"); }
        self.stage = next;
        Ok(())
    }
}
