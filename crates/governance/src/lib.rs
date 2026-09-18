#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DecisionClass { ReadOnly, Reversible, External, Financial, Destructive, SelfModification, Replication }

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision { Allow, Ask, Deny, Sandbox }

#[derive(Clone, Debug)]
pub struct ActionPolicy {
    pub decision: Decision,
    pub owner_approval: bool,
    pub max_cents: Option<i64>,
}

#[derive(Clone, Debug)]
pub struct GovernancePolicy {
    pub readonly: ActionPolicy,
    pub reversible: ActionPolicy,
    pub external: ActionPolicy,
    pub financial: ActionPolicy,
    pub destructive: ActionPolicy,
    pub self_modification: ActionPolicy,
    pub replication: ActionPolicy,
}

impl Default for GovernancePolicy {
    fn default() -> Self {
        let ask = |max_cents| ActionPolicy { decision: Decision::Ask, owner_approval: true, max_cents };
        Self {
            readonly: ActionPolicy { decision: Decision::Allow, owner_approval: false, max_cents: None },
            reversible: ActionPolicy { decision: Decision::Ask, owner_approval: false, max_cents: None },
            external: ask(None),
            financial: ask(Some(5_000)),
            destructive: ask(None),
            self_modification: ActionPolicy { decision: Decision::Sandbox, owner_approval: true, max_cents: None },
            replication: ActionPolicy { decision: Decision::Sandbox, owner_approval: true, max_cents: Some(1_000) },
        }
    }
}

impl GovernancePolicy {
    pub fn evaluate(&self, class: DecisionClass, requested_cents: Option<i64>, emergency: bool) -> Decision {
        if emergency && class != DecisionClass::ReadOnly { return Decision::Deny; }
        let p = match class {
            DecisionClass::ReadOnly => &self.readonly,
            DecisionClass::Reversible => &self.reversible,
            DecisionClass::External => &self.external,
            DecisionClass::Financial => &self.financial,
            DecisionClass::Destructive => &self.destructive,
            DecisionClass::SelfModification => &self.self_modification,
            DecisionClass::Replication => &self.replication,
        };
        if let (Some(max), Some(requested)) = (p.max_cents, requested_cents) {
            if requested > max { return Decision::Deny; }
        }
        p.decision
    }
}
